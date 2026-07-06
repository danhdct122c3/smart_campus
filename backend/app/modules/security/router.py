"""FastAPI router for the Security Monitoring module (Workflow 7)."""

from typing import Optional

from fastapi import APIRouter, Query

from app.core.responses import APIResponse
from .schemas import (
    ResolveIncidentRequest,
    SecurityIncident,
    SecurityIncidentListResponse,
)
from . import service

router = APIRouter(prefix="/security", tags=["Security"])


@router.get(
    "/incidents",
    response_model=APIResponse[SecurityIncidentListResponse],
    summary="Danh sách Security Incidents",
    description="""
    Lấy danh sách các sự cố an ninh. Có thể lọc theo trạng thái và mức độ rủi ro.

    **Risk Levels**: LOW, MEDIUM, HIGH, CRITICAL

    **Status**: OPEN, RESOLVED, IGNORED
    """,
)
def list_incidents(
    status: Optional[str] = Query(None, description="Lọc: OPEN | RESOLVED | IGNORED"),
    risk_level: Optional[str] = Query(None, description="Lọc: LOW | MEDIUM | HIGH | CRITICAL"),
    limit: int = Query(100, ge=1, le=500, description="Số lượng tối đa"),
):
    items = service.list_incidents(
        status_filter=status,
        risk_level=risk_level,
        limit=limit,
    )
    data = SecurityIncidentListResponse(items=items, total=len(items))
    return APIResponse.ok(data)


@router.get(
    "/incidents/{incident_id}",
    response_model=APIResponse[SecurityIncident],
    summary="Chi tiết Security Incident",
)
def get_incident(incident_id: str):
    data = service.get_incident(incident_id)
    return APIResponse.ok(data)


@router.post(
    "/incidents/{incident_id}/resolve",
    response_model=APIResponse[SecurityIncident],
    summary="Đánh dấu Incident đã xử lý",
    description="Cập nhật trạng thái incident thành RESOLVED và ghi nhận ghi chú xử lý.",
)
def resolve_incident(incident_id: str, payload: ResolveIncidentRequest):
    data = service.resolve_incident(incident_id, payload)
    return APIResponse.ok(data, message="Incident đã được đánh dấu xử lý xong.")
