"""Pydantic schemas for the Reports module (Workflow 5 – Analytics)."""

from typing import Optional
from pydantic import BaseModel
from app.modules.users.schemas import Department


# ── Phase 1: DynamoDB-backed (existing) ───────────────────────────────────────

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
    department: Optional[Department] = None
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


# ── Phase 2: Athena-backed (new) ──────────────────────────────────────────────

class AttendanceTrendPoint(BaseModel):
    """One data point in an attendance trend chart (per day)."""
    date: str
    session_type: str
    total: int
    present: int
    late: int
    absent: int
    attendance_rate: float       # percentage 0-100


class AttendanceTrendResponse(BaseModel):
    period_start: str
    period_end: str
    data_source: str             # "dynamodb" | "athena"
    points: list[AttendanceTrendPoint]


class UserDailyRecord(BaseModel):
    """Single day + session record for a user."""
    date: str
    session_type: str
    status: str                  # PRESENT | LATE | ABSENT
    timestamp: Optional[str] = None


class UserStatsResponse(BaseModel):
    """Detailed attendance statistics for a single user."""
    user_id: str
    full_name: str
    department: Optional[Department] = None
    period_start: str
    period_end: str
    data_source: str             # "dynamodb" | "athena"
    total_sessions: int
    present_count: int
    late_count: int
    absent_count: int
    attendance_rate: float
    records: list[UserDailyRecord]


# ── WF5 Enterprise Analytics & Reporting Upgrades ─────────────────────────────

class DepartmentComparisonStat(BaseModel):
    department: str
    total_users: int
    punctuality_rate: float
    tardiness_index: float
    total_assigned_tasks: int = 0
    task_completion_rate: float = 0.0
    status_evaluation: str       # EXCELLENT | GOOD | NEEDS_IMPROVEMENT


class DepartmentComparisonResponse(BaseModel):
    period_start: str
    period_end: str
    departments: list[DepartmentComparisonStat]


class TaskWorkloadStat(BaseModel):
    total_assigned: int
    completed: int
    in_progress: int
    overdue: int
    completion_rate: float


class MyAnalyticsResponse(BaseModel):
    user_id: str
    full_name: str
    department: Optional[str] = None
    period_start: str
    period_end: str
    attendance_rate: float
    present_count: int
    late_count: int
    absent_count: int
    total_sessions: int
    task_workload: TaskWorkloadStat
    recent_records: list[UserDailyRecord]
