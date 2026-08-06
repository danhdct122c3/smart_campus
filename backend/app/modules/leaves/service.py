"""Business logic for the Leaves & WFH module."""

import uuid
from datetime import date as dt_date, timedelta, datetime, timezone

from app.core.exceptions import AppException, ErrorCode
from .schemas import (
    LeaveRequestCreate, LeaveApprovalRequest,
    BusinessTripCreate, HolidayCreate,
    LeaveRecord, HolidayRecord, DayStatusResponse,
    LeaveType, LeaveStatus,
)
from . import repository as repo


# ── Helpers ──────────────────────────────────────────────────────────────────────

def _is_weekend(date_str: str) -> bool:
    d = dt_date.fromisoformat(date_str)
    return d.weekday() >= 5  # 5=Saturday, 6=Sunday


def _to_leave_record(item: dict) -> LeaveRecord:
    return LeaveRecord(
        request_id   = item["request_id"],
        user_id      = item["user_id"],
        leave_type   = LeaveType(item["leave_type"]),
        date_from    = item["date_from"],
        date_to      = item["date_to"],
        reason       = item.get("reason"),
        status       = LeaveStatus(item.get("status", "PENDING")),
        approver_id  = item.get("approver_id"),
        approver_note= item.get("approver_note"),
        created_at   = item["created_at"],
        updated_at   = item.get("updated_at"),
    )


def _to_holiday_record(item: dict) -> HolidayRecord:
    return HolidayRecord(
        date        = item["date"],
        name        = item["name"],
        description = item.get("description"),
    )


def _notify(user_id: str, event_type_str: str, context: dict):
    """Fire-and-forget notification."""
    try:
        from app.modules.notifications.service import send_task_notification
        from app.modules.notifications.schemas import NotificationEventType
        evt = NotificationEventType(event_type_str)
        send_task_notification(user_id=user_id, event_type=evt, context=context)
    except Exception as e:
        print(f"[NOTIF ERROR] {e}")


# ── Leave Requests ────────────────────────────────────────────────────────────────

def submit_leave_request(payload: LeaveRequestCreate) -> LeaveRecord:
    """Nhân viên gửi request WFH / Nghỉ phép / Nghỉ ốm."""
    if payload.leave_type == LeaveType.BUSINESS_TRIP:
        raise AppException(
            ErrorCode.VALIDATION_ERROR,
            message="Công tác được Manager/Admin thêm trực tiếp, không cần gửi request.",
        )

    if payload.date_from > payload.date_to:
        raise AppException(ErrorCode.VALIDATION_ERROR, message="date_from không được sau date_to.")

    # Kiểm tra trùng lịch với các đơn cũ
    existing_leaves = repo.list_leaves_by_user(payload.user_id)
    for leave in existing_leaves:
        if leave.get("status") in [LeaveStatus.PENDING.value, LeaveStatus.APPROVED.value]:
            if payload.date_from <= leave.get("date_to", "") and payload.date_to >= leave.get("date_from", ""):
                raise AppException(
                    ErrorCode.VALIDATION_ERROR,
                    message="Thời gian đăng ký bị trùng với một đơn khác (đang chờ duyệt hoặc đã duyệt)."
                )

    # Kiểm tra ngày lễ
    dates_to_check = repo._date_range(payload.date_from, payload.date_to)
    for d in dates_to_check:
        if repo.get_holiday(d):
            raise AppException(
                ErrorCode.VALIDATION_ERROR,
                message=f"Ngày {d} là Ngày lễ. Không thể đăng ký nghỉ vào ngày lễ."
            )

    now = datetime.now(timezone.utc).isoformat()
    request_id = str(uuid.uuid4())

    # Lấy department của user để Manager có thể filter
    department = None
    try:
        from app.modules.users.repository import get_user_by_id
        user = get_user_by_id(payload.user_id)
        if user:
            department = user.get("department")
    except Exception:
        pass

    item = {
        "request_id": request_id,
        "user_id":    payload.user_id,
        "leave_type": payload.leave_type.value,
        "date_from":  payload.date_from,
        "date_to":    payload.date_to,
        "reason":     payload.reason,
        "status":     LeaveStatus.PENDING.value,
        "department": department,
        "created_at": now,
        "updated_at": now,
    }
    item = {k: v for k, v in item.items() if v is not None}
    repo.save_leave(item)

    # Thông báo cho người gửi (requester)
    try:
        _notify(payload.user_id, "WFH_REQUEST_SUBMITTED", {
            "requester_name": "Bạn",
            "leave_type": payload.leave_type.value,
            "date_from": payload.date_from,
            "date_to": payload.date_to,
            "reason": payload.reason or "Không có",
        })
    except Exception:
        pass

    # Thông báo cho Manager phòng ban
    try:
        from app.modules.users.repository import list_users
        managers, _ = list_users(role="MANAGER")
        # Thêm thông báo cho ADMIN (tùy chọn, hiện tại chỉ gửi cho MANAGER cùng phòng ban)
        for m in managers:
            if m.get("department") == department and m.get("user_id") != payload.user_id:
                _notify(m["user_id"], "WFH_REQUEST_SUBMITTED", {
                    "requester_name": user.get("name", payload.user_id) if user else payload.user_id,
                    "leave_type": payload.leave_type.value,
                    "date_from": payload.date_from,
                    "date_to": payload.date_to,
                    "reason": payload.reason or "Không có",
                })
    except Exception:
        pass

    return _to_leave_record(item)


