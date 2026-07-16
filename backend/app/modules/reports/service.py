"""Business logic for the Reports module (Workflow 5 – Analytics Pipeline).

Phase 1: Query DynamoDB directly (always available, no Athena config needed).
Phase 2: Query Amazon Athena from the S3 Data Lake (auto-enabled when
         `athena_output_location` is configured in settings).

The service layer handles aggregation and schema mapping.
Raw data access is delegated to `repository.py`.
"""

from collections import defaultdict
from datetime import datetime, timedelta, timezone

from app.modules.attendance import repository as att_repo
from app.modules.users import repository as user_repo
from app.modules.attendance.rule_engine import SESSIONS
from . import repository as repo
from .schemas import (
    AttendanceSummary,
    AttendanceTrendPoint,
    AttendanceTrendResponse,
    UserAttendanceStat,
    UserDailyRecord,
    UserStatsResponse,
    ReportSummaryResponse,
)


# ── Existing WF5 Phase 1 endpoints (fixed) ────────────────────────────────────

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

    Fixed: eliminated the double-query bug (no longer re-queries per summary item).

    Args:
        period_start: Start date (YYYY-MM-DD).
        period_end:   End date (YYYY-MM-DD).

    Returns:
        ReportSummaryResponse with daily summaries and top absent users.
    """
    start = datetime.fromisoformat(period_start)
    end = datetime.fromisoformat(period_end)

    daily_summaries: list[AttendanceSummary] = []

    # Aggregate per-user stats in a single pass (one query per date×session)
    user_records: dict[str, list[dict]] = defaultdict(list)

    current = start
    while current <= end:
        date_str = current.strftime("%Y-%m-%d")
        for session in SESSIONS:
            records = att_repo.list_by_date_session(date_str, session.name)

            # Build daily summary
            present = sum(1 for r in records if r.get("status") == "PRESENT")
            late = sum(1 for r in records if r.get("status") == "LATE")
            total = len(records)
            rate = round((present + late) / total * 100, 1) if total else 0.0
            daily_summaries.append(
                AttendanceSummary(
                    date=date_str,
                    session_type=session.name,
                    total_present=present,
                    total_late=late,
                    total_absent=0,
                    attendance_rate=rate,
                )
            )

            # Accumulate per-user (single pass, no re-query)
            # attendance table uses camelCase: userId
            for r in records:
                uid = r.get("userId") or r.get("user_id", "")
                if uid:
                    user_records[uid].append(r)

        current += timedelta(days=1)

    # Build per-user stats
    # users table uses snake_case: user_id
    users_data = user_repo.list_users()
    users_map = {u.get("user_id", u.get("userId", "")): u for u in users_data}
    total_users = len(users_map)

    user_stats: list[UserAttendanceStat] = []
    for uid, records in user_records.items():
        present = sum(1 for r in records if r.get("status") == "PRESENT")
        late = sum(1 for r in records if r.get("status") == "LATE")
        total = len(records)
        rate = round((present + late) / total * 100, 1) if total else 0.0
        u = users_map.get(uid, {})
        user_stats.append(
            UserAttendanceStat(
                user_id=uid,
                name=u.get("full_name", u.get("name", "Unknown")),
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


# ── New Phase 2 endpoints (Athena with DynamoDB fallback) ─────────────────────

def get_attendance_trend(
    period_start: str,
    period_end: str,
) -> AttendanceTrendResponse:
    """
    Return per-day attendance trend data suitable for charting.

    Automatically uses Athena if configured, else falls back to DynamoDB.
    Athena returns aggregated counts; DynamoDB path aggregates in Python.
    """
    raw_records, data_source = repo.get_trend_records(period_start, period_end)

    if data_source == "athena":
        points = _aggregate_trend_from_athena(raw_records, period_start, period_end)
    else:
        points = _aggregate_trend_from_dynamo(raw_records, period_start, period_end)

    return AttendanceTrendResponse(
        period_start=period_start,
        period_end=period_end,
        data_source=data_source,
        points=sorted(points, key=lambda p: (p.date, p.session_type)),
    )


def _aggregate_trend_from_athena(
    raw: list[dict],
    start: str,
    end: str,
) -> list[AttendanceTrendPoint]:
    """
    Athena returns rows: {date, status, cnt}
    Aggregate into AttendanceTrendPoint list.
    """
    # key: (date, session_type=ALL for Athena — no session_type in stream)
    day_stats: dict[str, dict] = defaultdict(lambda: {"present": 0, "late": 0})

    for row in raw:
        date = row.get("date", "")
        status = row.get("status", "")
        cnt = int(row.get("cnt", 0))
        if status == "PRESENT":
            day_stats[date]["present"] += cnt
        elif status == "LATE":
            day_stats[date]["late"] += cnt

    points = []
    for date, counts in day_stats.items():
        present = counts["present"]
        late = counts["late"]
        total = present + late
        rate = round((present + late) / total * 100, 1) if total else 0.0
        points.append(
            AttendanceTrendPoint(
                date=date,
                session_type="ALL",
                total=total,
                present=present,
                late=late,
                absent=0,
                attendance_rate=rate,
            )
        )
    return points


def _aggregate_trend_from_dynamo(
    raw: list[dict],
    start: str,
    end: str,
) -> list[AttendanceTrendPoint]:
    """
    DynamoDB returns raw attendance items per date.
    Aggregate by (date, session_type).
    """
    # key: (date, session_type)
    bucket: dict[tuple, dict] = defaultdict(lambda: {"present": 0, "late": 0, "total": 0})

    for r in raw:
        date = r.get("date", "")
        session = r.get("session_type", "UNKNOWN")
        status = r.get("status", "")
        key = (date, session)
        bucket[key]["total"] += 1
        if status == "PRESENT":
            bucket[key]["present"] += 1
        elif status == "LATE":
            bucket[key]["late"] += 1

    points = []
    for (date, session), counts in bucket.items():
        present = counts["present"]
        late = counts["late"]
        total = counts["total"]
        absent = total - present - late
        rate = round((present + late) / total * 100, 1) if total else 0.0
        points.append(
            AttendanceTrendPoint(
                date=date,
                session_type=session,
                total=total,
                present=present,
                late=late,
                absent=absent,
                attendance_rate=rate,
            )
        )
    return points


def get_user_stats(
    user_id: str,
    period_start: str,
    period_end: str,
) -> UserStatsResponse:
    """
    Return detailed attendance statistics for a single user.

    Automatically uses Athena if configured, else falls back to DynamoDB.
    """
    # Resolve user info — users table uses snake_case user_id
    users_data = user_repo.list_users()
    users_map = {u.get("user_id", u.get("userId", "")): u for u in users_data}
    user_info = users_map.get(user_id, {})
    full_name = user_info.get("full_name", user_info.get("name", "Unknown"))
    department = user_info.get("department")

    raw_records, data_source = repo.get_user_records(user_id, period_start, period_end)

    records: list[UserDailyRecord] = []
    present_count = 0
    late_count = 0

    for r in raw_records:
        status = r.get("status", "UNKNOWN")
        # Athena returns flat strings; DynamoDB returns full items
        date_val = r.get("date") or (r.get("timestamp", "")[:10] if r.get("timestamp") else "")
        records.append(
            UserDailyRecord(
                date=date_val,
                session_type=r.get("session_type", "ALL"),
                status=status,
                camera_id=r.get("camera_id") or r.get("cameraId") or r.get("camera_id"),
                timestamp=r.get("timestamp"),
            )
        )
        if status == "PRESENT":
            present_count += 1
        elif status == "LATE":
            late_count += 1

    total_sessions = len(records)
    absent_count = 0  # Cannot determine without enrollment data
    rate = round((present_count + late_count) / total_sessions * 100, 1) if total_sessions else 0.0

    return UserStatsResponse(
        user_id=user_id,
        full_name=full_name,
        department=department,
        period_start=period_start,
        period_end=period_end,
        data_source=data_source,
        total_sessions=total_sessions,
        present_count=present_count,
        late_count=late_count,
        absent_count=absent_count,
        attendance_rate=rate,
        records=sorted(records, key=lambda x: x.date),
    )
