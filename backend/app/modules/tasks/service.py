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
        submission_file_url=_sign_url(item.get("submission_file_url")),
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
    
    item = {
        "task_id": task_id,
        "title": payload.title,
        "description": payload.description,
        "reporter_id": payload.reporter_id,
        "assignee_id": payload.assignee_id,
        "parent_task_id": payload.parent_task_id,
        "status": TaskStatus.OPEN.value,
        "priority": payload.priority.value,
        "due_date": payload.due_date,
        "file_url": payload.file_url,
        "submission_file_url": payload.submission_file_url,
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
    
    # Optional: Publish TaskAssigned Event to EventBridge here (Workflow 8 -> Workflow 4)
    # from app.shared.aws.eventbridge import publish_event
    # publish_event(DetailType="TaskAssigned", Detail={"task_id": task_id, "assignee_id": payload.assignee_id})
    
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
    from app.modules.users.repository import get_user
    current_user = get_user(user_id)
    if not current_user:
        raise AppException(ErrorCode.UNAUTHORIZED, message="User not found")
        
    existing = repo.get_task(task_id)
    if not existing:
        raise AppException(ErrorCode.RESOURCE_NOT_FOUND, message="Task not found")

    is_admin = current_user.get("role") == "ADMIN"
    is_reporter = current_user.get("user_id") == existing.get("reporter_id")
    
    if not (is_admin or is_reporter):
        raise AppException(ErrorCode.FORBIDDEN, message="Chỉ Admin hoặc người tạo mới được sửa")
        
    if existing.get("status") in ["DONE", "CANCELLED"] and not is_admin:
        raise AppException(ErrorCode.BAD_REQUEST, message="Không thể sửa công việc đã hoàn thành hoặc đã hủy")
        
    update_expr = "SET updated_at = :now"
    expr_vals = {":now": datetime.now(timezone.utc).isoformat()}
    expr_names = {}
    
    update_data = payload.model_dump(exclude_unset=True)
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
                
    kwargs = {
        "task_id": task_id,
        "update_expr": update_expr,
        "expr_vals": expr_vals
    }
    if expr_names:
        kwargs["expr_names"] = expr_names
        
    updated_item = repo.update_task_in_db(**kwargs)
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
    
    # Optional: If status is DONE, publish TaskCompleted Event
    # if payload.status == TaskStatus.DONE:
    #     publish_event(DetailType="TaskCompleted", Detail={"task_id": task_id})
        
    return get_task(task_id)

def delete_task(task_id: str, user_id: str) -> bool:
    from app.modules.users.repository import get_user_by_id
    current_user = get_user_by_id(user_id)
    if not current_user:
        raise AppException(ErrorCode.UNAUTHORIZED, message="User not found")
        
    existing = repo.get_task(task_id)
    if not existing:
        raise AppException(ErrorCode.RESOURCE_NOT_FOUND, message="Task not found")

    is_admin = current_user.get("role") == "ADMIN"
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
            raise AppException(ErrorCode.BAD_REQUEST, message="Không thể hủy công việc đã bắt đầu thực hiện")
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
