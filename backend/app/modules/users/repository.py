"""DynamoDB repository for the Users module.

Table: smart-campus-users
PK: user_id (UUID)
GSI: email-index  (email → user_id lookup)
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
    scan_items_paginated,
)

TABLE = settings.users_table

# ── Write ──────────────────────────────────────────────────────────────────────

def create_user(item: dict) -> dict:
    """Persist a new user. `item` must already contain user_id, email, etc."""
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
    set_parts.append("#ua = :ua")
    expr_names["#ua"] = "updated_at"

    expression = "SET " + ", ".join(set_parts)
    return update_item(
        TABLE,
        key={"user_id": user_id},
        update_expression=expression,
        expression_values=expr_values,
        expression_names=expr_names,
    )


# ── Read ───────────────────────────────────────────────────────────────────────

def get_user_by_id(user_id: str) -> dict | None:
    return get_item(TABLE, key={"user_id": user_id})


def get_user_by_email(email: str) -> dict | None:
    """Lookup user by email using the GSI."""
    items = query_items(
        TABLE,
        key_condition=Key("email").eq(email),
        index_name="email-index",
        limit=1,
    )
    return items[0] if items else None


def list_users(
    role: str | None = None, 
    status: str | None = None,
    limit: int = 20,
    cursor: str | None = None
) -> tuple[list[dict], str | None]:
    """Scan all users, optionally filtered by role/status."""
    filter_expr = None
    if role:
        filter_expr = Attr("role").eq(role)
    if status:
        if filter_expr:
            filter_expr &= Attr("status").eq(status)
        else:
            filter_expr = Attr("status").eq(status)
    return scan_items_paginated(TABLE, filter_expression=filter_expr, limit=limit, cursor=cursor)
