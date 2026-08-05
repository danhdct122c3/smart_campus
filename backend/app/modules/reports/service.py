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
from app.modules.tasks import repository as task_repo
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
    DepartmentComparisonStat,
    DepartmentComparisonResponse,
    TaskWorkloadStat,
    MyAnalyticsResponse,
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


def _get_dept_user_ids(department: str | None) -> set[str] | None:
    if not department or department == "ALL":
        return None
    users_data, _ = user_repo.list_users(limit=1000)
    return {
        u.get("user_id", u.get("userId", ""))
        for u in users_data
        if u.get("department") == department
    }


def get_report_summary(
    period_start: str,
    period_end: str,
    department: str | None = None,
) -> ReportSummaryResponse:
    """
    Generate an attendance report for a date range.

    Fixed: eliminated the double-query bug (no longer re-queries per summary item).

    Args:
        period_start: Start date (YYYY-MM-DD).
        period_end:   End date (YYYY-MM-DD).
        department:   Optional department filter.

    Returns:
        ReportSummaryResponse with daily summaries and top absent users.
    """
    start = datetime.fromisoformat(period_start)
    end = datetime.fromisoformat(period_end)
    dept_uids = _get_dept_user_ids(department)

    # Fetch all records in parallel instead of looping
    all_records = repo.query_trend_from_dynamo(period_start, period_end)
    
    # Filter by department early
    if dept_uids is not None:
        all_records = [r for r in all_records if (r.get("userId") or r.get("user_id", "")) in dept_uids]

    daily_summaries: list[AttendanceSummary] = []
    user_records: dict[str, list[dict]] = defaultdict(list)

    # Group raw records by date and session
    grouped_by_date_session = defaultdict(list)
    for r in all_records:
        date = r.get("date", "")
        session = r.get("session_type", "")
        uid = r.get("userId") or r.get("user_id", "")
        if date and session:
            grouped_by_date_session[(date, session)].append(r)
        if uid:
            user_records[uid].append(r)

    # Build daily summaries exactly as before
    current = start
    while current <= end:
        date_str = current.strftime("%Y-%m-%d")
        for session in SESSIONS:
            records = grouped_by_date_session.get((date_str, session.name), [])
            
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
        current += timedelta(days=1)

    # Build per-user stats
    # users table uses snake_case: user_id
    users_data, _ = user_repo.list_users(limit=1000)
    users_map = {u.get("user_id", u.get("userId", "")): u for u in users_data}
    if dept_uids is not None:
        users_map = {uid: u for uid, u in users_map.items() if uid in dept_uids}
    total_users = len(users_map)

    user_stats: list[UserAttendanceStat] = []
    for uid, records in user_records.items():
        if dept_uids is not None and uid not in dept_uids:
            continue
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
    department: str | None = None,
) -> AttendanceTrendResponse:
    """
    Return per-day attendance trend data suitable for charting.

    Automatically uses Athena if configured, else falls back to DynamoDB.
    Athena returns aggregated counts; DynamoDB path aggregates in Python.
    """
    raw_records, data_source = repo.get_trend_records(period_start, period_end)
    dept_uids = _get_dept_user_ids(department)

    if dept_uids is not None and data_source != "athena":
        raw_records = [r for r in raw_records if (r.get("userId") or r.get("user_id", "") or r.get("user", "")) in dept_uids]

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
    user_info = user_repo.get_user_by_id(user_id) or {}
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


# ── WF5 Enterprise Analytics & Reporting Upgrades ─────────────────────────────

