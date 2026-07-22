"""FastAPI router for the Users module."""

from typing import Optional

from fastapi import APIRouter, Query

from app.core.responses import APIResponse
from .schemas import UserCreate, UserUpdate, UserResponse, UserListResponse
from . import service

router = APIRouter(prefix="/users", tags=["Users"])


@router.post(
    "",
    response_model=APIResponse[UserResponse],
    status_code=201,
    summary="Tạo người dùng mới",
)
def create_user(payload: UserCreate):
    data = service.create_user(payload)
    return APIResponse.created(data, message="Tạo người dùng thành công.")


@router.get(
    "",
    response_model=APIResponse[UserListResponse],
    summary="Danh sách người dùng",
)
def list_users(
    role: Optional[str] = Query(None, description="Lọc theo role: ADMIN, STUDENT, STAFF"),
    status: Optional[str] = Query(None, description="Lọc theo status: ACTIVE, INACTIVE, SUSPENDED"),
    limit: int = Query(10, description="Số lượng mục tối đa"),
    cursor: Optional[str] = Query(None, description="Cursor cho phân trang"),
):
    items, next_key = service.list_users(role=role, status_filter=status, limit=limit, cursor=cursor)
    data = UserListResponse(items=items, total=len(items), next_key=next_key)
    return APIResponse.ok(data)


@router.get(
    "/{user_id}",
    response_model=APIResponse[UserResponse],
    summary="Lấy thông tin người dùng",
)
def get_user(user_id: str):
    data = service.get_user(user_id)
    return APIResponse.ok(data)


@router.patch(
    "/{user_id}",
    response_model=APIResponse[UserResponse],
    summary="Cập nhật thông tin người dùng",
)
def update_user(user_id: str, payload: UserUpdate):
    data = service.update_user(user_id, payload)
    return APIResponse.ok(data, message="Cập nhật thành công.")
