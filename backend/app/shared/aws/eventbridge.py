"""Amazon EventBridge wrapper – publish custom events."""

import json
import boto3
from datetime import datetime, timezone
from functools import lru_cache
from botocore.exceptions import ClientError

from app.core.config import settings


@lru_cache
def get_eventbridge_client():
    return boto3.client("events", region_name=settings.aws_region)


def publish_event(
    detail_type: str,
    detail: dict,
    source: str = "smart-campus.api",
    event_bus_name: str | None = None,
) -> str:
    """
    Publish a single event to EventBridge.

    Args:
        detail_type: Event type name, e.g. "FaceRegistered", "AttendanceRecorded".
        detail: Arbitrary JSON-serialisable dict that forms the event body.
        source: The source identifier (default: smart-campus.api).
        event_bus_name: Override default bus name from settings.

    Returns:
        The EventBridge event ID.

    Raises:
        RuntimeError on Boto3 errors.
    """
    bus = event_bus_name or settings.event_bus_name
    client = get_eventbridge_client()
    try:
        response = client.put_events(
            Entries=[
                {
                    "EventBusName": bus,
                    "Source": source,
                    "DetailType": detail_type,
                    "Detail": json.dumps(detail, default=str),
                    "Time": datetime.now(timezone.utc),
                }
            ]
        )
    except ClientError as exc:
        raise RuntimeError(f"EventBridge publish failed: {exc}") from exc

    entries = response.get("Entries", [])
    if entries and entries[0].get("EventId"):
        return entries[0]["EventId"]

    # EventBridge returns FailedEntryCount > 0 on partial failures
    error_code = entries[0].get("ErrorCode", "UnknownError") if entries else "EmptyResponse"
    raise RuntimeError(f"EventBridge entry failed: {error_code}")


# ── Typed event publishers ─────────────────────────────────────────────────────

def publish_face_registered(user_id: str, face_id: str, confidence: float) -> str:
    return publish_event(
        detail_type="FaceRegistered",
        detail={"userId": user_id, "faceId": face_id, "confidence": confidence},
    )


def publish_attendance_recorded(
    attendance_id: str,
    user_id: str,
    camera_id: str,
    room_id: str,
    status: str,
    timestamp: str,
) -> str:
    return publish_event(
        detail_type="AttendanceRecorded",
        detail={
            "attendanceId": attendance_id,
            "userId": user_id,
            "cameraId": camera_id,
            "roomId": room_id,
            "status": status,
            "timestamp": timestamp,
        },
    )


def publish_unknown_face_detected(camera_id: str, s3_key: str, timestamp: str) -> str:
    return publish_event(
        detail_type="UnknownFaceDetected",
        detail={"cameraId": camera_id, "s3Key": s3_key, "timestamp": timestamp},
    )


def publish_attendance_rejected(user_id: str, reason: str, camera_id: str) -> str:
    return publish_event(
        detail_type="AttendanceRejected",
        detail={"userId": user_id, "reason": reason, "cameraId": camera_id},
    )


def publish_security_incident_created(
    incident_id: str,
    risk_level: str,
    incident_type: str,
    description: str,
    camera_id: str | None = None,
    user_id: str | None = None,
) -> str:
    return publish_event(
        detail_type="SecurityIncidentCreated",
        detail={
            "incidentId": incident_id,
            "riskLevel": risk_level,
            "incidentType": incident_type,
            "description": description,
            "cameraId": camera_id,
            "userId": user_id,
        },
    )


def publish_notification_sent(
    notification_id: str,
    user_id: str,
    channel: str,
    event_type: str,
) -> str:
    return publish_event(
        detail_type="NotificationSent",
        detail={
            "notificationId": notification_id,
            "userId": user_id,
            "channel": channel,
            "eventType": event_type,
        },
    )
