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
from datetime import datetime, timezone, timedelta

from fastapi import status

from app.core.config import settings
from app.core.exceptions import AppException, ErrorCode
from app.shared.aws import (
    rekognition as reko,
    publish_attendance_recorded,
    publish_unknown_face_detected,
    publish_attendance_rejected,
    ses,
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
        raise AppException(ErrorCode.ATTENDANCE_INVALID_IMAGE)
    if len(data) > _MAX_SIZE_BYTES:
        raise AppException(
            ErrorCode.ATTENDANCE_INVALID_IMAGE,
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
        )
    if not any(data[: len(magic)] == magic for magic in _ALLOWED_MAGIC):
        raise AppException(
            ErrorCode.ATTENDANCE_INVALID_IMAGE,
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
        )
    return data



def recognize_and_record(payload: AttendanceRecognizeRequest) -> AttendanceRecognizeResponse:

    """Execute Workflow 3 end-to-end."""

    # ── Step 3: Validate ──────────────────────────────────────────────────────
    image_bytes = _decode_image(payload.image_base64)

    capture_time: datetime
    if payload.timestamp:
        try:
            ts_str = payload.timestamp
            if ts_str.endswith("Z"):
                ts_str = ts_str[:-1] + "+00:00"
            capture_time = datetime.fromisoformat(ts_str)
        except ValueError:
            raise AppException(ErrorCode.ATTENDANCE_INVALID_TIMESTAMP)
    else:
        capture_time = datetime.now(timezone.utc)

    # Convert to local Vietnam timezone (UTC+7) for consistent date and session evaluation
    vietnam_tz = timezone(timedelta(hours=7))
    if capture_time.tzinfo is not None:
        capture_time = capture_time.astimezone(vietnam_tz)
    else:
        capture_time = capture_time.replace(tzinfo=timezone.utc).astimezone(vietnam_tz)

    date_str = capture_time.strftime("%Y-%m-%d")

    # ── Step 4: Rekognition SearchFacesByImage ────────────────────────────────
    try:
        match = reko.search_faces_by_image(image_bytes, threshold=80.0)
    except reko.NoFaceDetectedError:
        raise AppException(ErrorCode.FACE_NO_FACE_DETECTED)
    except reko.FaceNotFoundError:
        # Unknown face – publish event and return 404
        s3_key = f"attendance/unknown/{payload.camera_id}/{capture_time.isoformat()}.jpg"
        try:
            publish_unknown_face_detected(
                camera_id=payload.camera_id,
                s3_key=s3_key,
                timestamp=local_time.isoformat(),
            )
        except Exception:
            pass
        raise AppException(ErrorCode.ATTENDANCE_UNKNOWN_FACE)
    except reko.RekognitionError as exc:
        raise AppException(
            ErrorCode.AWS_REKOGNITION_ERROR,
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
        "record_id": attendance_id,
        "user_id": user_id,
        "attendance_id": attendance_id,
        "face_id": face_id,
        "camera_id": payload.camera_id,
        "room_id": payload.room_id,
        "session_type": rule.session_name,
        "status": rule.status,
        "confidence": str(confidence),
        "timestamp": local_time.isoformat(),
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
            timestamp=local_time.isoformat(),
        )
    except Exception:
        pass  # Non-critical

    # ── Step 8: Send personal email via SES ───────────────────────────────────
    if user.email:
        try:
            ses.send_attendance_email(
                to_email=user.email,
                user_name=user.name,
                timestamp=local_time.isoformat(),
                room_id=payload.room_id,
                status=rule.status,
                session_type=rule.session_name,
            )
        except Exception:
            pass

    return AttendanceRecognizeResponse(
        success=True,
        message=f"Điểm danh thành công: {rule.status}",
        attendance=_item_to_record(item),
    )


def list_attendance(user_id: str | None, date: str | None) -> list[AttendanceRecord]:
    """Query attendance history."""
    if not user_id and not date:
        raise AppException(ErrorCode.ATTENDANCE_MISSING_FILTER)

    if user_id:
        items = repo.list_by_user(user_id, date=date)
    else:
        from .rule_engine import SESSIONS
        items = []
        for session in SESSIONS:
            items.extend(repo.list_by_date_session(date, session.name))
    return [_item_to_record(i) for i in items]


def wfh_checkin(user_id: str) -> dict:
    """WFH self check-in — chỉ cho phép nếu ngày hôm nay có WFH được duyệt."""
    from datetime import datetime, timezone, timedelta
    vietnam_tz = timezone(timedelta(hours=7))
    today = datetime.now(vietnam_tz).strftime("%Y-%m-%d")

    # Kiểm tra có WFH approved hôm nay không
    from app.modules.leaves.service import get_day_status
    day_status = get_day_status(user_id, today)
    if not day_status.wfh_approved:
        raise AppException(
            ErrorCode.VALIDATION_ERROR,
            message="Bạn chưa có đăng ký WFH được duyệt cho hôm nay.",
        )

    # Kiểm tra đã điểm danh WFH hôm nay chưa (idempotency)
    from app.shared.aws.dynamodb import scan_items
    from boto3.dynamodb.conditions import Attr
    from app.core.config import settings
    existing = scan_items(
        settings.attendance_table,
        filter_expression=(
            Attr("user_id").eq(user_id) &
            Attr("date").eq(today) &
            Attr("session_type").eq("WFH")
        )
    )
    if existing:
        return {"message": "Điểm danh WFH hôm nay đã được ghi nhận trước đó.", "already_checked": True}

    # Ghi record WFH
    import uuid
    now_iso = datetime.now(vietnam_tz).isoformat()
    attendance_id = str(uuid.uuid4())
    item = {
        "record_id":     attendance_id,
        "attendance_id": attendance_id,
        "user_id":       user_id,
        "face_id":       "WFH",
        "camera_id":     "WFH_SELF_CHECKIN",
        "room_id":       "WFH",
        "session_type":  "WFH",
        "status":        "PRESENT",
        "confidence":    "100",
        "timestamp":     now_iso,
        "date":          today,
    }
    repo.save_record(item)
    return {"message": "Điểm danh WFH thành công!", "already_checked": False, "date": today}



def _item_to_record(item: dict, is_duplicate: bool = False) -> AttendanceRecord:
    return AttendanceRecord(
        attendance_id=item.get("attendance_id") or item.get("attendanceId", ""),
        user_id=item.get("user_id") or item.get("userId", ""),
        face_id=item.get("face_id") or item.get("faceId", ""),
        camera_id=item.get("camera_id") or item.get("cameraId", ""),
        room_id=item.get("room_id") or item.get("roomId", ""),
        session_type=item.get("session_type") or item.get("sessionType", ""),
        status=item.get("status", "PRESENT"),
        confidence=float(item.get("confidence", 0)),
        timestamp=item.get("timestamp", ""),
        date=item.get("date", ""),
        is_duplicate=is_duplicate,
    )
