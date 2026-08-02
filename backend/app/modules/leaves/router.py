"""FastAPI router for the Leaves & WFH module."""

from typing import Optional
from fastapi import APIRouter, Query, Header

from app.core.responses import APIResponse
from .schemas import (
    LeaveRequestCreate, LeaveApprovalRequest,
    BusinessTripCreate, HolidayCreate,
    LeaveRecord, HolidayRecord, DayStatusResponse,
)
from . import service

router = APIRouter(prefix="/leaves", tags=["Leaves & WFH"])


# ── Nhân viên: Gửi request ────────────────────────────────────────────────────────

@router.post(
    "/request",
    response_model=APIResponse[LeaveRecord],
    summary="Gửi request WFH / Nghỉ phép / Nghỉ ốm",
)
def submit_leave_request(payload: LeaveRequestCreate):
    data = service.submit_leave_request(payload)
    return APIResponse.ok(data)


@router.get(
    "/my-requests",
    response_model=APIResponse[list[LeaveRecord]],
    summary="Xem danh sách request của tôi",
)
def get_my_requests(user_id: str = Query(..., description="User ID của nhân viên")):
    data = service.get_my_requests(user_id)
    return APIResponse.ok(data)


@router.patch(
    "/{request_id}/cancel",
    summary="Nhân viên tự hủy đơn nghỉ chưa bắt đầu",
)
def cancel_leave(request_id: str, user_id: str = Query(..., description="User ID của người thao tác")):
    data = service.cancel_leave(request_id, user_id)
    return APIResponse.ok(data)


@router.get(
    "/day-status",
    response_model=APIResponse[DayStatusResponse],
    summary="Kiểm tra trạng thái ngày (WFH? Lễ? T7/CN? Công tác?)",
)
def get_day_status(
    user_id: str = Query(...),
    date: str    = Query(..., description="YYYY-MM-DD"),
):
    data = service.get_day_status(user_id, date)
    return APIResponse.ok(data)


# ── Manager: Xem & Duyệt ─────────────────────────────────────────────────────────

@router.get(
    "/pending",
    response_model=APIResponse[list[LeaveRecord]],
    summary="Xem danh sách request chờ duyệt (Manager/Admin)",
)
def get_pending_requests(
    department: Optional[str] = Query(None, description="Lọc theo phòng ban"),
):
    data = service.get_pending_requests(department=department)
    return APIResponse.ok(data)


@router.patch(
    "/{request_id}/approve",
    response_model=APIResponse[LeaveRecord],
    summary="Duyệt request",
)
def approve_leave(request_id: str, payload: LeaveApprovalRequest):
    data = service.approve_leave(request_id, payload)
    return APIResponse.ok(data)


@router.patch(
    "/{request_id}/reject",
    response_model=APIResponse[LeaveRecord],
    summary="Từ chối request",
)
def reject_leave(request_id: str, payload: LeaveApprovalRequest):
    data = service.reject_leave(request_id, payload)
    return APIResponse.ok(data)


# ── Manager/Admin: Thêm ngày công tác ────────────────────────────────────────────

@router.post(
    "/business-trip",
    response_model=APIResponse[LeaveRecord],
    summary="Thêm ngày công tác cho nhân viên (Manager/Admin)",
)
def add_business_trip(
    payload: BusinessTripCreate,
    x_user_id: str = Header(..., description="ID của Manager/Admin thực hiện thao tác"),
):
    data = service.add_business_trip(payload, added_by=x_user_id)
    return APIResponse.ok(data)


# ── Admin: Quản lý ngày lễ ───────────────────────────────────────────────────────

@router.get(
    "/holidays",
    response_model=APIResponse[list[HolidayRecord]],
    summary="Lấy danh sách ngày lễ",
)
def list_holidays(
    year: Optional[int] = Query(None, description="Lọc theo năm (VD: 2026)"),
):
    data = service.list_holidays(year=year)
    return APIResponse.ok(data)


@router.post(
    "/holidays",
    response_model=APIResponse[HolidayRecord],
    summary="Thêm ngày lễ (Admin)",
)
def add_holiday(payload: HolidayCreate):
    data = service.add_holiday(payload)
    return APIResponse.ok(data)


@router.delete(
    "/holidays/{date}",
    response_model=APIResponse[dict],
    summary="Xóa ngày lễ (Admin)",
)
def delete_holiday(date: str):
    service.delete_holiday(date)
    return APIResponse.ok({"message": f"Đã xóa ngày lễ {date}"})