def get_department_comparison_stats(
    period_start: str,
    period_end: str,
) -> DepartmentComparisonResponse:
    """
    Generate department comparison matrix for PO / Director / Admin.
    Calculates Punctuality Rate, Tardiness Index, Task Completion Rate, and Evaluation.
    """
    users_data, _ = user_repo.list_users(limit=1000)
    dept_users: dict[str, list[dict]] = defaultdict(list)
    for u in users_data:
        dept = u.get("department") or "OTHER"
        dept_users[dept].append(u)

    raw_records, _ = repo.get_trend_records(period_start, period_end)
    tasks_data, _ = task_repo.list_tasks_paginated(limit=1000)

    dept_stats: list[DepartmentComparisonStat] = []
    for dept, ulist in dept_users.items():
        uids = {u.get("user_id", u.get("userId", "")) for u in ulist}
        total_u = len(ulist)

        dept_records = [r for r in raw_records if (r.get("userId") or r.get("user_id", "")) in uids]
        present = sum(1 for r in dept_records if r.get("status") == "PRESENT")
        late = sum(1 for r in dept_records if r.get("status") == "LATE")
        total_att = len(dept_records)
        punctuality_rate = round(present / total_att * 100, 1) if total_att else 100.0
        tardiness_index = round(late / total_att * 100, 1) if total_att else 0.0

        dept_tasks = [
            t for t in tasks_data
            if t.get("assignee_id") in uids or t.get("department") == dept
        ]
        total_tasks = len(dept_tasks)
        done_tasks = sum(1 for t in dept_tasks if t.get("status") in ("DONE", "RESOLVED"))
        task_completion_rate = round(done_tasks / total_tasks * 100, 1) if total_tasks else 100.0

        if punctuality_rate >= 92.0 and tardiness_index <= 10.0:
            eval_status = "EXCELLENT"
        elif punctuality_rate >= 80.0 and tardiness_index <= 20.0:
            eval_status = "GOOD"
        else:
            eval_status = "NEEDS_IMPROVEMENT"

        dept_stats.append(
            DepartmentComparisonStat(
                department=dept,
                total_users=total_u,
                punctuality_rate=punctuality_rate,
                tardiness_index=tardiness_index,
                total_assigned_tasks=total_tasks,
                task_completion_rate=task_completion_rate,
                status_evaluation=eval_status,
            )
        )

    return DepartmentComparisonResponse(
        period_start=period_start,
        period_end=period_end,
        departments=sorted(dept_stats, key=lambda x: x.department),
    )


def get_my_analytics(
    user_id: str,
    period_start: str,
    period_end: str,
) -> MyAnalyticsResponse:
    """
    Generate personal analytics (My Analytics) for STAFF / Employee.
    Includes personal attendance summary, daily log, and task workload.
    """
    user_info = user_repo.get_user_by_id(user_id) or {}
    full_name = user_info.get("full_name", user_info.get("name", "Unknown"))
    department = user_info.get("department")

    raw_records, _ = repo.get_user_records(user_id, period_start, period_end)
    records: list[UserDailyRecord] = []
    present_count = 0
    late_count = 0
    absent_count = 0

    for r in raw_records:
        status = r.get("status", "")
        if status == "PRESENT":
            present_count += 1
        elif status == "LATE":
            late_count += 1
        elif status == "ABSENT":
            absent_count += 1

        date_val = r.get("date") or (r.get("timestamp", "")[:10] if r.get("timestamp") else "")
        records.append(
            UserDailyRecord(
                date=date_val,
                session_type=r.get("session_type", "ALL"),
                status=status,
                camera_id=r.get("camera_id") or r.get("cameraId"),
                timestamp=r.get("timestamp"),
            )
        )

    total_sessions = len(records)
    attendance_rate = round((present_count + late_count) / total_sessions * 100, 1) if total_sessions else 100.0

    tasks = task_repo.list_tasks_by_assignee(user_id)
    total_assigned = len(tasks)
    completed = sum(1 for t in tasks if t.get("status") in ("DONE", "RESOLVED"))
    in_progress = sum(1 for t in tasks if t.get("status") == "IN_PROGRESS")

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    overdue = sum(
        1 for t in tasks
        if t.get("status") not in ("DONE", "RESOLVED", "CANCELLED")
        and str(t.get("due_date", "")) != ""
        and str(t.get("due_date", "")) < today_str
    )
    completion_rate = round(completed / total_assigned * 100, 1) if total_assigned else 100.0

    records.sort(key=lambda r: str(r.timestamp or r.date), reverse=True)

    return MyAnalyticsResponse(
        user_id=user_id,
        full_name=full_name,
        department=department,
        period_start=period_start,
        period_end=period_end,
        attendance_rate=attendance_rate,
        present_count=present_count,
        late_count=late_count,
        absent_count=absent_count,
        total_sessions=total_sessions,
        task_workload=TaskWorkloadStat(
            total_assigned=total_assigned,
            completed=completed,
            in_progress=in_progress,
            overdue=overdue,
            completion_rate=completion_rate,
        ),
        recent_records=records[:20],
    )

def get_tasks_summary(department: str | None = None) -> dict:
    """
    Get aggregated task statistics.
    Tasks are highly mutable OLTP data, so we ALWAYS query DynamoDB to get 
    the real-time, accurate state (ignoring Athena Data Lake for this specific widget).
    """
    # Always use DynamoDB for real-time task status
    tasks = task_repo.list_tasks_paginated(department=department, limit=1000)[0]
    stats = defaultdict(int)
    for t in tasks:
        stats[t.get("status", "UNKNOWN")] += 1
    return {"data_source": "dynamodb", "stats": dict(stats)}
