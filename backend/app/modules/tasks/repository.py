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

def list_tasks_paginated(
    user_id: str | None = None,
    status: str | None = None,
    task_type: str | None = None,
    department: str | None = None,
    priority: str | None = None,
    search: str | None = None,
    limit: int = 20,
    cursor: str | None = None
) -> tuple[list[dict], str | None]:
    from boto3.dynamodb.conditions import Attr
    from app.shared.aws.dynamodb import scan_items_paginated
    
    filter_expr = None
    
    def add_condition(cond):
        nonlocal filter_expr
        if filter_expr is None:
            filter_expr = cond
        else:
            filter_expr &= cond

    if user_id:
        add_condition(Attr("assignee_id").eq(user_id) | Attr("reporter_id").eq(user_id))
    if status:
        add_condition(Attr("status").eq(status))
    if task_type:
        add_condition(Attr("task_type").eq(task_type))
    if department:
        add_condition(Attr("department").eq(department))
    if priority:
        add_condition(Attr("priority").eq(priority))
    if search:
        add_condition(Attr("title").contains(search) | Attr("description").contains(search))
        
    return scan_items_paginated(TABLE, filter_expression=filter_expr, limit=limit, cursor=cursor)

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

def delete_task_with_subtasks(task_id: str) -> bool:
    from boto3.dynamodb.conditions import Attr
    from app.shared.aws.dynamodb import scan_items_paginated
    
    # 1. Delete all subtasks (loop to fetch all paginated)
    cursor = None
    while True:
        subtasks, next_key = scan_items_paginated(
            TABLE, 
            filter_expression=Attr("parent_task_id").eq(task_id), 
            limit=50, 
            cursor=cursor
        )
        for sub in subtasks:
            delete_task_in_db(sub["task_id"])
            
        cursor = next_key
        if not cursor:
            break
            
    # 2. Delete the parent task
    return delete_task_in_db(task_id)
