"""Business logic for Attendance Recognition (Workflow 3 – the most critical workflow).

Full flow:
    Step 1  Camera/Kiosk sends image + cameraId + timestamp.
    Step 2  Image reaches API Gateway → Lambda.
    Step 3  Validate: auth, cameraId, timestamp, image format.
    Step 4  Send image to Rekognition SearchFacesByImage.
    Step 5  Lookup User Metadata.
           Apply Rule Engine: duplicate / session / time / room / policy.
    Step 6  If valid → save Attendance Record to DynamoDB.
    Step 7  Publish AttendanceRecorded → EventBridge.
    Step 8  Consumers: Notification, Analytics, Audit, AI, Security.

Exception flows:
    - Rekognition timeout → propagate as 503 (caller may retry → DLQ).
    - Unknown face       → publish UnknownFaceDetected, return 404.
    - Duplicate          → return 200 with is_duplicate=True (idempotent).
    - Outside session    → return 200 with rejected status.
"""

import base64
import uuid
from datetime import datetime, timezone

from fastapi import status

from app.core.config import settings
from app.core.exceptions import AppException, ErrorCode
from app.shared.aws import (
    rekognition as reko,
    publish_attendance_recorded,
    publish_unknown_face_detected,
    publish_attendance_rejected,
)
from app.modules.users import service as user_service
from app.modules.faces import repository as face_repo
from .schemas import (
    AttendanceRecognizeRequest,
    AttendanceRecognizeResponse,
    AttendanceRecord,
)
from . import repository as repo
from .rule_engine import evaluate


_ALLOWED_MAGIC = {b"\xff\xd8\xff", b"\x89PNG"}
_MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


def _decode_image(image_base64: str) -> bytes:
    if "," in image_base64:
        image_base64 = image_base64.split(",", 1)[1]
    try:
        data = base64.b64decode(image_base64)
    except Exception:
        raise AppException(
            error_code=ErrorCode.ATTENDANCE_INVALID_IMAGE,
            status_code=status.HTTP_400_BAD_REQUEST,
            message="Dữ liệu ảnh base64 không hợp lệ.",
        )
    if len(data) > _MAX_SIZE_BYTES:
        raise AppException(
            error_code=ErrorCode.ATTENDANCE_INVALID_IMAGE,
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            message="Ảnh vượt quá kích thước tối đa 5 MB.",
        )
    if not any(data[: len(magic)] == magic for magic in _ALLOWED_MAGIC):
        raise AppException(
            error_code=ErrorCode.ATTENDANCE_INVALID_IMAGE,
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            message="Định dạng ảnh không được hỗ trợ. Chỉ chấp nhận JPEG và PNG.",
        )
    return data


