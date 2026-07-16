"""FastAPI router for the Reports module (Workflow 5 – Analytics Pipeline).

Endpoints:
    GET /reports/summary              – Báo cáo tổng hợp theo khoảng thời gian (Phase 1: DynamoDB)
    GET /reports/daily/{date}         – Báo cáo điểm danh theo ngày (Phase 1: DynamoDB)
    GET /reports/trend                – Xu hướng điểm danh theo ngày (Phase 2: Athena/DynamoDB)
    GET /reports/users/{user_id}/stats– Thống kê chi tiết 1 user (Phase 2: Athena/DynamoDB)
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Query

from app.core.responses import APIResponse
from .schemas import (
    ReportSummaryResponse,
    AttendanceSummary,
    AttendanceTrendResponse,
    UserStatsResponse,
)
from . import service

router = APIRouter(prefix="/reports", tags=["Reports (WF5)"])


# ── Phase 1: DynamoDB-backed ──────────────────────────────────────────────────

@router.get(
    "/summary",
    response_model=APIResponse[ReportSummaryResponse],
    summary="Báo cáo tổng hợp điểm danh",
    description="""
Sinh báo cáo tổng hợp điểm danh theo khoảng thời gian.

**Nguồn dữ liệu:** Amazon DynamoDB.

**Trả về:**
- Danh sách tóm tắt từng ngày (theo ca học).
- Top 10 học sinh/nhân viên có tỉ lệ điểm danh thấp nhất.
- Tỉ lệ điểm danh tổng thể toàn kỳ.
    """,
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
    description="Lấy tóm tắt điểm danh cho tất cả các ca học trong một ngày cụ thể.",
)
def get_daily_report(date: str):
    data = service.get_daily_summary(date)
    return APIResponse.ok(data)


# ── Phase 2: Athena-backed (with DynamoDB fallback) ───────────────────────────

@router.get(
    "/trend",
    response_model=APIResponse[AttendanceTrendResponse],
    summary="Xu hướng điểm danh theo ngày (Analytics)",
    description="""
Trả về dữ liệu xu hướng điểm danh theo từng ngày trong khoảng thời gian.
Dùng để vẽ biểu đồ đường (line chart) trên Dashboard.

**Nguồn dữ liệu:**
- Ưu tiên **Amazon Athena** (S3 Data Lake) nếu `ATHENA_OUTPUT_LOCATION` đã được cấu hình.
- Tự động **fallback về DynamoDB** nếu Athena chưa sẵn sàng.

Trường `data_source` trong response cho biết nguồn thực tế đang được dùng.
    """,
)
def get_attendance_trend(
    period_start: str = Query(
        default=None,
        description="Ngày bắt đầu (YYYY-MM-DD). Mặc định: 30 ngày trước",
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
        period_start = (today - timedelta(days=30)).strftime("%Y-%m-%d")

    data = service.get_attendance_trend(period_start, period_end)
    return APIResponse.ok(data)


@router.get(
    "/users/{user_id}/stats",
    response_model=APIResponse[UserStatsResponse],
    summary="Thống kê điểm danh chi tiết theo user",
    description="""
Lấy toàn bộ lịch sử và thống kê điểm danh của một người dùng cụ thể.

**Nguồn dữ liệu:**
- Ưu tiên **Amazon Athena** (S3 Data Lake) nếu `ATHENA_OUTPUT_LOCATION` đã được cấu hình.
- Tự động **fallback về DynamoDB** nếu Athena chưa sẵn sàng.

Trường `data_source` trong response cho biết nguồn thực tế đang được dùng.
    """,
)
def get_user_stats(
    user_id: str,
    period_start: str = Query(
        default=None,
        description="Ngày bắt đầu (YYYY-MM-DD). Mặc định: 30 ngày trước",
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
        period_start = (today - timedelta(days=30)).strftime("%Y-%m-%d")

    data = service.get_user_stats(user_id, period_start, period_end)
    return APIResponse.ok(data)
