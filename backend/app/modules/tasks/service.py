import uuid
from datetime import datetime, timezone

from app.core.exceptions import AppException, ErrorCode
from .schemas import (
    TaskCreate,
    TaskUpdate,
    TaskStatusUpdate,
    TaskResponse,
    TaskStatus,
    TaskType,
    Department,
    TaskCategory
)
from . import repository as repo

from app.shared.aws.s3 import get_presigned_url
from app.core.config import settings


def _get_user_name(user_id: str) -> str:
    """Helper to get user's display name."""
    try:
        from app.modules.users.repository import get_user_by_id
        user = get_user_by_id(user_id)
        return user.get("name", user_id) if user else user_id
    except Exception:
        return user_id


def _send_task_notif(user_id: str, event_type, context: dict):
    """Fire-and-forget task notification (non-blocking)."""
    try:
        from app.modules.notifications.service import send_task_notification
        from app.modules.notifications.schemas import NotificationEventType
        result = send_task_notification(user_id=user_id, event_type=event_type, context=context)
        print(f"[NOTIF OK] Sent {event_type} to {user_id}, id={result.notification_id}")
    except Exception as e:
        print(f"[NOTIF ERROR] Failed to send {event_type} to {user_id}: {e}")
        import traceback
        traceback.print_exc()

def _sign_url(url: str | None) -> str | None:
    if not url: return None
    # Extract the key. We know our keys always start with 'tasks/'
    if "tasks/" in url:
        key = url[url.find("tasks/"):]
        return get_presigned_url(settings.image_bucket, key)
    return url

def _item_to_record(item: dict) -> TaskResponse:
    return TaskResponse(
        task_id=item.get("task_id", ""),
        title=item.get("title", ""),
        description=item.get("description"),
        reporter_id=item.get("reporter_id", ""),
        assignee_id=item.get("assignee_id", ""),
        parent_task_id=item.get("parent_task_id"),
        status=TaskStatus(item.get("status", TaskStatus.OPEN)),
        priority=item.get("priority", "MEDIUM"),
        due_date=item.get("due_date"),
        file_url=_sign_url(item.get("file_url")),
        file_urls=[_sign_url(u) for u in item.get("file_urls", []) if u] + ([_sign_url(item.get("file_url"))] if item.get("file_url") and item.get("file_url") not in item.get("file_urls", []) else []),
        submission_file_url=_sign_url(item.get("submission_file_url")),
        submission_file_urls=[_sign_url(u) for u in item.get("submission_file_urls", []) if u] + ([_sign_url(item.get("submission_file_url"))] if item.get("submission_file_url") and item.get("submission_file_url") not in item.get("submission_file_urls", []) else []),
        task_type=TaskType(item.get("task_type", TaskType.STANDARD)),
        department=item.get("department"),
        category=item.get("category"),
        location=item.get("location"),
        submission_note=item.get("submission_note"),
        created_at=item.get("created_at", ""),
        updated_at=item.get("updated_at")
    )

