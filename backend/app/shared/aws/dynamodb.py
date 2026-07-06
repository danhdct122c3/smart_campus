"""DynamoDB client wrapper with common CRUD helpers."""

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError
from functools import lru_cache

from app.core.config import settings


@lru_cache
def get_dynamodb_resource():
    return boto3.resource("dynamodb", region_name=settings.aws_region)


def get_table(table_name: str):
    return get_dynamodb_resource().Table(table_name)


# ── Generic helpers ────────────────────────────────────────────────────────────

def put_item(table_name: str, item: dict) -> dict:
    """Insert or replace an item."""
    table = get_table(table_name)
    response = table.put_item(Item=item)
    return response


def get_item(table_name: str, key: dict) -> dict | None:
    """Get a single item by primary key. Returns None if not found."""
    table = get_table(table_name)
    response = table.get_item(Key=key)
    return response.get("Item")


def update_item(
    table_name: str,
    key: dict,
    update_expression: str,
    expression_values: dict,
    expression_names: dict | None = None,
) -> dict:
    """Update an item with a custom update expression."""
    table = get_table(table_name)
    kwargs = {
        "Key": key,
        "UpdateExpression": update_expression,
        "ExpressionAttributeValues": expression_values,
        "ReturnValues": "ALL_NEW",
    }
    if expression_names:
        kwargs["ExpressionAttributeNames"] = expression_names
    response = table.update_item(**kwargs)
    return response.get("Attributes", {})


def delete_item(table_name: str, key: dict) -> bool:
    """Delete an item. Returns True on success."""
    table = get_table(table_name)
    table.delete_item(Key=key)
    return True


def query_items(
    table_name: str,
    key_condition,
    index_name: str | None = None,
    filter_expression=None,
    limit: int | None = None,
) -> list[dict]:
    """Query items using a key condition expression."""
    table = get_table(table_name)
    kwargs = {"KeyConditionExpression": key_condition}
    if index_name:
        kwargs["IndexName"] = index_name
    if filter_expression is not None:
        kwargs["FilterExpression"] = filter_expression
    if limit:
        kwargs["Limit"] = limit

    response = table.query(**kwargs)
    return response.get("Items", [])


def scan_items(
    table_name: str,
    filter_expression=None,
    limit: int | None = None,
) -> list[dict]:
    """Full table scan (use sparingly)."""
    table = get_table(table_name)
    kwargs: dict = {}
    if filter_expression is not None:
        kwargs["FilterExpression"] = filter_expression
    if limit:
        kwargs["Limit"] = limit

    response = table.scan(**kwargs)
    return response.get("Items", [])