def recognize_and_record(payload: AttendanceRecognizeRequest) -> AttendanceRecognizeResponse:
    """Execute Workflow 3 end-to-end."""

    # ── Step 3: Validate ──────────────────────────────────────────────────────
    image_bytes = _decode_image(payload.image_base64)

    capture_time: datetime
    if payload.timestamp:
        try:
            capture_time = datetime.fromisoformat(payload.timestamp)
        except ValueError:
            raise AppException(
                error_code=ErrorCode.ATTENDANCE_INVALID_TIMESTAMP,
                status_code=status.HTTP_400_BAD_REQUEST,
                message="Định dạng timestamp không hợp lệ. Sử dụng ISO-8601 (VD: 2026-07-06T09:00:00Z).",
            )
    else:
        capture_time = datetime.now(timezone.utc)

    date_str = capture_time.strftime("%Y-%m-%d")

    # ── Step 4: Rekognition SearchFacesByImage ────────────────────────────────
    try:
        match = reko.search_faces_by_image(image_bytes, threshold=80.0)
    except reko.NoFaceDetectedError:
        raise AppException(
            error_code=ErrorCode.FACE_NO_FACE_DETECTED,
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            message="Không phát hiện khuôn mặt trong ảnh.",
        )
    except reko.FaceNotFoundError:
        # Unknown face – publish event and return 404
        s3_key = f"attendance/unknown/{payload.camera_id}/{capture_time.isoformat()}.jpg"
        try:
            publish_unknown_face_detected(
                camera_id=payload.camera_id,
                s3_key=s3_key,
                timestamp=capture_time.isoformat(),
            )
        except Exception:
            pass
        raise AppException(
            error_code=ErrorCode.ATTENDANCE_UNKNOWN_FACE,
            status_code=status.HTTP_404_NOT_FOUND,
            message="Không nhận diện được khuôn mặt. Sự kiện UnknownFaceDetected đã được ghi nhận.",
        )
    except reko.RekognitionError as exc:
        raise AppException(
            error_code=ErrorCode.AWS_REKOGNITION_ERROR,
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            message=f"Lỗi dịch vụ Rekognition: {exc}",
        )

    user_id = match["userId"]
    face_id = match["faceId"]
    confidence = match["similarity"]

    # ── Step 5a: Get user metadata ────────────────────────────────────────────
    user = user_service.get_user(user_id)   # raises AppException 404 if user deleted

    # ── Step 5b: Rule Engine ──────────────────────────────────────────────────
    existing = None
    rule = evaluate(capture_time, existing_record=None)  # first check session
    if rule.allowed:
        existing = repo.get_record(date_str, rule.session_name, user_id)
        rule = evaluate(capture_time, existing_record=existing)

    if not rule.allowed:
        # Policy rejection – still publish event so consumers know
        try:
            publish_attendance_rejected(
                user_id=user_id,
                reason=rule.reason,
                camera_id=payload.camera_id,
            )
        except Exception:
            pass

        is_duplicate = "duplicate" in rule.reason.lower()
        if is_duplicate and existing:
            # Return the existing record (idempotent response)
            return AttendanceRecognizeResponse(
                success=True,
                message="Điểm danh đã được ghi nhận trước đó (bỏ qua trùng lặp).",
                attendance=_item_to_record(existing, is_duplicate=True),
            )

        return AttendanceRecognizeResponse(
            success=False,
            message=rule.reason,
            attendance=None,
        )

    # ── Step 6: Save attendance record ────────────────────────────────────────
    attendance_id = str(uuid.uuid4())
    item = {
        "pk": repo.make_pk(date_str, rule.session_name),
        "userId": user_id,
        "attendanceId": attendance_id,
        "faceId": face_id,
        "cameraId": payload.camera_id,
        "roomId": payload.room_id,
        "sessionType": rule.session_name,
        "status": rule.status,
        "confidence": str(confidence),
        "timestamp": capture_time.isoformat(),
        "date": date_str,
    }
    repo.save_record(item)

    # ── Step 7: Publish AttendanceRecorded ────────────────────────────────────
    try:
        publish_attendance_recorded(
            attendance_id=attendance_id,
            user_id=user_id,
            camera_id=payload.camera_id,
            room_id=payload.room_id,
            status=rule.status,
            timestamp=capture_time.isoformat(),
        )
    except Exception:
        pass  # Non-critical

    return AttendanceRecognizeResponse(
        success=True,
        message=f"Điểm danh thành công: {rule.status}",
        attendance=_item_to_record(item),
    )


def list_attendance(user_id: str | None, date: str | None) -> list[AttendanceRecord]:
    """Query attendance history."""
    if not user_id and not date:
        raise AppException(
            error_code=ErrorCode.ATTENDANCE_MISSING_FILTER,
            status_code=status.HTTP_400_BAD_REQUEST,
            message="Vui lòng cung cấp ít nhất một trong hai tham số: user_id hoặc date.",
        )

    if user_id:
        items = repo.list_by_user(user_id, date=date)
    else:
        from .rule_engine import SESSIONS
        items = []
        for session in SESSIONS:
            items.extend(repo.list_by_date_session(date, session.name))
    return [_item_to_record(i) for i in items]


def _item_to_record(item: dict, is_duplicate: bool = False) -> AttendanceRecord:
    return AttendanceRecord(
        attendance_id=item.get("attendanceId", ""),
        user_id=item["userId"],
        face_id=item.get("faceId", ""),
        camera_id=item.get("cameraId", ""),
        room_id=item.get("roomId", ""),
        session_type=item.get("sessionType", ""),
        status=item.get("status", "PRESENT"),
        confidence=float(item.get("confidence", 0)),
        timestamp=item.get("timestamp", ""),
        date=item.get("date", ""),
        is_duplicate=is_duplicate,
    )
