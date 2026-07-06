"""Pydantic schemas for the Reports module (Workflow 5 – Analytics)."""

from typing import Optional
from pydantic import BaseModel


class AttendanceSummary(BaseModel):
    date: str
    session_type: str
    total_present: int
    total_late: int
    total_absent: int
    attendance_rate: float   # percentage 0-100


class UserAttendanceStat(BaseModel):
    user_id: str
    name: str
    department: Optional[str] = None
    total_sessions: int
    present_count: int
    late_count: int
    absent_count: int
    attendance_rate: float


class ReportSummaryResponse(BaseModel):
    period_start: str
    period_end: str
    total_users: int
    overall_attendance_rate: float
    daily_summaries: list[AttendanceSummary]
    top_absent_users: list[UserAttendanceStat]
