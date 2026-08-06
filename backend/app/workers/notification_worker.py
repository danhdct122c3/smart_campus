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
    return publish_attendance_notification(topic_arn, message)


# ── Lambda Handler ─────────────────────────────────────────────────────────────

def handler(event: dict, context) -> dict:
    """
    AWS Lambda entry point for Notification Worker.

    SQS invokes this Lambda with a batch of messages.
    """
    records = event.get("Records", [])
    logger.info("NotificationWorker (SQS) received %d records", len(records))

    topic_arn = settings.notification_topic_arn
    if not topic_arn:
        logger.warning("NOTIFICATION_TOPIC_ARN not configured – skipping SNS publish.")
        # If no topic ARN, we effectively skip everything, no failures.
        return {"batchItemFailures": []}

    failed_message_ids = []

    for record in records:
        sqs_message_id = record.get("messageId")
        try:
            # EventBridge payload is embedded in the SQS body
            body_str = record.get("body", "{}")
            eb_event = json.loads(body_str)

            detail_type = eb_event.get("detail-type", "")
            detail = eb_event.get("detail", {})

            logger.info("Processing SQS message %s: %s", sqs_message_id, detail_type)

            sns_message_id = _send_to_sns(topic_arn, detail_type, detail)
            logger.info("Notification sent for SQS msg %s. SNS_MessageId=%s", sqs_message_id, sns_message_id)

            # Publish NotificationSent event (for audit trail)
            publish_event(
                detail_type="NotificationSent",
                detail={"snsMessageId": sns_message_id, "originalEvent": detail_type},
            )

        except Exception as exc:
            logger.error("Failed to process message %s: %s", sqs_message_id, exc, exc_info=True)
            failed_message_ids.append(sqs_message_id)
            
            # Publish NotificationFailed event
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