def create_task(payload: TaskCreate) -> TaskResponse:
    task_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    assignee_id = payload.assignee_id
    
    if payload.task_type == TaskType.INCIDENT and payload.department:
        from app.modules.users.repository import list_users
        users, _ = list_users(role="MANAGER")
        for u in users:
            if u.get("department") == payload.department.value:
                assignee_id = u.get("user_id")
                break
                
    item = {
        "task_id": task_id,
        "title": payload.title,
        "description": payload.description,
        "reporter_id": payload.reporter_id,
        "assignee_id": assignee_id,
        "parent_task_id": payload.parent_task_id,
        "status": TaskStatus.OPEN.value,
        "priority": payload.priority.value,
        "due_date": payload.due_date,
        "file_url": payload.file_url,
        "file_urls": payload.file_urls,
        "submission_file_url": payload.submission_file_url,
        "submission_file_urls": payload.submission_file_urls,
        "task_type": payload.task_type.value,
        "department": payload.department.value if payload.department else None,
        "category": payload.category.value if payload.category else None,
        "location": payload.location,
        "submission_note": payload.submission_note,
        "created_at": now,
        "updated_at": now,
    }
    
    # Remove None values
    item = {k: v for k, v in item.items() if v is not None}
    
    repo.save_task(item)
    
    # ── Send notifications ──
    from app.modules.notifications.schemas import NotificationEventType
    reporter_name = _get_user_name(payload.reporter_id)
    
    if payload.task_type == TaskType.INCIDENT:
        # Notify the maintenance manager about the new incident
        if assignee_id:
            _send_task_notif(assignee_id, NotificationEventType.INCIDENT_REPORTED, {
                "task_title": payload.title,
                "reporter_name": reporter_name,
            })
    elif assignee_id:
        # Standard task: notify assignee
        _send_task_notif(assignee_id, NotificationEventType.TASK_ASSIGNED, {
            "task_title": payload.title,
            "reporter_name": reporter_name,
        })
    
    return _item_to_record(item)

def get_task(task_id: str) -> TaskResponse:
    item = repo.get_task(task_id)
    if not item:
        raise AppException(ErrorCode.RESOURCE_NOT_FOUND, message="Task not found")
    return _item_to_record(item)

def list_tasks(
    user_id: str | None = None, 
    status: str | None = None, 
    task_type: str | None = None, 
    department: str | None = None,
    priority: str | None = None,
    search: str | None = None,
    limit: int = 20,
    cursor: str | None = None
) -> tuple[list[TaskResponse], str | None]:
    
    items, next_key = repo.list_tasks_paginated(
        user_id=user_id, status=status, task_type=task_type,
        department=department, priority=priority, search=search,
        limit=limit, cursor=cursor
    )
    
    # Sort chunk by created_at descending (Best effort chunk sorting since DynamoDB scan is unsorted)
    items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return [_item_to_record(i) for i in items], next_key

