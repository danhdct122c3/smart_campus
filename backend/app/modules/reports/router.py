"""FastAPI router for the Reports module."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Query

from app.core.responses import APIResponse
from .schemas import ReportSummaryResponse, AttendanceSummary
from . import service

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get(
    "/summary",
    response_model=APIResponse[ReportSummaryResponse],
    summary="Báo cáo tổng hợp điểm danh theo khoảng thời gian",
)
def get_report_summary(
    period_start: str = Query(
        default=None,
        description="Ngày bắt đầu (YYYY-MM-DD). Mặc định: 7 ngày trước",
    ),
    period_end: str = Query(
        default=None,
        description="Ngày kết thúc (YYYY-MM-DD). Mặc định: hôm nay",
    ),
):
    today = datetime.now(timezone.utc)
    if not period_end:
        period_end = today.strftime("%Y-%m-%d")
    if not period_start:
        period_start = (today - timedelta(days=7)).strftime("%Y-%m-%d")

    data = service.get_report_summary(period_start, period_end)
    return APIResponse.ok(data)


@router.get(
    "/daily/{date}",
    response_model=APIResponse[list[AttendanceSummary]],
    summary="Báo cáo điểm danh theo ngày",
)
def get_daily_report(date: str):
    data = service.get_daily_summary(date)
    return APIResponse.ok(data)
