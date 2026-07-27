"""Pydantic schemas for the Notifications module (Workflow 4)."""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class NotificationChannel(str, Enum):
    EMAIL   = "EMAIL"
    SMS     = "SMS"
    PUSH    = "PUSH"
    TEAMS   = "TEAMS"
    SLACK   = "SLACK"
    WEBHOOK = "WEBHOOK"


class NotificationStatus(str, Enum):
    SENT    = "SENT"
    FAILED  = "FAILED"
    PENDING = "PENDING"


class NotificationEventType(str, Enum):
    ATTENDANCE_RECORDED = "AttendanceRecorded"
    ATTENDANCE_REJECTED = "AttendanceRejected"
    UNKNOWN_FACE        = "UnknownFaceDetected"
    SECURITY_ALERT      = "SecurityIncidentCreated"
    TASK_ASSIGNED       = "TaskAssigned"
    TASK_STATUS_CHANGED = "TaskStatusChanged"
    TASK_SUBMITTED      = "TaskSubmitted"
    TASK_COMPLETED      = "TaskCompleted"
    INCIDENT_REPORTED   = "IncidentReported"
    CUSTOM              = "Custom"


# ── Request models ─────────────────────────────────────────────────────────────

class SendNotificationRequest(BaseModel):
    """Manual notification request (for testing or admin use)."""
    user_id: str
    channel: NotificationChannel = NotificationChannel.EMAIL
    subject: str = Field(..., min_length=1, max_length=200)
    message: str = Field(..., min_length=1, max_length=2000)


# ── Response models ────────────────────────────────────────────────────────────

class NotificationRecord(BaseModel):
    notification_id: str
    user_id: str
    channel: NotificationChannel
    event_type: NotificationEventType
    subject: str
    message: str
    status: NotificationStatus
    sent_at: str
    error_message: Optional[str] = None


class NotificationListResponse(BaseModel):
    items: list[NotificationRecord]
    total: int
