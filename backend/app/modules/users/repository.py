"""DynamoDB repository for the Users module.

Table: smart-campus-users
PK: userId (UUID)
SK: "PROFILE"
GSI: email-index  (email → userId lookup)
"""

from datetime import datetime, timezone

from boto3.dynamodb.conditions import Key, Attr

from app.core.config import settings
from app.shared.aws.dynamodb import (
    put_item,
    get_item,
    update_item,
    query_items,
    scan_items,
)

TABLE = settings.users_table
_SK = "PROFILE"


# ── Write ──────────────────────────────────────────────────────────────────────

def create_user(item: dict) -> dict:
    """Persist a new user. `item` must already contain userId, email, etc."""
    item["sk"] = _SK
    put_item(TABLE, item)
    return item


def update_user(user_id: str, fields: dict) -> dict:
    """Partially update a user. `fields` is a dict of attribute → value."""
    if not fields:
        return {}

    set_parts = []
    expr_values = {}
    expr_names = {}

    for i, (k, v) in enumerate(fields.items()):
        placeholder = f":v{i}"
        name_alias = f"#k{i}"
        set_parts.append(f"{name_alias} = {placeholder}")
        expr_values[placeholder] = v
        expr_names[name_alias] = k

    expr_values[":ua"] = datetime.now(timezone.utc).isoformat()
    set_parts.append("updatedAt = :ua")

    expression = "SET " + ", ".join(set_parts)
    return update_item(
        TABLE,
        key={"userId": user_id, "sk": _SK},
        update_expression=expression,
        expression_values=expr_values,
        expression_names=expr_names or None,
    )


# ── Read ───────────────────────────────────────────────────────────────────────

def get_user_by_id(user_id: str) -> dict | None:
    return get_item(TABLE, key={"userId": user_id, "sk": _SK})


def get_user_by_email(email: str) -> dict | None:
    """Lookup user by email using the GSI."""
    items = query_items(
        TABLE,
        key_condition=Key("email").eq(email),
        index_name="email-index",
        limit=1,
    )
    return items[0] if items else None


def list_users(role: str | None = None, status: str | None = None) -> list[dict]:
    """Scan all users, optionally filtered by role/status."""
    filter_expr = Attr("sk").eq(_SK)
    if role:
        filter_expr &= Attr("role").eq(role)
    if status:
        filter_expr &= Attr("status").eq(status)
    return scan_items(TABLE, filter_expression=filter_expr)
