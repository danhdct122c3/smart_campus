"""DynamoDB repository for the Tasks module.

Table: smart-campus-tasks
PK: task_id
GSI: assignee_id-status-index (PK=assignee_id, SK=status)
"""

from boto3.dynamodb.conditions import Key, Attr

from app.core.config import settings
from app.shared.aws.dynamodb import put_item, get_item, query_items, update_item, delete_item

TABLE = settings.tasks_table

def save_task(item: dict) -> dict:
    put_item(TABLE, item)
    return item

def get_task(task_id: str) -> dict | None:
    return get_item(TABLE, {"task_id": task_id})

def list_tasks_by_assignee(assignee_id: str, status: str | None = None) -> list[dict]:
    kwargs = {
        "table_name": TABLE,
        "key_condition": Key("assignee_id").eq(assignee_id),
        "index_name": "assignee_id-status-index",
    }
    if status:
        kwargs["key_condition"] = Key("assignee_id").eq(assignee_id) & Key("status").eq(status)
        
    return query_items(**kwargs)

def list_all_tasks() -> list[dict]:
    """Scan all tasks (For admin view)."""
    from app.shared.aws.dynamodb import scan_items
    return scan_items(TABLE)

def update_task_in_db(task_id: str, update_expr: str, expr_vals: dict, expr_names: dict | None = None) -> dict:
    return update_item(
        TABLE,
        key={"task_id": task_id},
        update_expression=update_expr,
        expression_values=expr_vals,
        expression_names=expr_names
    )

def delete_task_in_db(task_id: str) -> bool:
    return delete_item(TABLE, {"task_id": task_id})
