"""Notification Worker (Workflow 4).

Listens to EventBridge events via SQS and routes to the appropriate channel:
1. Personal / 1-to-1 Notifications (Attendance, Checkout, Tasks) -> Amazon SES (Direct HTML Email)
2. Urgent / Security Broadcast Notifications (UnknownFaceDetected, SecurityIncidents) -> Amazon SNS Topic
"""

import json
import logging

from app.core.config import settings
from app.shared.aws import ses
from app.shared.aws.sns import publish_to_topic, publish_attendance_notification
from app.shared.aws.eventbridge import publish_event
from app.modules.users import repository as user_repo

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


# ── Security Alert templates (For Amazon SNS Broadcast) ─────────────────────────

TEMPLATES: dict[str, str] = {
    "UnknownFaceDetected": (
        "[CẢNH BÁO AN NINH] Phát hiện khuôn mặt lạ không xác định!\n"
        "Camera: {cameraId}\n"
        "Thời gian: {formatted_timestamp}\n"
        "S3 Key: {s3Key}\n"
        "Vui lòng kiểm tra camera an ninh ngay lập tức."
    ),
    "FaceRegistered": (
        "Đăng ký khuôn mặt thành công!\n"
        "User: {userId}\n"
        "FaceId: {faceId}\n"
        "Độ chính xác: {confidence:.1f}%"
    ),
}


def _format_message(detail_type: str, detail: dict) -> str:
    if "timestamp" in detail:
        try:
            from datetime import datetime, timezone, timedelta
            ts = detail["timestamp"]
            if ts.endswith("Z"):
                ts = ts[:-1] + "+00:00"
            dt = datetime.fromisoformat(ts).astimezone(timezone(timedelta(hours=7)))
            detail["formatted_timestamp"] = dt.strftime("%Hh%Mp %d/%m/%Y")
        except Exception:
            detail["formatted_timestamp"] = detail.get("timestamp", "")
    
    template = TEMPLATES.get(detail_type, "Smart Campus Event: {detail_type}\n{detail}")
    try:
        return template.format(detail_type=detail_type, detail=detail, **detail)
    except KeyError:
        return f"Smart Campus Event: {detail_type}\n{json.dumps(detail, ensure_ascii=False)}"


def _send_to_sns(topic_arn: str, detail_type: str, detail: dict) -> str:
    """Send an urgent/broadcast notification to SNS topic."""
    message = _format_message(detail_type, detail)
    subject = f"[Smart Campus Alert] {detail_type}"
    return publish_to_topic(topic_arn, subject=subject, message=message)


def _handle_attendance_recorded(detail: dict) -> None:
    """Send personal 1-to-1 confirmation email via Amazon SES."""
    user_id = detail.get("userId")
    user_email = detail.get("userEmail")
    user_name = detail.get("userName") or "Bạn"
    status = detail.get("status", "PRESENT")
    timestamp = detail.get("timestamp", "")
    session_type = detail.get("sessionType", "MORNING")

    # If email wasn't passed in detail, lookup user in DynamoDB
    if not user_email and user_id:
        try:
            user = user_repo.get_user_by_id(user_id)
            if user:
                user_email = user.get("email")
                if not user_name:
                    user_name = user.get("name") or "Bạn"
        except Exception as e:
            logger.warning("Could not lookup user %s: %s", user_id, e)

    if user_email:
        logger.info("Sending personal attendance email via SES to %s (%s)", user_name, user_email)
        ses.send_attendance_email(
            to_email=user_email,
            user_name=user_name,
            timestamp=timestamp,
            status=status,
            session_type=session_type,
        )
    else:
        logger.warning("No email found for user %s, skipping SES attendance email.", user_id)


def _handle_attendance_checkout(detail: dict) -> None:
    """Send personal 1-to-1 checkout email via Amazon SES."""
    user_id = detail.get("userId")
    user_email = detail.get("userEmail")
    user_name = detail.get("userName") or "Bạn"
    checkout_time = detail.get("checkoutTime") or detail.get("timestamp", "")
    session_type = detail.get("sessionType", "MORNING")

    if not user_email and user_id:
        try:
            user = user_repo.get_user_by_id(user_id)
            if user:
                user_email = user.get("email")
                if not user_name:
                    user_name = user.get("name") or "Bạn"
        except Exception as e:
            logger.warning("Could not lookup user %s: %s", user_id, e)

    if user_email:
        logger.info("Sending personal checkout email via SES to %s (%s)", user_name, user_email)
        ses.send_checkout_email(
            to_email=user_email,
            user_name=user_name,
            checkout_time=checkout_time,
            session_type=session_type,
        )


# ── Lambda Handler ─────────────────────────────────────────────────────────────

def handler(event: dict, context) -> dict:
    """
    AWS Lambda entry point for Notification Worker.
    SQS invokes this Lambda with a batch of messages from EventBridge.
    """
    records = event.get("Records", [])
    logger.info("NotificationWorker (SQS) received %d records", len(records))

    failed_message_ids = []

    for record in records:
        sqs_message_id = record.get("messageId")
        try:
            body_str = record.get("body", "{}")
            eb_event = json.loads(body_str)

            detail_type = eb_event.get("detail-type", "")
            detail = eb_event.get("detail", {})

            logger.info("Processing SQS message %s: %s", sqs_message_id, detail_type)

            # ── ROUTING LOGIC: SES (Personal) vs SNS (Broadcast/Security) ─────────
            if detail_type == "AttendanceRecorded":
                _handle_attendance_recorded(detail)
            elif detail_type == "AttendanceCheckOut":
                _handle_attendance_checkout(detail)
            elif detail_type in ["UnknownFaceDetected", "SecurityIncidentCreated"]:
                topic_arn = settings.security_alert_topic_arn or settings.notification_topic_arn
                if topic_arn:
                    _send_to_sns(topic_arn, detail_type, detail)
                else:
                    logger.warning("No SNS topic configured for security alert %s", detail_type)
            else:
                # Các thông báo broadcast khác nếu có SNS Topic
                if settings.notification_topic_arn:
                    _send_to_sns(settings.notification_topic_arn, detail_type, detail)

            # Ghi nhận sự kiện audit trail
            publish_event(
                detail_type="NotificationSent",
                detail={"originalEvent": detail_type, "status": "SUCCESS"},
            )

        except Exception as exc:
            logger.error("Failed to process message %s: %s", sqs_message_id, exc, exc_info=True)
            failed_message_ids.append(sqs_message_id)
            try:
                publish_event(
                    detail_type="NotificationFailed",
                    detail={"error": str(exc), "originalEvent": detail_type},
                )
            except Exception:
                pass

    return {
        "batchItemFailures": [{"itemIdentifier": msg_id} for msg_id in failed_message_ids]
    }
