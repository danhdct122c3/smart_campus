"""DynamoDB repository for the Attendance module.

Table: smart-campus-attendance
PK: record_id
GSI: date-index (PK=date)
GSI: userid-index (PK=user_id)
"""

from boto3.dynamodb.conditions import Key, Attr

from app.core.config import settings
from app.shared.aws.dynamodb import put_item, query_items

TABLE = settings.attendance_table

def save_record(item: dict) -> dict:
    """Persist an attendance record. item must contain record_id as PK."""
    put_item(TABLE, item)
    return item

def get_record(date: str, session_type: str, user_id: str) -> dict | None:
    """Check if an attendance record already exists (for idempotency)."""
    items = query_items(
        TABLE,
        key_condition=Key("user_id").eq(user_id),
        index_name="userid-index",
        filter_expression=Attr("date").eq(date) & Attr("session_type").eq(session_type),
    )
    return items[0] if items else None

def list_by_date(date: str) -> list[dict]:
    """List all attendance records for a specific date (uses date-index GSI)."""
    return query_items(
        TABLE,
        key_condition=Key("date").eq(date),
        index_name="date-index",
        filter_expression=Attr("session_type").eq(session_type),
    )

def list_by_user(user_id: str, date: str | None = None) -> list[dict]:
    """List attendance records for a specific user (uses GSI)."""
    kwargs = {
        "table_name": TABLE,
        "key_condition": Key("user_id").eq(user_id),
        "index_name": "userid-index",
    }
    if date:
        kwargs["filter_expression"] = Attr("date").begins_with(date)
    return query_items(**kwargs)
