"""Business logic for the Reports module (Workflow 5 – Analytics Pipeline).

In production this queries Amazon Athena / QuickSight.
For Phase 1 we query DynamoDB directly to provide immediate functionality.
Athena integration will be added in Phase 2 (Analytics Worker).
"""

from datetime import datetime, timedelta, timezone

from app.modules.attendance import repository as att_repo
from app.modules.users import repository as user_repo
from app.modules.attendance.rule_engine import SESSIONS
from .schemas import (
    AttendanceSummary,
    UserAttendanceStat,
    ReportSummaryResponse,
)


def get_daily_summary(date: str) -> list[AttendanceSummary]:
    """Get attendance summary for all sessions on a given date."""
    summaries = []
    for session in SESSIONS:
        records = att_repo.list_by_date_session(date, session.name)
        present = sum(1 for r in records if r.get("status") == "PRESENT")
        late = sum(1 for r in records if r.get("status") == "LATE")
        total = len(records)
        rate = round((present + late) / total * 100, 1) if total else 0.0
        summaries.append(
            AttendanceSummary(
                date=date,
                session_type=session.name,
                total_present=present,
                total_late=late,
                total_absent=0,  # Absent calculated from total enrolled (Phase 2)
                attendance_rate=rate,
            )
        )
    return summaries


def get_report_summary(
    period_start: str,
    period_end: str,
) -> ReportSummaryResponse:
    """
    Generate an attendance report for a date range.

    Args:
        period_start: Start date (YYYY-MM-DD).
        period_end:   End date (YYYY-MM-DD).

    Returns:
        ReportSummaryResponse with daily summaries and top absent users.
    """
    start = datetime.fromisoformat(period_start)
    end = datetime.fromisoformat(period_end)

    daily_summaries = []
    current = start
    while current <= end:
        date_str = current.strftime("%Y-%m-%d")
        daily_summaries.extend(get_daily_summary(date_str))
        current += timedelta(days=1)

    # Aggregate per-user stats from all records in the period
    user_records: dict[str, list[dict]] = {}
    for summary_day in daily_summaries:
        for session in SESSIONS:
            records = att_repo.list_by_date_session(summary_day.date, session.name)
            for r in records:
                uid = r["userId"]
                user_records.setdefault(uid, []).append(r)

    user_stats: list[UserAttendanceStat] = []
    users_data = user_repo.list_users()
    users_map = {u["userId"]: u for u in users_data}
    total_users = len(users_map)

    for uid, records in user_records.items():
        present = sum(1 for r in records if r.get("status") == "PRESENT")
        late = sum(1 for r in records if r.get("status") == "LATE")
        total = len(records)
        rate = round((present + late) / total * 100, 1) if total else 0.0
        u = users_map.get(uid, {})
        user_stats.append(
            UserAttendanceStat(
                user_id=uid,
                name=u.get("name", "Unknown"),
                department=u.get("department"),
                total_sessions=total,
                present_count=present,
                late_count=late,
                absent_count=total - present - late,
                attendance_rate=rate,
            )
        )

    # Top 10 most absent users
    top_absent = sorted(user_stats, key=lambda x: x.attendance_rate)[:10]

    overall_rate = (
        round(sum(s.attendance_rate for s in daily_summaries) / len(daily_summaries), 1)
        if daily_summaries
        else 0.0
    )

    return ReportSummaryResponse(
        period_start=period_start,
        period_end=period_end,
        total_users=total_users,
        overall_attendance_rate=overall_rate,
        daily_summaries=daily_summaries,
        top_absent_users=top_absent,
    )
