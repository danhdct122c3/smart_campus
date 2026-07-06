"""Business logic for the Users module."""

import uuid
from datetime import datetime, timezone

from fastapi import status

from app.core.exceptions import AppException, ErrorCode
from .schemas import UserCreate, UserUpdate, UserResponse, UserStatus
from . import repository as repo


def _to_response(item: dict) -> UserResponse:
    return UserResponse(
        user_id=item["userId"],
        email=item["email"],
        name=item["name"],
        role=item["role"],
        department=item.get("department"),
        phone=item.get("phone"),
        student_id=item.get("studentId"),
        status=item.get("status", UserStatus.ACTIVE),
        face_registered=item.get("faceRegistered", False),
        created_at=item["createdAt"],
        updated_at=item.get("updatedAt"),
    )


def create_user(payload: UserCreate) -> UserResponse:
    """Create a new user. Raises 409 if email already exists."""
    existing = repo.get_user_by_email(payload.email)
    if existing:
        raise AppException(
            error_code=ErrorCode.USER_ALREADY_EXISTS,
            status_code=status.HTTP_409_CONFLICT,
            message=f"Email '{payload.email}' đã được đăng ký trong hệ thống.",
        )

    now = datetime.now(timezone.utc).isoformat()
    item = {
        "userId": str(uuid.uuid4()),
        "email": payload.email,
        "name": payload.name,
        "role": payload.role.value,
        "department": payload.department,
        "phone": payload.phone,
        "studentId": payload.student_id,
        "status": UserStatus.ACTIVE.value,
        "faceRegistered": False,
        "createdAt": now,
        "updatedAt": None,
    }
    repo.create_user(item)
    return _to_response(item)


def get_user(user_id: str) -> UserResponse:
    """Fetch a single user by ID. Raises 404 if not found."""
    item = repo.get_user_by_id(user_id)
    if not item:
        raise AppException(
            error_code=ErrorCode.USER_NOT_FOUND,
            status_code=status.HTTP_404_NOT_FOUND,
            message=f"Người dùng '{user_id}' không tồn tại.",
        )
    return _to_response(item)


def list_users(role: str | None, status_filter: str | None) -> list[UserResponse]:
    items = repo.list_users(role=role, status=status_filter)
    return [_to_response(i) for i in items]


def update_user(user_id: str, payload: UserUpdate) -> UserResponse:
    """Partially update a user. Raises 404 if not found."""
    existing = repo.get_user_by_id(user_id)
    if not existing:
        raise AppException(
            error_code=ErrorCode.USER_NOT_FOUND,
            status_code=status.HTTP_404_NOT_FOUND,
            message=f"Người dùng '{user_id}' không tồn tại.",
        )

    fields = {}
    if payload.name is not None:
        fields["name"] = payload.name
    if payload.department is not None:
        fields["department"] = payload.department
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
    repo.update_user(user_id, {"faceRegistered": True})
