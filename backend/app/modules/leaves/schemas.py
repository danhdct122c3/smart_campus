"""Pydantic schemas for the Leaves & WFH module."""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class LeaveType(str, Enum):
    WFH           = "WFH"           # Work From Home (requires request + approval)
    ANNUAL_LEAVE  = "ANNUAL_LEAVE"  # Nghỉ phép năm (requires request + approval)
    SICK_LEAVE    = "SICK_LEAVE"    # Nghỉ ốm (requires request + approval)
    BUSINESS_TRIP = "BUSINESS_TRIP" # Công tác (Manager/Admin thêm trực tiếp, không cần request)


class LeaveStatus(str, Enum):
    PENDING  = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


# ── Request models ──────────────────────────────────────────────────────────────

class LeaveRequestCreate(BaseModel):
    """Nhân viên gửi request WFH / Nghỉ phép / Nghỉ ốm."""
    user_id: str
    leave_type: LeaveType
    date_from: str = Field(..., description="Ngày bắt đầu (YYYY-MM-DD)")
    date_to: str   = Field(..., description="Ngày kết thúc (YYYY-MM-DD)")
    reason: Optional[str] = None


class LeaveApprovalRequest(BaseModel):
    """Manager duyệt hoặc từ chối request."""
    approver_id: str
    note: Optional[str] = None


class BusinessTripCreate(BaseModel):
    """Manager/Admin thêm ngày công tác cho nhân viên (không cần request)."""
    user_id: str
    date_from: str = Field(..., description="Ngày bắt đầu (YYYY-MM-DD)")
    date_to:   str = Field(..., description="Ngày kết thúc (YYYY-MM-DD)")
    destination: Optional[str] = None
    note: Optional[str] = None


class HolidayCreate(BaseModel):
    """Admin thêm ngày lễ quốc gia."""
    date: str  = Field(..., description="Ngày lễ (YYYY-MM-DD)")
    name: str  = Field(..., description="Tên ngày lễ (VD: Tết Nguyên Đán)")
    description: Optional[str] = None


# ── Response models ─────────────────────────────────────────────────────────────

class LeaveRecord(BaseModel):
    request_id:  str
    user_id:     str
    leave_type:  LeaveType
    date_from:   str
    date_to:     str
    reason:      Optional[str] = None
    status:      LeaveStatus
    approver_id: Optional[str] = None
    approver_note: Optional[str] = None
    created_at:  str
    updated_at:  Optional[str] = None


class HolidayRecord(BaseModel):
    date:        str
    name:        str
    description: Optional[str] = None


class DayStatusResponse(BaseModel):
    """Trạng thái của một ngày cụ thể cho một user."""
    date:            str
    user_id:         str
    is_weekend:      bool
    is_holiday:      bool
    holiday_name:    Optional[str] = None
    is_business_trip: bool
    wfh_approved:    bool
    is_off_day:      bool  # True nếu là T7/CN hoặc ngày lễ hoặc công tác
