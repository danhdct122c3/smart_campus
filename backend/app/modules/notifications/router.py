"""FastAPI router for the Notifications module (Workflow 4)."""

from typing import Optional

from fastapi import APIRouter, Query

from app.core.responses import APIResponse
from .schemas import SendNotificationRequest, NotificationRecord, NotificationListResponse
from . import service

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get(
    "",
    response_model=APIResponse[NotificationListResponse],
    summary="Lịch sử thông báo",
    description="Lấy danh sách thông báo đã gửi. Lọc theo user_id nếu cần.",
)
def list_notifications(
    user_id: Optional[str] = Query(None, description="Lọc theo User ID"),
    limit: int = Query(50, ge=1, le=200, description="Số lượng tối đa"),
):
    items = service.list_notifications(user_id=user_id, limit=limit)
    data = NotificationListResponse(items=items, total=len(items))
    return APIResponse.ok(data)


@router.post(
    "/send",
    response_model=APIResponse[NotificationRecord],
    status_code=201,
    summary="Gửi thông báo thủ công (Admin)",
    description="""
    Gửi thông báo tùy chỉnh đến người dùng qua kênh được chọn.

    **Dùng cho**:
    - Admin gửi thông báo hệ thống.
    - Test kênh thông báo.

    **Channels hỗ trợ**: EMAIL, SMS, PUSH, TEAMS, SLACK, WEBHOOK.
    """,
)
def send_notification(payload: SendNotificationRequest):
    data = service.send_custom_notification(payload)
    return APIResponse.created(data, message="Thông báo đã được gửi.")
