"""FastAPI router for the Attendance module (Workflow 3)."""

from typing import Optional

from fastapi import APIRouter, Query

from app.core.responses import APIResponse
from .schemas import (
    AttendanceRecognizeRequest,
    AttendanceRecognizeResponse,
    AttendanceListResponse,
    LivenessSessionResponse,
    LivenessRecognizeRequest,
)
from . import service

router = APIRouter(prefix="/attendance", tags=["Attendance"])


@router.get(
    "/liveness/session",
    response_model=APIResponse[LivenessSessionResponse],
    status_code=200,
    summary="Tạo phiên kiểm tra Liveness",
)
def create_liveness_session():
    from app.shared.aws.rekognition import create_face_liveness_session
    session_id = create_face_liveness_session()
    data = LivenessSessionResponse(session_id=session_id)
    return APIResponse.ok(data)


@router.post(
    "/liveness/recognize",
    response_model=APIResponse[AttendanceRecognizeResponse],
    status_code=200,
    summary="Điểm danh qua kết quả Face Liveness",
)
def recognize_liveness(payload: LivenessRecognizeRequest):
    data = service.recognize_liveness_and_record(
        session_id=payload.session_id,
        camera_id=payload.camera_id,
        room_id=payload.room_id,
        timestamp_str=payload.timestamp
    )
    return APIResponse.ok(data)



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
