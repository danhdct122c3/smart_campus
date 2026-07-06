"""Notification Worker (Workflow 4).

Listens to EventBridge events and sends notifications via SNS/Webhook.
This Lambda handler is triggered by EventBridge rules.

Supported channels:
    - Email (via SNS subscription)
    - SMS (via SNS subscription)
    - Mobile Push (via SNS)
    - Microsoft Teams / Slack (via Webhook – Phase 3 extension)

Consumed events:
    - AttendanceRecorded
    - FaceRegistered
    - UnknownFaceDetected

Published events:
    - NotificationSent
    - NotificationFailed
"""

import json
import logging

from app.core.config import settings
from app.shared.aws.sns import publish_attendance_notification
from app.shared.aws.eventbridge import publish_event

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


# ── Notification templates ─────────────────────────────────────────────────────

TEMPLATES: dict[str, str] = {
    "AttendanceRecorded": (
        "Diem danh thanh cong!\n"
        "User: {userId}\n"
        "Trang thai: {status}\n"
        "Phong: {roomId}\n"
        "Thoi gian: {timestamp}"
    ),
    "UnknownFaceDetected": (
        "[CANH BAO] Phat hien khuon mat la!\n"
        "Camera: {cameraId}\n"
        "Thoi gian: {timestamp}"
    ),
    "FaceRegistered": (
        "Dang ky khuon mat thanh cong!\n"
        "User: {userId}\n"
        "FaceId: {faceId}\n"
        "Do chinh xac: {confidence:.1f}%"
    ),
}


def _format_message(detail_type: str, detail: dict) -> str:
    template = TEMPLATES.get(detail_type, "Su kien: {detail_type}\n{detail}")
    try:
        return template.format(detail_type=detail_type, detail=detail, **detail)
    except KeyError:
        return f"Smart Campus Event: {detail_type}\n{json.dumps(detail, ensure_ascii=False)}"


def _send_to_sns(topic_arn: str, detail_type: str, detail: dict) -> str:
    """Send a formatted notification to SNS topic."""
    message = _format_message(detail_type, detail)
    return publish_attendance_notification(topic_arn, {"message": message, **detail})


# ── Lambda Handler ─────────────────────────────────────────────────────────────

def handler(event: dict, context) -> dict:
    """
    AWS Lambda entry point for Notification Worker.

    EventBridge invokes this Lambda with:
    {
        "source": "smart-campus.api",
        "detail-type": "AttendanceRecorded",
        "detail": { ... }
    }
    """
    detail_type = event.get("detail-type", "")
    detail = event.get("detail", {})

    logger.info("NotificationWorker received: %s", detail_type)

    topic_arn = settings.notification_topic_arn
    if not topic_arn:
        logger.warning("NOTIFICATION_TOPIC_ARN not configured – skipping SNS publish.")
        return {"status": "skipped", "reason": "no_topic_arn"}

    try:
        message_id = _send_to_sns(topic_arn, detail_type, detail)
        logger.info("Notification sent. MessageId=%s", message_id)

        # Publish NotificationSent event (for audit trail)
        publish_event(
            detail_type="NotificationSent",
            detail={"snsMessageId": message_id, "originalEvent": detail_type},
        )

        return {"status": "sent", "messageId": message_id}

    except Exception as exc:
        logger.error("Failed to send notification: %s", exc, exc_info=True)

        # Publish NotificationFailed event
        try:
            publish_event(
                detail_type="NotificationFailed",
                detail={"error": str(exc), "originalEvent": detail_type},
            )
        except Exception:
            pass

        raise  # Re-raise so Lambda retries / sends to DLQ