def update_task(task_id: str, payload: TaskUpdate, user_id: str) -> TaskResponse:
    from app.modules.users.repository import get_user_by_id
    current_user = get_user_by_id(user_id)
    if not current_user:
        raise AppException(ErrorCode.UNAUTHORIZED, message="User not found")
        
    existing = repo.get_task(task_id)
    if not existing:
        raise AppException(ErrorCode.RESOURCE_NOT_FOUND, message="Task not found")

    is_admin = current_user.get("role") == "ADMIN"
    is_reporter = current_user.get("user_id") == existing.get("reporter_id")
    is_assignee = current_user.get("user_id") == existing.get("assignee_id")
    
    update_data = payload.model_dump(exclude_unset=True)
    
    if not (is_admin or is_reporter or is_assignee):
        raise AppException(ErrorCode.FORBIDDEN, message="Chỉ Admin, người tạo hoặc người thực hiện mới được thao tác")
        
    if is_assignee and not (is_admin or is_reporter):
        if current_user.get("role") != "MANAGER":
            allowed_assignee_fields = {"status", "submission_file_url", "submission_file_urls", "submission_note"}
            if any(k not in allowed_assignee_fields for k in update_data.keys()):
                raise AppException(ErrorCode.FORBIDDEN, message="Người thực hiện không có quyền thay đổi thông tin này")
            
    if existing.get("status") in ["DONE", "CANCELLED"] and not is_admin:
        raise AppException(ErrorCode.BAD_REQUEST, message="Không thể sửa công việc đã hoàn thành hoặc đã hủy")
        
    # Validation: Ensure all subtasks are submitted/completed before allowing the parent task to be submitted/completed
    new_status = update_data.get("status")
    if new_status:
        status_val = new_status.value if hasattr(new_status, 'value') else new_status
        if status_val in ["IN_REVIEW", "COMPLETED", "DONE"]:
            from boto3.dynamodb.conditions import Attr
            from app.shared.aws.dynamodb import scan_items_paginated
            subtasks, _ = scan_items_paginated(repo.TABLE, filter_expression=Attr("parent_task_id").eq(task_id), limit=100)
            for sub in subtasks:
                if sub.get("status") not in ["IN_REVIEW", "COMPLETED", "DONE"]:
                    raise AppException(ErrorCode.BAD_REQUEST, message="Không thể nộp hoặc hoàn thành công việc khi vẫn còn công việc con chưa hoàn thành.")
        
    update_expr = "SET updated_at = :now"
    remove_expr = ""
    expr_vals = {":now": datetime.now(timezone.utc).isoformat()}
    expr_names = {}
    
    for k, v in update_data.items():
        if v is not None:
            # use expression names for reserved words if any (e.g. status)
            if k == "status":
                update_expr += f", #status = :status"
                expr_names["#status"] = "status"
                expr_vals[":status"] = v.value if hasattr(v, 'value') else v
            else:
                update_expr += f", {k} = :{k}"
                expr_vals[f":{k}"] = v.value if hasattr(v, 'value') else v
        else:
            if not remove_expr:
                remove_expr = f" REMOVE {k}"
            else:
                remove_expr += f", {k}"
                
    kwargs = {
        "task_id": task_id,
        "update_expr": update_expr + remove_expr,
        "expr_vals": expr_vals
    }
    if expr_names:
        kwargs["expr_names"] = expr_names
        
    updated_item = repo.update_task_in_db(**kwargs)
    
    # ── Send notifications for important updates ──
    from app.modules.notifications.schemas import NotificationEventType
    task_title = existing.get("title", "")
    
    # If status changed to IN_REVIEW => notify reporter that assignee submitted
    new_status = update_data.get("status")
    if new_status:
        status_val = new_status.value if hasattr(new_status, 'value') else new_status
        if status_val == "IN_REVIEW":
            reporter_id = existing.get("reporter_id")
            if reporter_id:
                assignee_name = _get_user_name(user_id)
                _send_task_notif(reporter_id, NotificationEventType.TASK_SUBMITTED, {
                    "task_title": task_title,
                    "assignee_name": assignee_name,
                })
        elif status_val == "COMPLETED":
            # Notify assignee that their work was approved
            assignee_id = existing.get("assignee_id")
            if assignee_id:
                _send_task_notif(assignee_id, NotificationEventType.TASK_COMPLETED, {
                    "task_title": task_title,
                })
        elif status_val == "IN_PROGRESS" and existing.get("status") == "IN_REVIEW":
            # Rejected: notify assignee to redo
            assignee_id = existing.get("assignee_id")
            if assignee_id:
                _send_task_notif(assignee_id, NotificationEventType.TASK_STATUS_CHANGED, {
                    "task_title": task_title,
                    "new_status": "Bị từ chối - Cần làm lại",
                })
    
    # If assignee changed (re-assignment / dispatching)
    new_assignee = update_data.get("assignee_id")
    if new_assignee and new_assignee != existing.get("assignee_id"):
        reporter_name = _get_user_name(user_id)
        _send_task_notif(new_assignee, NotificationEventType.TASK_ASSIGNED, {
            "task_title": task_title,
            "reporter_name": reporter_name,
        })
    
    return get_task(task_id)

