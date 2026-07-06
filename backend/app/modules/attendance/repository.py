"""DynamoDB repository for the Attendance module.

Table: smart-campus-attendance
PK: date#sessionType    e.g. "2026-07-05#MORNING"
SK: userId
GSI: userId-date-index  (PK=userId, SK=date) – query history by user
"""

from boto3.dynamodb.conditions import Key

from app.core.config import settings
from app.shared.aws.dynamodb import put_item, get_item, query_items, scan_items

TABLE = settings.attendance_table


def make_pk(date: str, session_type: str) -> str:
    return f"{date}#{session_type}"


def save_record(item: dict) -> dict:
    """Persist an attendance record."""
    put_item(TABLE, item)
    return item


def get_record(date: str, session_type: str, user_id: str) -> dict | None:
    """Check if an attendance record already exists (for idempotency)."""
    return get_item(
        TABLE,
        key={"pk": make_pk(date, session_type), "userId": user_id},
    )


def list_by_date_session(date: str, session_type: str) -> list[dict]:
    """List all attendance records for a specific date + session."""
    return query_items(
        TABLE,
        key_condition=Key("pk").eq(make_pk(date, session_type)),
    )


def list_by_user(user_id: str, date: str | None = None) -> list[dict]:
    """List attendance records for a specific user (uses GSI)."""
    key_cond = Key("userId").eq(user_id)
    if date:
        key_cond &= Key("date").begins_with(date)
    return query_items(
        TABLE,
        key_condition=key_cond,
        index_name="userId-date-index",
    )