def approve_leave(request_id: str, payload: LeaveApprovalRequest) -> LeaveRecord:
    item = repo.get_leave(request_id)
    if not item:
        raise AppException(ErrorCode.RESOURCE_NOT_FOUND, message="Không tìm thấy request.")
    if item.get("status") != LeaveStatus.PENDING.value:
        raise AppException(ErrorCode.BAD_REQUEST, message="Request này đã được xử lý rồi.")

    now = datetime.now(timezone.utc).isoformat()
    repo.update_leave(request_id, {
        "status":       LeaveStatus.APPROVED.value,
        "approver_id":  payload.approver_id,
        "approver_note": payload.note or "",
        "updated_at":   now,
    })

    updated = repo.get_leave(request_id)
    _notify(item["user_id"], "WFH_REQUEST_APPROVED", {
        "leave_type": item.get("leave_type"),
        "date_from":  item.get("date_from"),
        "date_to":    item.get("date_to"),
    })
    return _to_leave_record(updated)


def reject_leave(request_id: str, payload: LeaveApprovalRequest) -> LeaveRecord:
    item = repo.get_leave(request_id)
    if not item:
        raise AppException(ErrorCode.RESOURCE_NOT_FOUND, message="Không tìm thấy request.")
    if item.get("status") != LeaveStatus.PENDING.value:
        raise AppException(ErrorCode.BAD_REQUEST, message="Request này đã được xử lý rồi.")

    now = datetime.now(timezone.utc).isoformat()
    repo.update_leave(request_id, {
        "status":       LeaveStatus.REJECTED.value,
        "approver_id":  payload.approver_id,
        "approver_note": payload.note or "",
        "updated_at":   now,
    })
    updated = repo.get_leave(request_id)
    _notify(item["user_id"], "WFH_REQUEST_REJECTED", {
        "leave_type": item.get("leave_type"),
        "date_from":  item.get("date_from"),
        "date_to":    item.get("date_to"),
        "reason":     payload.note or "",
    })
    return _to_leave_record(updated)


def get_my_requests(user_id: str) -> list[LeaveRecord]:
    items = repo.list_leaves_by_user(user_id)
    return sorted([_to_leave_record(i) for i in items], key=lambda x: x.date_from, reverse=True)


def get_pending_requests(department: str | None = None) -> list[LeaveRecord]:
    items = repo.list_leaves_by_status("PENDING")
    if department:
        items = [i for i in items if i.get("department") == department]
    return [_to_leave_record(i) for i in items]


# ── Business Trip (Manager/Admin add directly) ────────────────────────────────────

def add_business_trip(payload: BusinessTripCreate, added_by: str) -> LeaveRecord:
    """Manager/Admin thêm ngày công tác cho nhân viên — auto APPROVED."""
    if payload.date_from > payload.date_to:
        raise AppException(ErrorCode.VALIDATION_ERROR, message="date_from không được sau date_to.")

    now = datetime.now(timezone.utc).isoformat()
    request_id = str(uuid.uuid4())

    department = None
    try:
        from app.modules.users.repository import get_user_by_id
        user = get_user_by_id(payload.user_id)
        department = user.get("department") if user else None
    except Exception:
        pass

    item = {
        "request_id":  request_id,
        "user_id":     payload.user_id,
        "leave_type":  LeaveType.BUSINESS_TRIP.value,
        "date_from":   payload.date_from,
        "date_to":     payload.date_to,
        "reason":      payload.note or f"Công tác: {payload.destination or ''}",
        "status":      LeaveStatus.APPROVED.value,   # auto-approved
        "approver_id": added_by,
        "department":  department,
        "created_at":  now,
        "updated_at":  now,
    }
    item = {k: v for k, v in item.items() if v is not None}
    repo.save_leave(item)

    _notify(payload.user_id, "WFH_REQUEST_APPROVED", {
        "leave_type": "BUSINESS_TRIP",
        "date_from": payload.date_from,
        "date_to":   payload.date_to,
    })
    return _to_leave_record(item)