def update_task_status(task_id: str, payload: TaskStatusUpdate) -> TaskResponse:
    existing = repo.get_task(task_id)
    if not existing:
        raise AppException(ErrorCode.RESOURCE_NOT_FOUND, message="Task not found")
        
    updated_item = repo.update_task_in_db(
        task_id=task_id,
        update_expr="SET #status = :status, updated_at = :now",
        expr_vals={
            ":status": payload.status.value,
            ":now": datetime.now(timezone.utc).isoformat()
        },
        expr_names={"#status": "status"}
    )
    
    # ── Send notifications ──
    from app.modules.notifications.schemas import NotificationEventType
    task_title = existing.get("title", "")
    
    STATUS_LABELS = {
        "OPEN": "Chờ phân công",
        "IN_PROGRESS": "Đang thực hiện",
        "IN_REVIEW": "Chờ duyệt",
        "COMPLETED": "Hoàn thành",
        "CANCELLED": "Đã hủy",
    }
    
    # Notify assignee about the status change
    assignee_id = existing.get("assignee_id")
    if assignee_id:
        _send_task_notif(assignee_id, NotificationEventType.TASK_STATUS_CHANGED, {
            "task_title": task_title,
            "new_status": STATUS_LABELS.get(payload.status.value, payload.status.value),
        })
    
    # If completed, also notify reporter
    if payload.status == TaskStatus.COMPLETED:
        reporter_id = existing.get("reporter_id")
        if reporter_id and reporter_id != assignee_id:
            _send_task_notif(reporter_id, NotificationEventType.TASK_COMPLETED, {
                "task_title": task_title,
            })
    return get_task(task_id)

def delete_task(task_id: str, user_id: str) -> bool:
    from app.modules.users.repository import get_user_by_id
    current_user = get_user_by_id(user_id)
    if not current_user:
        raise AppException(ErrorCode.UNAUTHORIZED, message="User not found")
        
    existing = repo.get_task(task_id)
    if not existing:
        raise AppException(ErrorCode.TASK_NOT_FOUND, message="Task not found")

    is_admin = current_user.get("role") in ("ADMIN", "MANAGER")
    is_reporter = current_user.get("user_id") == existing.get("reporter_id")
    
    if is_admin:
        return repo.delete_task_with_subtasks(task_id)
    elif is_reporter:
        if existing.get("status") == "OPEN":
            # Soft delete/cancel
            repo.update_task_in_db(
                task_id=task_id,
                update_expr="SET #status = :status, updated_at = :now",
                expr_vals={
                    ":status": "CANCELLED",
                    ":now": datetime.now(timezone.utc).isoformat()
                },
                expr_names={"#status": "status"}
            )
            return True
        else:
            raise AppException(ErrorCode.FORBIDDEN, message="Không thể hủy công việc đã bắt đầu thực hiện")
    else:
        raise AppException(ErrorCode.FORBIDDEN, message="Bạn không có quyền xóa công việc này")

def get_presigned_upload_url(file_name: str, file_type: str) -> dict:
    """Generate a presigned URL to upload a task attachment to S3."""
    from app.shared.aws.s3 import get_s3_client
    from app.core.config import settings
    
    s3_client = get_s3_client()
    
    key = f"tasks/{uuid.uuid4()}/{file_name}"
    
    try:
        url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': settings.image_bucket,
                'Key': key,
                'ContentType': file_type
            },
            ExpiresIn=3600
        )
        return {
            "upload_url": url,
            "file_url": f"s3://{settings.image_bucket}/{key}",
            "public_url": f"https://{settings.image_bucket}.s3.{settings.aws_region}.amazonaws.com/{key}"
        }
    except Exception as e:
        raise AppException(ErrorCode.INTERNAL_SERVER_ERROR, message=f"Failed to generate presigned URL: {str(e)}")


