"""Business logic for the Notifications module (Workflow 4).

Flow:
    1. EventBridge triggers Lambda with AttendanceRecorded / AttendanceRejected event.
    2. Notification Service xác định loại thông báo cần gửi.
    3. Nội dung được tạo từ template tương ứng.
    4. Thông báo được gửi qua SNS (Email/SMS/Push).
    5. Trạng thái gửi được ghi vào DynamoDB để theo dõi.

Supported channels: EMAIL, SMS, PUSH (via SNS), TEAMS, SLACK, WEBHOOK.
"""

import uuid
from datetime import datetime, timezone

from fastapi import status

from app.core.config import settings
from app.core.exceptions import AppException, ErrorCode
from app.shared.aws import (
    publish_notification_sent,
    publish_to_topic,
)
from .schemas import (
    NotificationChannel,
    NotificationEventType,
    NotificationRecord,
    NotificationStatus,
    SendNotificationRequest,
)
from . import repository as repo


# ── Message templates ──────────────────────────────────────────────────────────

_TEMPLATES: dict[NotificationEventType, dict] = {
    NotificationEventType.ATTENDANCE_RECORDED: {
        "subject": "[Smart Campus] Điểm danh thành công",
        "message": "Bạn đã được ghi nhận điểm danh lúc {timestamp} tại phòng {room_id}. Trạng thái: {status}.",
    },
    NotificationEventType.ATTENDANCE_REJECTED: {
        "subject": "[Smart Campus] Điểm danh bị từ chối",
        "message": "Yêu cầu điểm danh của bạn bị từ chối. Lý do: {reason}.",
    },
    NotificationEventType.UNKNOWN_FACE: {
        "subject": "[Smart Campus] Cảnh báo: Phát hiện khuôn mặt lạ",
        "message": "Hệ thống phát hiện khuôn mặt không xác định tại camera {camera_id} lúc {timestamp}.",
    },
    NotificationEventType.SECURITY_ALERT: {
        "subject": "[Smart Campus] Cảnh báo an ninh",
        "message": "Sự cố an ninh [{risk_level}]: {description}. Vui lòng kiểm tra ngay.",
    },
    NotificationEventType.CUSTOM: {
        "subject": "[Smart Campus] Thông báo",
        "message": "{message}",
    },
    NotificationEventType.TASK_ASSIGNED: {
        "subject": "[Smart Campus] Bạn có công việc mới",
        "message": "Bạn vừa được giao công việc \"{task_title}\" bởi {reporter_name}. Hãy kiểm tra và bắt đầu thực hiện.",
    },
    NotificationEventType.TASK_STATUS_CHANGED: {
        "subject": "[Smart Campus] Cập nhật trạng thái công việc",
        "message": "Công việc \"{task_title}\" đã được cập nhật sang trạng thái: {new_status}.",
    },
    NotificationEventType.TASK_SUBMITTED: {
        "subject": "[Smart Campus] Công việc đã được nộp báo cáo",
        "message": "{assignee_name} đã nộp báo cáo cho công việc \"{task_title}\". Vui lòng kiểm tra và duyệt.",
    },
    NotificationEventType.TASK_COMPLETED: {
        "subject": "[Smart Campus] Công việc đã hoàn thành",
        "message": "Công việc \"{task_title}\" đã được duyệt hoàn thành.",
    },
    NotificationEventType.INCIDENT_REPORTED: {
        "subject": "[Smart Campus] Sự cố mới cần xử lý",
        "message": "{reporter_name} vừa báo cáo sự cố \"{task_title}\". Vui lòng kiểm tra và phân công xử lý.",
    },
}


def _build_message(event_type: NotificationEventType, context: dict) -> dict:
    """Fill template with context data."""
    template = _TEMPLATES.get(event_type, _TEMPLATES[NotificationEventType.CUSTOM])
    try:
        subject = template["subject"].format(**context)
        message = template["message"].format(**context)
    except KeyError:
        subject = template["subject"]
        message = template["message"]
    return {"subject": subject, "message": message}


def _persist_and_notify(
    user_id: str,
    channel: NotificationChannel,
    event_type: NotificationEventType,
    subject: str,
    message: str,
    status_val: NotificationStatus = NotificationStatus.SENT,
    error_message: str | None = None,
) -> NotificationRecord:
    """Save record to DynamoDB and publish NotificationSent event."""
    now = datetime.now(timezone.utc).isoformat()
    notification_id = str(uuid.uuid4())

    item = {
        "notificationId": notification_id,
        "userId": user_id,
        "channel": channel.value,
        "eventType": event_type.value,
        "subject": subject,
        "message": message,
        "status": status_val.value,
        "sentAt": now,
        "errorMessage": error_message,
    }
    repo.save_notification(item)

    # Publish NotificationSent event (non-critical)
    try:
        if status_val == NotificationStatus.SENT:
            publish_notification_sent(
                notification_id=notification_id,
                user_id=user_id,
                channel=channel.value,
                event_type=event_type.value,
            )
    except Exception:
        pass

    return _to_record(item)


