"""FastAPI router for the Attendance module (Workflow 3)."""

from typing import Optional

from fastapi import APIRouter, Query

from app.core.responses import APIResponse
from .schemas import (
    AttendanceRecognizeRequest,
    AttendanceRecognizeResponse,
    AttendanceListResponse,
    CheckoutResponse,
)
from . import service

router = APIRouter(prefix="/attendance", tags=["Attendance"])




@router.post(
    "/recognize",
    response_model=APIResponse[AttendanceRecognizeResponse],
    status_code=200,
    summary="Nhận diện khuôn mặt và ghi nhận điểm danh (Workflow 3)",
    description="""
    Endpoint chính – được gọi bởi camera/kiosk để điểm danh tự động.

    **Flow**:
    1. Camera gửi ảnh khuôn mặt + cameraId + timestamp.
    2. Rekognition SearchFacesByImage → tìm FaceId.
    3. Rule Engine kiểm tra ca học, trùng lặp, thời gian.
    4. Lưu Attendance Record vào DynamoDB.
    5. Publish `AttendanceRecorded` lên EventBridge.

    **Exception flows**:
    - Unknown face → `UnknownFaceDetected` event, 404 (ATTEND_001).
    - Duplicate → idempotent 200 response (ATTEND_002).
    - Outside session → 200 với rejected status (ATTEND_003).
    - Rekognition timeout → 503 (AWS_001).
    """,
)
def recognize_attendance(payload: AttendanceRecognizeRequest):
    data = service.recognize_and_record(payload)
    return APIResponse.ok(data)


@router.get(
    "",
    response_model=APIResponse[AttendanceListResponse],
    summary="Lấy lịch sử điểm danh",
)
def list_attendance(
    user_id: Optional[str] = Query(None, description="Lọc theo User ID"),
    date: Optional[str] = Query(None, description="Lọc theo ngày (YYYY-MM-DD)"),
):
    items = service.list_attendance(user_id=user_id, date=date)
    data = AttendanceListResponse(items=items, total=len(items))
    return APIResponse.ok(data)


@router.post(
    "/wfh-checkin",
    response_model=APIResponse[dict],
    summary="Điểm danh WFH (chỉ cho phép nếu đã có request WFH được duyệt hôm nay)",
)
def wfh_checkin(
    user_id: str = Query(..., description="User ID của nhân viên"),
):
    data = service.wfh_checkin(user_id)
    return APIResponse.ok(data)


@router.post(
    "/checkout",
    response_model=APIResponse[CheckoutResponse],
    summary="Checkout cuối ngày (16:30 – 18:30)",
    description="""
    Nhân viên tự checkout cuối ngày. Chỉ được phép trong khung 16h30–18h30.

    **Điều kiện**:
    - Đã Check-in hôm nay.
    - Chưa Checkout hôm nay.
    - Thời gian hiện tại trong khung 16:30–18:30 (giờ VN).
    """,
)
def checkout(
    user_id: str = Query(..., description="User ID của nhân viên"),
):
    data = service.record_checkout(user_id)
    return APIResponse.ok(data)


@router.post(
    "/checkout/proxy",
    response_model=APIResponse[CheckoutResponse],
    summary="Checkout hộ (chỉ Admin / Manager)",
    description="""
    Admin hoặc Manager checkout hộ cho nhân viên quên checkout.
    Áp dụng đúng các rule nghiệp vụ giống tự checkout.
    """,
)
def checkout_proxy(
    target_user_id: str = Query(..., description="User ID của nhân viên cần checkout hộ"),
    requester_role: str = Query(..., description="Role của người thực hiện (ADMIN/DIRECTOR/MANAGER)"),
):
    allowed_roles = {"ADMIN", "DIRECTOR", "MANAGER"}
    if requester_role.upper() not in allowed_roles:
        from app.core.responses import APIResponse as _R
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Chỉ Admin/Manager được phép checkout hộ.")
    data = service.record_checkout(target_user_id)
    return APIResponse.ok(data)
