"""DynamoDB repository for the Leaves & WFH module.

Tables:
  smart-campus-leaves:
    PK: request_id (UUID)
    GSI: user_id-date_from-index   (PK=user_id, SK=date_from)
    GSI: status-date_from-index    (PK=status,  SK=date_from)

  smart-campus-holidays:
    PK: date (YYYY-MM-DD)
"""

from datetime import date as dt_date, timedelta
from boto3.dynamodb.conditions import Key, Attr

from app.core.config import settings
from app.shared.aws.dynamodb import (
    put_item, get_item, update_item, delete_item,
    scan_items, query_items,
)

LEAVES_TABLE   = settings.leaves_table
HOLIDAYS_TABLE = settings.holidays_table


# ── Helpers ─────────────────────────────────────────────────────────────────────

def _date_range(date_from: str, date_to: str) -> list[str]:
    """Generate list of YYYY-MM-DD strings from date_from to date_to (inclusive)."""
    start = dt_date.fromisoformat(date_from)
    end   = dt_date.fromisoformat(date_to)
    dates = []
    current = start
    while current <= end:
        dates.append(current.isoformat())
        current += timedelta(days=1)
    return dates


# ── Leave Requests ───────────────────────────────────────────────────────────────

def save_leave(item: dict) -> dict:
    put_item(LEAVES_TABLE, item)
    return item


def get_leave(request_id: str) -> dict | None:
    return get_item(LEAVES_TABLE, {"request_id": request_id})


def update_leave(request_id: str, fields: dict) -> dict:
    set_expr_parts = []
    expr_vals = {}
    expr_names = {}
    for k, v in fields.items():
        set_expr_parts.append(f"#{k} = :{k}")
        expr_vals[f":{k}"] = v
        expr_names[f"#{k}"] = k
        
    return update_item(
        LEAVES_TABLE,
        key={"request_id": request_id},
        update_expression="SET " + ", ".join(set_expr_parts),
        expression_values=expr_vals,
        expression_names=expr_names,
    )


def list_leaves_by_user(user_id: str, status: str | None = None) -> list[dict]:
    """Lấy tất cả request của 1 user (qua GSI user_id-date_from-index)."""
    try:
        items = query_items(
            LEAVES_TABLE,
            key_condition=Key("user_id").eq(user_id),
            index_name="user_id-date_from-index",
        )
    except Exception:
        # Fallback: scan nếu GSI chưa tạo
        items = scan_items(LEAVES_TABLE, filter_expression=Attr("user_id").eq(user_id))

    if status:
        items = [i for i in items if i.get("status") == status]
    return items


def list_leaves_by_status(status: str) -> list[dict]:
    """Lấy tất cả request theo trạng thái (để Manager xem pending)."""
    try:
        items = query_items(
            LEAVES_TABLE,
            key_condition=Key("status").eq(status),
            index_name="status-date_from-index",
        )
    except Exception:
        items = scan_items(LEAVES_TABLE, filter_expression=Attr("status").eq(status))
    return items


def list_leaves_by_department_pending(department: str) -> list[dict]:
    """Lấy pending requests trong 1 phòng ban — join thủ công từ scan."""
    items = scan_items(LEAVES_TABLE, filter_expression=Attr("status").eq("PENDING"))
    if department:
        items = [i for i in items if i.get("department") == department]
    return items


def get_active_leave_for_user_on_date(user_id: str, date: str) -> dict | None:
    """Kiểm tra user có leave APPROVED nào vào ngày date không."""
    items = list_leaves_by_user(user_id, status="APPROVED")
    for item in items:
        date_from = item.get("date_from", "")
        date_to   = item.get("date_to", "")
        if date_from <= date <= date_to:
            return item
    return None


# ── Holidays ─────────────────────────────────────────────────────────────────────

def save_holiday(item: dict) -> dict:
    put_item(HOLIDAYS_TABLE, item)
    return item


def get_holiday(date: str) -> dict | None:
    return get_item(HOLIDAYS_TABLE, {"date": date})


def delete_holiday(date: str) -> bool:
    delete_item(HOLIDAYS_TABLE, {"date": date})
    return True


def list_holidays(year: int | None = None) -> list[dict]:
    items = scan_items(HOLIDAYS_TABLE)
    if year:
        items = [i for i in items if i["date"].startswith(str(year))]
    return sorted(items, key=lambda x: x["date"])