def send_attendance_notification(
    user_id: str,
    timestamp: str,
    room_id: str,
    attendance_status: str,
    channel: NotificationChannel = NotificationChannel.EMAIL,
) -> NotificationRecord:
    """Called when AttendanceRecorded event is received (WF4 trigger)."""
    content = _build_message(
        NotificationEventType.ATTENDANCE_RECORDED,
        {"timestamp": timestamp, "room_id": room_id, "status": attendance_status},
    )

    error_msg = None
    final_status = NotificationStatus.SENT
    try:
        if settings.notification_topic_arn:
            publish_to_topic(
                topic_arn=settings.notification_topic_arn,
                subject=content["subject"],
                message=content["message"],
            )
    except Exception as exc:
        error_msg = str(exc)
        final_status = NotificationStatus.FAILED

    return _persist_and_notify(
        user_id=user_id,
        channel=channel,
        event_type=NotificationEventType.ATTENDANCE_RECORDED,
        subject=content["subject"],
        message=content["message"],
        status_val=final_status,
        error_message=error_msg,
    )


def send_rejection_notification(
    user_id: str,
    reason: str,
    channel: NotificationChannel = NotificationChannel.EMAIL,
) -> NotificationRecord:
    """Called when AttendanceRejected event is received (WF4 trigger)."""
    content = _build_message(
        NotificationEventType.ATTENDANCE_REJECTED,
        {"reason": reason},
    )

    error_msg = None
    final_status = NotificationStatus.SENT
    try:
        if settings.notification_topic_arn:
            publish_to_topic(
                topic_arn=settings.notification_topic_arn,
                subject=content["subject"],
                message=content["message"],
            )
    except Exception as exc:
        error_msg = str(exc)
        final_status = NotificationStatus.FAILED

    return _persist_and_notify(
        user_id=user_id,
        channel=channel,
        event_type=NotificationEventType.ATTENDANCE_REJECTED,
        subject=content["subject"],
        message=content["message"],
        status_val=final_status,
        error_message=error_msg,
    )


def send_task_notification(
    user_id: str,
    event_type: NotificationEventType,
    context: dict,
    channel: NotificationChannel = NotificationChannel.PUSH,
) -> NotificationRecord:
    """Send a task-related notification to a user."""
    content = _build_message(event_type, context)

    error_msg = None
    final_status = NotificationStatus.SENT
    try:
        if settings.notification_topic_arn:
            publish_to_topic(
                topic_arn=settings.notification_topic_arn,
                subject=content["subject"],
                message=content["message"],
            )
    except Exception as exc:
        error_msg = str(exc)
        final_status = NotificationStatus.FAILED

    return _persist_and_notify(
        user_id=user_id,
        channel=channel,
        event_type=event_type,
        subject=content["subject"],
        message=content["message"],
        status_val=final_status,
        error_message=error_msg,
    )


def send_custom_notification(payload: SendNotificationRequest) -> NotificationRecord:
    """REST API: Admin gửi thông báo thủ công."""
    error_msg = None
    final_status = NotificationStatus.SENT
    try:
        if settings.notification_topic_arn:
            publish_to_topic(
                topic_arn=settings.notification_topic_arn,
                subject=payload.subject,
                message=payload.message,
            )
    except Exception as exc:
        error_msg = str(exc)
        final_status = NotificationStatus.FAILED

    return _persist_and_notify(
        user_id=payload.user_id,
        channel=payload.channel,
        event_type=NotificationEventType.CUSTOM,
        subject=payload.subject,
        message=payload.message,
        status_val=final_status,
        error_message=error_msg,
    )


def list_notifications(user_id: str | None, limit: int) -> list[NotificationRecord]:
    if user_id:
        items = repo.list_by_user(user_id, limit=limit)
    else:
        items = repo.list_recent(limit=limit)
    return [_to_record(i) for i in items]


def _to_record(item: dict) -> NotificationRecord:
    return NotificationRecord(
        notification_id=item["notificationId"],
        user_id=item["userId"],
        channel=item["channel"],
        event_type=item["eventType"],
        subject=item["subject"],
        message=item["message"],
        status=item["status"],
        sent_at=item["sentAt"],
        error_message=item.get("errorMessage"),
    )
