"""Pydantic schemas for the Security Monitoring module (Workflow 7)."""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class RiskLevel(str, Enum):
    LOW      = "LOW"
    MEDIUM   = "MEDIUM"
    HIGH     = "HIGH"
    CRITICAL = "CRITICAL"


class IncidentType(str, Enum):
    UNKNOWN_FACE     = "UNKNOWN_FACE"       # Khuôn mặt không nhận ra
    BLACKLIST_MATCH  = "BLACKLIST_MATCH"    # Khớp với blacklist
    AFTER_HOURS      = "AFTER_HOURS"        # Truy cập ngoài giờ quy định
    RESTRICTED_AREA  = "RESTRICTED_AREA"   # Vào khu vực hạn chế
    MULTIPLE_ENTRIES = "MULTIPLE_ENTRIES"   # Nhiều lần quẹt trong thời gian ngắn


class IncidentStatus(str, Enum):
    OPEN     = "OPEN"
    RESOLVED = "RESOLVED"
    IGNORED  = "IGNORED"


# ── Request models ─────────────────────────────────────────────────────────────

class ResolveIncidentRequest(BaseModel):
    resolution_note: str = Field(..., min_length=5, max_length=500)


# ── Response models ────────────────────────────────────────────────────────────

class SecurityIncident(BaseModel):
    incident_id: str
    incident_type: IncidentType
    risk_level: RiskLevel
    status: IncidentStatus
    description: str
    camera_id: Optional[str] = None
    user_id: Optional[str] = None
    s3_key: Optional[str] = None        # Screenshot of the incident
    created_at: str
    resolved_at: Optional[str] = None
    resolution_note: Optional[str] = None


class SecurityIncidentListResponse(BaseModel):
    items: list[SecurityIncident]
    total: int