# ── Holidays ──────────────────────────────────────────────────────────────────────

def add_holiday(payload: HolidayCreate) -> HolidayRecord:
    item = {
        "date":        payload.date,
        "name":        payload.name,
        "description": payload.description,
    }
    item = {k: v for k, v in item.items() if v is not None}
    repo.save_holiday(item)
    return _to_holiday_record(item)


def delete_holiday(date: str) -> bool:
    existing = repo.get_holiday(date)
    if not existing:
        raise AppException(ErrorCode.RESOURCE_NOT_FOUND, message=f"Không tìm thấy ngày lễ {date}.")
    return repo.delete_holiday(date)


def list_holidays(year: int | None = None) -> list[HolidayRecord]:
    items = repo.list_holidays(year=year)
    return [_to_holiday_record(i) for i in items]


# ── Day Status (used by Frontend + Rule Engine) ───────────────────────────────────

def get_day_status(user_id: str, date: str) -> DayStatusResponse:
    """
    Kiểm tra đầy đủ trạng thái của một ngày cho một user:
    - Cuối tuần?
    - Ngày lễ?
    - Công tác?
    - WFH được duyệt?
    """
    is_weekend  = _is_weekend(date)
    holiday     = repo.get_holiday(date)
    is_holiday  = holiday is not None
    holiday_name = holiday.get("name") if holiday else None

    approved_leave = repo.get_active_leave_for_user_on_date(user_id, date)
    is_business_trip = (
        approved_leave is not None and
        approved_leave.get("leave_type") == LeaveType.BUSINESS_TRIP.value
    )
    wfh_approved = (
        approved_leave is not None and
        approved_leave.get("leave_type") == LeaveType.WFH.value
    )

    # Ngày "off" không ghi ABSENT: T7/CN, ngày lễ, công tác, nghỉ phép, nghỉ ốm
    is_off_day = is_weekend or is_holiday or (
        approved_leave is not None and
        approved_leave.get("leave_type") in (
            LeaveType.BUSINESS_TRIP.value,
            LeaveType.ANNUAL_LEAVE.value,
            LeaveType.SICK_LEAVE.value,
        )
    )

    return DayStatusResponse(
        date=date,
        user_id=user_id,
        is_weekend=is_weekend,
        is_holiday=is_holiday,
        holiday_name=holiday_name,
        is_business_trip=is_business_trip,
        wfh_approved=wfh_approved,
        is_off_day=is_off_day,
    )


def cancel_leave(request_id: str, user_id: str) -> LeaveRecord:
    """Nhân viên tự hủy đơn nghỉ nếu chưa bắt đầu."""
    item = repo.get_leave(request_id)
    if not item:
        raise AppException(ErrorCode.RESOURCE_NOT_FOUND, message="Không tìm thấy request.")
    if item.get("user_id") != user_id:
        raise AppException(ErrorCode.FORBIDDEN, message="Bạn không có quyền hủy đơn của người khác.")
    if item.get("status") not in [LeaveStatus.PENDING.value, LeaveStatus.APPROVED.value]:
        raise AppException(ErrorCode.BAD_REQUEST, message="Chỉ có thể hủy đơn đang chờ duyệt hoặc đã duyệt.")
    
    # Check if the leave has already started based on UTC current date
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if item.get("date_from", "") <= today:
        raise AppException(ErrorCode.BAD_REQUEST, message="Không thể hủy đơn đã bắt đầu hoặc trong quá khứ.")

    now = datetime.now(timezone.utc).isoformat()
    repo.update_leave(request_id, {
        "status": LeaveStatus.CANCELLED.value,
        "updated_at": now,
    })

    updated = repo.get_leave(request_id)
    return _to_leave_record(updated)
