"""DynamoDB repository for the Attendance module.

Table: smart-campus-attendance
PK: record_id
GSI: date-index (PK=date)
GSI: userid-index (PK=user_id)
"""

from boto3.dynamodb.conditions import Key, Attr

from app.core.config import settings
from app.shared.aws.dynamodb import put_item, query_items, update_item

TABLE = settings.attendance_table

def save_record(item: dict) -> dict:
    """Persist an attendance record."""
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

def list_by_date_session(date: str, session_type: str) -> list[dict]:
    """List all attendance records for a specific date + session."""
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


def get_today_checkin(user_id: str, date: str) -> dict | None:
    """Get the most recent check-in record for a user on a given date (any session)."""
    items = query_items(
        TABLE,
        key_condition=Key("user_id").eq(user_id),
        index_name="userid-index",
        filter_expression=Attr("date").eq(date),
    )
    # Return the latest record by timestamp
    if not items:
        return None
    items.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return items[0]


def update_checkout_time(record_id: str, checkout_time: str) -> dict:
    """Write checkout_time into an existing attendance record."""
    return update_item(
        TABLE,
        key={"record_id": record_id},
        update_expression="SET checkout_time = :ct",
        expression_values={":ct": checkout_time},
    )
