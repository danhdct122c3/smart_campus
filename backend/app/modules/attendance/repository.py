"""DynamoDB repository for the Attendance module.

Table: smart-campus-attendance
PK: record_id  (UUID, snake_case – theo schema DynamoDB thực tế)
GSI 1: date-index    (PK=date)      – query by date
GSI 2: userid-index  (PK=user_id)  – query by user
"""

from boto3.dynamodb.conditions import Key

from app.core.config import settings
from app.shared.aws.dynamodb import put_item, get_item, query_items, scan_items

TABLE = settings.attendance_table


def save_record(item: dict) -> dict:
    """Persist an attendance record. item must contain record_id as PK."""
    put_item(TABLE, item)
    return item


def get_record_by_id(record_id: str) -> dict | None:
    """Fetch a single record by PK."""
    return get_item(TABLE, key={"record_id": record_id})


def get_record(date: str, session_name: str, user_id: str) -> dict | None:
    """Check for duplicate: query date-index then filter by user_id + session_type."""
    items = query_items(
        TABLE,
        key_condition=Key("date").eq(date),
        index_name="date-index",
    )
    for item in items:
        if item.get("user_id") == user_id and item.get("session_type") == session_name:
            return item
    return None


def list_by_date(date: str) -> list[dict]:
    """List all attendance records for a specific date (uses date-index GSI)."""
    return query_items(
        TABLE,
        key_condition=Key("date").eq(date),
        index_name="date-index",
    )


def list_by_user(user_id: str, date: str | None = None) -> list[dict]:
    """List attendance records for a specific user (uses userid-index GSI)."""
    items = query_items(
        TABLE,
        key_condition=Key("user_id").eq(user_id),
        index_name="userid-index",
    )
    if date:
        items = [i for i in items if i.get("date") == date]
    return items