def check_and_notify_task_deadlines() -> dict:
    """
    Quét tất cả công việc trong hệ thống, tìm các việc sắp đến hạn (< 10 phút)
    và các việc đã quá hạn để gửi thông báo.
    """
    from app.modules.notifications.schemas import NotificationEventType
    
    tasks_data, _ = repo.list_tasks_paginated(limit=1000)
    now_utc = datetime.now(timezone.utc)
    
    upcoming_tasks = []
    overdue_tasks = []
    
    for task in tasks_data:
        due_date_str = task.get("due_date")
        status_val = task.get("status", "OPEN")
        if not due_date_str or status_val in ["COMPLETED", "DONE", "CANCELLED"]:
            continue
            
        try:
            # Parse due_date. If it's old data 'YYYY-MM-DD', append 'T00:00:00Z'
            if len(due_date_str) == 10:
                due_date_str += "T00:00:00Z"
                
            due_dt = datetime.fromisoformat(due_date_str.replace("Z", "+00:00"))
            delta_seconds = (due_dt - now_utc).total_seconds()
            
            # Quá hạn (delta < 0)
            if delta_seconds < 0 and not task.get("overdue_notified", False):
                overdue_tasks.append(task)
            
            # Sắp đến hạn (0 <= delta <= 600) (10 phút)
            elif 0 <= delta_seconds <= 600 and not task.get("upcoming_notified", False):
                upcoming_tasks.append(task)
                
        except ValueError:
            continue
            
    notified_ids = []
    
    # Process upcoming
    for task in upcoming_tasks:
        assignee_id = task.get("assignee_id")
        task_id = task.get("task_id")
        if assignee_id:
            reporter_name = _get_user_name(task.get("reporter_id"))
            _send_task_notif(
                user_id=assignee_id,
                event_type=NotificationEventType.TASK_UPCOMING_DEADLINE,
                context={
                    "task_title": task.get("title", "N/A"),
                    "due_date": task.get("due_date"),
                    "reporter_name": reporter_name
                }
            )
            repo.update_task_in_db(
                task_id=task_id,
                update_expr="SET upcoming_notified = :t",
                expr_vals={":t": True}
            )
            notified_ids.append(task_id)
            
    # Process overdue
    for task in overdue_tasks:
        assignee_id = task.get("assignee_id")
        task_id = task.get("task_id")
        if assignee_id:
            reporter_name = _get_user_name(task.get("reporter_id"))
            _send_task_notif(
                user_id=assignee_id,
                event_type=NotificationEventType.TASK_OVERDUE,
                context={
                    "task_title": task.get("title", "N/A"),
                    "due_date": task.get("due_date"),
                    "reporter_name": reporter_name
                }
            )
            repo.update_task_in_db(
                task_id=task_id,
                update_expr="SET overdue_notified = :t",
                expr_vals={":t": True}
            )
            notified_ids.append(task_id)
            
    return {
        "success": True,
        "checked_count": len(tasks_data),
        "overdue_details": [
            {
                "task_id": t.get("task_id"),
                "title": t.get("title"),
                "due_date": t.get("due_date"),
                "assignee_id": t.get("assignee_id"),
                "status": t.get("status")
            } for t in overdue_tasks
        ]
    }

def get_aggregated_submission_files(parent_task_id: str) -> list[str]:
    """Retrieve all submission files from COMPLETED or DONE subtasks of a parent task."""
    subtasks = repo.get_all_subtasks(parent_task_id)
    files = []
    for sub in subtasks:
        if sub.get("status") in ["COMPLETED", "DONE"]:
            sub_files = sub.get("submission_file_urls") or []
            # We want the original unsigned url or the signed one? 
            # Subtasks submission_file_urls are stored as S3 URLs or signed URLs? 
            # In DB they are stored as original keys if uploaded via upload-url.
            # We should just return the raw URLs from the DB. They will be signed when returned in the final task, or we can sign them here so they can be previewed on the frontend.
            # But the frontend will submit them back in the PATCH request. 
            # If they are signed, submitting them back as signed URLs will cause double-signing later or DB pollution.
            # Wait, in item_to_record we sign URLs. Let's look at how file_urls is handled.
            # We should return the RAW URLs (the ones in the DB) so the frontend can submit them back, and then we'll sign them in the UI.
            # Actually, frontend doesn't need to preview them in the submit modal, just see names.
            # Let's return RAW URLs.
            for url in sub_files:
                if url and url not in files:
                    files.append(url)
                    
            # also check the single string field if any
            sub_file = sub.get("submission_file_url")
            if sub_file and sub_file not in files:
                files.append(sub_file)
                
    return files
