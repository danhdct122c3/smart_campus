"""DynamoDB repository for the Notifications module.

Table: smart-campus-notifications
PK: notificationId (UUID)
SK: "NOTIFICATION"
GSI: userId-sentAt-index (PK=userId, SK=sentAt) – query by user
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
    return get_item(TABLE, key={"notificationId": notification_id, "sk": _SK})


def list_by_user(user_id: str, limit: int = 50) -> list[dict]:
    """Query notifications for a specific user using GSI."""
    return query_items(
        TABLE,
        key_condition=Key("userId").eq(user_id),
        index_name="userId-sentAt-index",
        limit=limit,
    )


def list_recent(limit: int = 100) -> list[dict]:
    """Scan recent notifications (admin view)."""
    return scan_items(
        TABLE,
        filter_expression=Attr("sk").eq(_SK),
        limit=limit,
    )
