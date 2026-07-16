"""DynamoDB + Athena repository for the Reports module (Workflow 5).

Phase 1: Query DynamoDB directly (always available).
Phase 2: Query Amazon Athena from the S3 Data Lake (requires Firehose pipeline running).

Athena table schema (populated by analytics_worker.py → Kinesis Firehose → S3):
    attendance_records (
        event_type  STRING,
        attendance_id STRING,
        user_id     STRING,
        camera_id   STRING,
        room_id     STRING,
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

from boto3.dynamodb.conditions import Key, Attr

from app.core.config import settings
from app.shared.aws.dynamodb import query_items, scan_items
from app.shared.aws.athena import run_query_sync, AthenaQueryError

logger = logging.getLogger(__name__)

_ATTENDANCE_TABLE = settings.attendance_table
_ATHENA_TABLE = "attendance_records"


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

def query_trend_from_dynamo(start: str, end: str) -> list[dict]:
    """
    Query attendance records from DynamoDB for a date range.

    Returns list of raw DynamoDB items, each containing at least:
        date, session_type, status, user_id, camera_id, timestamp
    """
    dates = _date_range(start, end)
    all_records: list[dict] = []
    for date in dates:
        items = query_items(
            _ATTENDANCE_TABLE,
            key_condition=Key("date").eq(date),
            index_name="date-index",
        )
        all_records.extend(items)
    return all_records


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


def query_trend_from_athena(start: str, end: str) -> list[dict]:
    """
    Query attendance trend from Athena S3 Data Lake.

    Returns list of dicts with keys: date, session_type, present, late, total
    Raises AthenaQueryError on failure.
    """
    sql = f"""
        SELECT
            SUBSTR(timestamp, 1, 10)  AS date,
            status,
            COUNT(*)                  AS cnt
        FROM {_ATHENA_TABLE}
        WHERE SUBSTR(timestamp, 1, 10) BETWEEN '{start}' AND '{end}'
          AND status IN ('PRESENT', 'LATE')
        GROUP BY SUBSTR(timestamp, 1, 10), status
        ORDER BY date
    """
    logger.info("Running Athena trend query for %s → %s", start, end)
    return run_query_sync(sql.strip())


def query_user_stats_from_athena(user_id: str, start: str, end: str) -> list[dict]:
    """
    Query a single user's attendance records from Athena.

    Returns list of dicts: attendance_id, user_id, camera_id, status, timestamp
    Raises AthenaQueryError on failure.
    """
    sql = f"""
        SELECT
            attendance_id,
            user_id,
            camera_id,
            status,
            timestamp,
            SUBSTR(timestamp, 1, 10) AS date
        FROM {_ATHENA_TABLE}
        WHERE user_id = '{user_id}'
          AND SUBSTR(timestamp, 1, 10) BETWEEN '{start}' AND '{end}'
        ORDER BY timestamp
    """
    logger.info("Running Athena user-stats query for user=%s", user_id)
    return run_query_sync(sql.strip())


def get_trend_records(start: str, end: str) -> tuple[list[dict], str]:
    """
    Fetch trend data using Athena if configured, else fall back to DynamoDB.

    Returns:
        (records, data_source) where data_source is "athena" or "dynamodb".
    """
    if _athena_available():
        try:
            records = query_trend_from_athena(start, end)
            return records, "athena"
        except AthenaQueryError as exc:
            logger.warning("Athena query failed, falling back to DynamoDB: %s", exc)

    return query_trend_from_dynamo(start, end), "dynamodb"


def get_user_records(user_id: str, start: str, end: str) -> tuple[list[dict], str]:
    """
    Fetch user records using Athena if configured, else fall back to DynamoDB.

    Returns:
        (records, data_source) where data_source is "athena" or "dynamodb".
    """
    if _athena_available():
        try:
            records = query_user_stats_from_athena(user_id, start, end)
            return records, "athena"
        except AthenaQueryError as exc:
            logger.warning("Athena user query failed, falling back to DynamoDB: %s", exc)

    return query_user_stats_from_dynamo(user_id, start, end), "dynamodb"
