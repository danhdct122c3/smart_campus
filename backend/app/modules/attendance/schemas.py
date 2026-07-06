"""Pydantic schemas for the Attendance module (Workflow 3)."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class AttendanceStatus(str, Enum):
    PRESENT = "PRESENT"
    LATE = "LATE"
    ABSENT = "ABSENT"


class AttendanceSessionType(str, Enum):
    MORNING = "MORNING"    # 07:00 – 12:00
    AFTERNOON = "AFTERNOON"  # 13:00 – 17:30
    EVENING = "EVENING"    # 17:30 – 21:00


# ── Request models ─────────────────────────────────────────────────────────────

class AttendanceRecognizeRequest(BaseModel):
    """Payload sent by a camera or kiosk device."""
    camera_id: str = Field(..., description="Unique ID of the registered camera/kiosk")
    room_id: str = Field(..., description="Room or location identifier")
    image_base64: str = Field(..., description="Base64-encoded face image (JPEG/PNG)")
    timestamp: Optional[str] = Field(
        None,
        description="ISO-8601 timestamp of the capture (defaults to server time)",
    )


# ── Response models ────────────────────────────────────────────────────────────

class AttendanceRecord(BaseModel):
    attendance_id: str
    user_id: str
    face_id: str
    camera_id: str
    room_id: str
    session_type: str
    status: AttendanceStatus
    confidence: float
    timestamp: str
    date: str
    is_duplicate: bool = False


class AttendanceRecognizeResponse(BaseModel):
    success: bool
    message: str
    attendance: Optional[AttendanceRecord] = None


class AttendanceListResponse(BaseModel):
    items: list[AttendanceRecord]
    total: int


class AttendanceQueryParams(BaseModel):
    user_id: Optional[str] = None
    date: Optional[str] = None          # YYYY-MM-DD
    room_id: Optional[str] = None
    status: Optional[AttendanceStatus] = None
