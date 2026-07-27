"""DynamoDB repository for the Notifications module.

Table: smart-campus-notifications
Table: smart-campus-notifications
PK: notification_id (UUID)
SK: "NOTIFICATION"
GSI: user_id-sent_at-index (PK=user_id, SK=sent_at) – query by user
"""

from datetime import datetime, timezone

from boto3.dynamodb.conditions import Key, Attr

from app.core.config import settings
from app.shared.aws.dynamodb import put_item, get_item, query_items, scan_items

TABLE = settings.notifications_table
_SK = "NOTIFICATION"


def save_notification(item: dict) -> dict:
    """Persist a notification record."""
    item["sk"] = _SK
    put_item(TABLE, item)
    return item


def get_notification(notification_id: str) -> dict | None:
    return get_item(TABLE, key={"notification_id": notification_id, "sk": _SK})


def list_by_user(user_id: str, limit: int = 50) -> list[dict]:
    """Query notifications for a specific user using GSI."""
    items = query_items(
        TABLE,
        key_condition=Key("user_id").eq(user_id),
        index_name="user_id-sent_at-index",
        limit=limit * 2,  # fetch extra to sort properly
    )
    sorted_items = sorted(items, key=lambda x: str(x.get("sent_at", "")), reverse=True)
    return sorted_items[:limit]


def list_recent(limit: int = 100) -> list[dict]:
    """Scan recent notifications (admin view)."""
    items = scan_items(
        TABLE,
        filter_expression=Attr("sk").eq(_SK),
        limit=limit * 5,  # scan extra to get newest items across table
    )
    sorted_items = sorted(items, key=lambda x: str(x.get("sent_at", "")), reverse=True)
    return sorted_items[:limit]
