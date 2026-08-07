"""DynamoDB + Athena repository for the Reports module (Workflow 5).

Phase 1: Query DynamoDB directly (always available).
Phase 2: Query Amazon Athena from the S3 Data Lake (requires Firehose pipeline running).

Athena table schema (populated by analytics_worker.py → Kinesis Firehose → S3):
    attendance_records (
        event_type  STRING,
        attendance_id STRING,
        user_id     STRING,
        status      STRING,   -- PRESENT | LATE
        timestamp   STRING,   -- ISO 8601
        year        STRING,
        month       STRING,
        day         STRING
    )
    PARTITIONED BY (year, month, day)
"""

import logging
from datetime import datetime, timedelta
from collections import defaultdict

from boto3.dynamodb.conditions import Key, Attr

from app.core.config import settings
from app.shared.aws.dynamodb import query_items, scan_items
from app.shared.aws.athena import run_query_sync, AthenaQueryError

logger = logging.getLogger(__name__)

_ATTENDANCE_TABLE = settings.attendance_table
_ATHENA_ATTENDANCE_TABLE = "attendance"
_ATHENA_TASKS_TABLE = "tasks"
_ATHENA_USERS_TABLE = "users"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _date_range(start: str, end: str) -> list[str]:
    """Return list of date strings YYYY-MM-DD from start to end (inclusive)."""
    s = datetime.fromisoformat(start)
    e = datetime.fromisoformat(end)
    dates = []
    current = s
    while current <= e:
        dates.append(current.strftime("%Y-%m-%d"))
        current += timedelta(days=1)
    return dates


# ── Phase 1: DynamoDB ─────────────────────────────────────────────────────────

import concurrent.futures

def query_trend_from_dynamo(start: str, end: str) -> list[dict]:
    """
    Query attendance records from DynamoDB for a date range using a single Scan.
    (Optimized for speed without ThreadPoolExecutor to avoid Boto3 thread-safety issues).
    """
    return scan_items(
        _ATTENDANCE_TABLE,
        filter_expression=Attr("date").between(start, end)
    )


def query_user_stats_from_dynamo(user_id: str, start: str, end: str) -> list[dict]:
    """
    Query all attendance records for a specific user in a date range (DynamoDB).
    """
    items = query_items(
        _ATTENDANCE_TABLE,
        key_condition=Key("user_id").eq(user_id),
        index_name="userid-index",
        filter_expression=Attr("date").between(start, end),
    )
    return items


# ── Phase 2: Athena ───────────────────────────────────────────────────────────

def _athena_available() -> bool:
    """Check if Athena output location is configured."""
    return bool(settings.athena_output_location)


def query_trend_from_athena(start: str, end: str, user_ids: list[str] | None = None) -> list[dict]:
    """
    Query attendance trend from Athena S3 Data Lake.

    Returns list of dicts with keys: date, session_type, present, late, total
    Raises AthenaQueryError on failure.
    """
    user_filter = ""
    if user_ids is not None:
        if not user_ids:
            return [] # Empty department
        in_clause = ", ".join(f"'{uid}'" for uid in user_ids)
        user_filter = f"AND user_id IN ({in_clause})"

    sql = f"""
        SELECT
            SUBSTR(timestamp, 1, 10)  AS date,
            status,
            COUNT(*)                  AS cnt
        FROM {_ATHENA_ATTENDANCE_TABLE}
        WHERE SUBSTR(timestamp, 1, 10) BETWEEN '{start}' AND '{end}'
          AND status IN ('PRESENT', 'LATE')
          {user_filter}
        GROUP BY SUBSTR(timestamp, 1, 10), status
        ORDER BY date
    """
    logger.info("Running Athena trend query for %s → %s", start, end)
    return run_query_sync(sql.strip())


def query_user_stats_from_athena(user_id: str, start: str, end: str) -> list[dict]:
    """
    Query a single user's attendance records from Athena.

    Returns list of dicts: attendance_id, user_id, status, timestamp
    Raises AthenaQueryError on failure.
    """
    sql = f"""
        SELECT
            attendance_id,
            user_id,
            status,
            timestamp,
            SUBSTR(timestamp, 1, 10) AS date
        FROM {_ATHENA_ATTENDANCE_TABLE}
        WHERE user_id = '{user_id}'
          AND SUBSTR(timestamp, 1, 10) BETWEEN '{start}' AND '{end}'
        ORDER BY timestamp
    """
    logger.info("Running Athena user-stats query for user=%s", user_id)
    return run_query_sync(sql.strip())


def query_user_aggregated_stats_from_athena(start: str, end: str) -> list[dict]:
    """
    Query attendance aggregated stats per user from Athena S3 Data Lake.
    Returns list of dicts with keys: user_id, status, cnt
    """
    sql = f"""
        SELECT
            user_id,
            status,
            COUNT(*) AS cnt
        FROM {_ATHENA_ATTENDANCE_TABLE}
        WHERE SUBSTR(timestamp, 1, 10) BETWEEN '{start}' AND '{end}'
          AND status IN ('PRESENT', 'LATE')
        GROUP BY user_id, status
    """
    logger.info("Running Athena user-aggregated-stats query for %s → %s", start, end)
    return run_query_sync(sql.strip())



