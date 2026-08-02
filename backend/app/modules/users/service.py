"""Business logic for the Users module."""

import uuid
from datetime import datetime, timezone

import boto3
from fastapi import status

from app.core.config import get_settings
from app.core.exceptions import AppException, ErrorCode
from .schemas import UserCreate, UserUpdate, UserResponse, UserStatus
from . import repository as repo

settings = get_settings()

def get_cognito_client():
    if not settings.cognito_user_pool_id or not settings.cognito_client_id:
        return None
    return boto3.client('cognito-idp', region_name=settings.aws_region)


def _to_response(item: dict) -> UserResponse:
    return UserResponse(
        user_id=item["user_id"],
        email=item["email"],
        name=item["name"],
        role=item["role"],
        department=item.get("department"),
        phone=item.get("phone"),
        employee_id=item.get("employee_id"),
        status=item.get("status", UserStatus.ACTIVE),
        face_registered=item.get("face_registered", False),
        created_at=item["created_at"],
        updated_at=item.get("updated_at"),
    )


def create_user(payload: UserCreate) -> UserResponse:
    """Create a new user. Raises 409 if email already exists."""
    email = payload.email.lower()
    existing = repo.get_user_by_email(email)
    if existing:
        raise AppException(
            ErrorCode.USER_ALREADY_EXISTS,
            message=f"Email '{email}' đã được đăng ký trong hệ thống.",
        )

    now = datetime.now(timezone.utc).isoformat()
    item = {
        "user_id": str(uuid.uuid4()),
        "email": email,
        "name": payload.name,
        "role": payload.role.value,
        "department": payload.department.value if payload.department else None,
        "phone": payload.phone,
        "employee_id": payload.employee_id,
        "status": UserStatus.ACTIVE.value,
        "face_registered": False,
        "created_at": now,
        "updated_at": None,
    }
    
    # Tạo user trên AWS Cognito
    cognito_client = get_cognito_client()
    if cognito_client:
        try:
            cognito_client.admin_create_user(
                UserPoolId=settings.cognito_user_pool_id,
                Username=email,
                UserAttributes=[
                    {'Name': 'email', 'Value': email},
                    {'Name': 'email_verified', 'Value': 'true'},
                ],
                # Không truyền MessageAction='SUPPRESS' để Cognito tự gửi thư.
            )
        except cognito_client.exceptions.UsernameExistsException:
            pass # Nếu đã tồn tại trên Cognito thì bỏ qua
        except Exception as e:
            print(f"Failed to create user in Cognito: {e}")
            # Vẫn tiếp tục tạo trên DynamoDB
    
    repo.create_user(item)
    return _to_response(item)


def get_user(user_id: str) -> UserResponse:
    """Fetch a single user by ID. Raises 404 if not found."""
    item = repo.get_user_by_id(user_id)
    if not item:
        raise AppException(
            ErrorCode.USER_NOT_FOUND,
            message=f"Người dùng '{user_id}' không tồn tại.",
        )
    return _to_response(item)


def list_users(
    role: str | None, 
    status_filter: str | None,
    department: str | None = None,
    limit: int = 20,
    cursor: str | None = None
) -> tuple[list[UserResponse], str | None]:
    items, next_key = repo.list_users(role=role, status=status_filter, department=department, limit=limit, cursor=cursor)
    return [_to_response(i) for i in items], next_key



def update_user(user_id: str, payload: UserUpdate) -> UserResponse:
    """Partially update a user. Raises 404 if not found."""
    existing = repo.get_user_by_id(user_id)
    if not existing:
        raise AppException(
            ErrorCode.USER_NOT_FOUND,
            message=f"Người dùng '{user_id}' không tồn tại.",
        )

    fields = {}
    if payload.name is not None:
        fields["name"] = payload.name
    if payload.email is not None and payload.email != existing.get("email"):
        check_email = repo.get_user_by_email(payload.email)
        if check_email:
            raise AppException(
                ErrorCode.USER_ALREADY_EXISTS,
                message=f"Email '{payload.email}' đã được sử dụng.",
            )
        fields["email"] = payload.email
        
        # Cập nhật email trên AWS Cognito
        old_email = existing.get("email")
        cognito_client = get_cognito_client()
        if cognito_client and old_email:
            try:
                # 1. Tìm Username gốc (UUID) dựa trên email cũ
                res = cognito_client.list_users(
                    UserPoolId=settings.cognito_user_pool_id,
                    Filter=f"email = \"{old_email}\"",
                    Limit=1
                )
                if res.get("Users"):
                    cognito_username = res["Users"][0]["Username"]
                    # 2. Cập nhật attributes bằng Username gốc
                    cognito_client.admin_update_user_attributes(
                        UserPoolId=settings.cognito_user_pool_id,
                        Username=cognito_username,
                        UserAttributes=[
                            {'Name': 'email', 'Value': payload.email},
                            {'Name': 'email_verified', 'Value': 'true'},
                        ]
                    )
            except Exception as e:
                print(f"Failed to update user email in Cognito: {e}")

    if payload.role is not None:
        fields["role"] = payload.role.value
    if payload.department is not None:
        fields["department"] = payload.department.value
    if payload.phone is not None:
        fields["phone"] = payload.phone
    if payload.status is not None:
        fields["status"] = payload.status.value

    if fields:
        repo.update_user(user_id, fields)

    updated = repo.get_user_by_id(user_id)
    return _to_response(updated)


def mark_face_registered(user_id: str) -> None:
    """Called by Face service after successful IndexFaces."""
    repo.update_user(user_id, {"face_registered": True})


def get_user_tasks(user_id: str):
    """Fetch task history assigned to a user."""
    get_user(user_id)  # ensure user exists or raise 404
    from app.modules.tasks import repository as task_repo
    from app.modules.tasks.service import _item_to_record
    items = task_repo.list_tasks_by_assignee(user_id)
    items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return [_item_to_record(item) for item in items]


def get_user_task_stats(user_id: str) -> dict:
    """Calculate task completion stats for a user."""
    get_user(user_id)
    from app.modules.tasks import repository as task_repo
    tasks = task_repo.list_tasks_by_assignee(user_id)
    total_tasks = len(tasks)
    done = sum(1 for t in tasks if t.get("status") in ("COMPLETED", "DONE"))
    in_progress = sum(1 for t in tasks if t.get("status") in ("IN_PROGRESS", "OPEN", "TODO", "IN_REVIEW"))
    
    now_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    overdue = sum(
        1 for t in tasks 
        if t.get("status") not in ("COMPLETED", "DONE", "CANCELLED", "REJECTED") 
        and t.get("due_date") 
        and str(t.get("due_date")) < now_date
    )
    completion_rate = round((done / total_tasks * 100.0), 1) if total_tasks > 0 else 100.0
    return {
        "total_tasks": total_tasks,
        "done": done,
        "in_progress": in_progress,
        "overdue": overdue,
        "completion_rate": completion_rate,
    }