def query_tasks_summary_from_athena(department: str | None = None) -> list[dict]:
    """
    Query tasks summary from Athena Data Lake.
    """
    dept_filter = f"WHERE department = '{department}'" if department and department != 'ALL' else ""
    sql = f"""
        SELECT 
            status, 
            COUNT(*) as cnt 
        FROM {_ATHENA_TASKS_TABLE}
        {dept_filter}
        GROUP BY status
    """
    logger.info("Running Athena tasks-summary query")
    return run_query_sync(sql.strip())


def get_trend_records(start: str, end: str, user_ids: list[str] | None = None) -> tuple[list[dict], str]:
    """
    Fetch trend data using Hybrid Architecture (Lambda Architecture).
    - Cold Data (past dates): Amazon Athena
    - Hot Data (today onwards): Amazon DynamoDB
    """
    if _athena_available():
        try:
            today_str = datetime.utcnow().strftime("%Y-%m-%d")
            
            athena_records = []
            if start < today_str:
                # Query past data from Athena
                yesterday_str = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")
                athena_end = min(end, yesterday_str)
                athena_records = query_trend_from_athena(start, athena_end, user_ids)
            
            # Query hot data (today onwards) from DynamoDB
            dynamo_start = max(start, today_str)
            dynamo_raw = []
            if dynamo_start <= end:
                dynamo_raw = query_trend_from_dynamo(dynamo_start, end)
            
            # Aggregate DynamoDB raw records to match Athena's format: {date, status, cnt}
            agg = {}
            for r in dynamo_raw:
                date = r.get("date", "")
                status = r.get("status", "")
                if status in ("PRESENT", "LATE"):
                    key = (date, status)
                    agg[key] = agg.get(key, 0) + 1
            
            dynamo_agg = [{"date": d, "status": s, "cnt": c} for (d, s), c in agg.items()]
            
            # Merge Hot and Cold data
            combined = athena_records + dynamo_agg
            logger.info("Hybrid Merge: %d from Athena, %d from DynamoDB", len(athena_records), len(dynamo_agg))
            return combined, "athena"
        except AthenaQueryError as exc:
            logger.warning("Athena query failed, falling back to DynamoDB: %s", exc)

    return query_trend_from_dynamo(start, end), "dynamodb"


def get_user_records(user_id: str, start: str, end: str) -> tuple[list[dict], str]:
    """
    Fetch user records using Hybrid Architecture (Lambda Architecture).
    - Cold Data (past dates): Amazon Athena
    - Hot Data (today onwards): Amazon DynamoDB
    """
    if _athena_available():
        try:
            today_str = datetime.utcnow().strftime("%Y-%m-%d")
            
            athena_records = []
            if start < today_str:
                yesterday_str = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")
                athena_end = min(end, yesterday_str)
                athena_records = query_user_stats_from_athena(user_id, start, athena_end)
            
            dynamo_raw = []
            dynamo_start = max(start, today_str)
            if dynamo_start <= end:
                dynamo_raw = query_user_stats_from_dynamo(user_id, dynamo_start, end)
            
            # DynamoDB items are flat dicts similar to Athena results, so we just concat
            combined = athena_records + dynamo_raw
            logger.info("Hybrid Merge (User): %d from Athena, %d from DynamoDB", len(athena_records), len(dynamo_raw))
            return combined, "athena"
        except AthenaQueryError as exc:
            logger.warning("Athena user query failed, falling back to DynamoDB: %s", exc)

    return query_user_stats_from_dynamo(user_id, start, end), "dynamodb"


def get_user_aggregated_stats(start: str, end: str) -> tuple[dict[str, dict[str, int]], str]:
    """
    Fetch aggregated user attendance stats using Hybrid Architecture (Lambda Architecture).
    Returns a dict mapping user_id to {"PRESENT": cnt, "LATE": cnt}.
    """
    if _athena_available():
        try:
            today_str = datetime.utcnow().strftime("%Y-%m-%d")
            
            athena_records = []
            if start < today_str:
                yesterday_str = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")
                athena_end = min(end, yesterday_str)
                athena_records = query_user_aggregated_stats_from_athena(start, athena_end)
            
            dynamo_start = max(start, today_str)
            dynamo_raw = []
            if dynamo_start <= end:
                dynamo_raw = query_trend_from_dynamo(dynamo_start, end)
            
            # Aggregate Athena
            agg = defaultdict(lambda: {"PRESENT": 0, "LATE": 0})
            for r in athena_records:
                uid = r.get("user_id")
                st = r.get("status")
                cnt = r.get("cnt", 0)
                if uid and st in ("PRESENT", "LATE"):
                    agg[uid][st] += int(cnt)
                    
            # Aggregate Dynamo
            for r in dynamo_raw:
                uid = r.get("user_id") or r.get("userId")
                st = r.get("status")
                if uid and st in ("PRESENT", "LATE"):
                    agg[uid][st] += 1
            
            logger.info("Hybrid Merge (User Agg): %d from Athena, %d from DynamoDB", len(athena_records), len(dynamo_raw))
            return dict(agg), "athena"
        except AthenaQueryError as exc:
            logger.warning("Athena user agg query failed, falling back to DynamoDB: %s", exc)

    # Fallback entirely to DynamoDB
    dynamo_raw = query_trend_from_dynamo(start, end)
    agg = defaultdict(lambda: {"PRESENT": 0, "LATE": 0})
    for r in dynamo_raw:
        uid = r.get("user_id") or r.get("userId")
        st = r.get("status")
        if uid and st in ("PRESENT", "LATE"):
            agg[uid][st] += 1
    return dict(agg), "dynamodb"
