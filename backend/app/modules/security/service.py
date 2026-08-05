"""Business logic for the Security Monitoring module (Workflow 7).

Flow:
    1. Security Service lắng nghe events từ EventBridge:
       - UnknownFaceDetected  → HIGH risk
       - AttendanceRecorded với access ngoài giờ → MEDIUM risk
       - Blacklist match → CRITICAL risk
    2. Đánh giá mức độ rủi ro (RiskLevel).
    3. Nếu vượt ngưỡng → tạo SecurityIncident trong DynamoDB.
    4. Publish SecurityIncidentCreated lên EventBridge.
    5. Gửi SNS alert đến nhân viên an ninh.

REST API:
    - GET  /security/incidents        → danh sách incidents
    - GET  /security/incidents/{id}   → chi tiết
    - POST /security/incidents/{id}/resolve → đánh dấu xử lý xong
"""

import uuid
from datetime import datetime, timezone

from fastapi import status

from app.core.config import settings
from app.core.exceptions import AppException, ErrorCode
from app.shared.aws import publish_security_incident_created
from app.shared.aws.sns import publish_security_alert
from .schemas import (
    IncidentType,
    IncidentStatus,
    RiskLevel,
    ResolveIncidentRequest,
    SecurityIncident,
)
from . import repository as repo


# ── Risk evaluation rules ──────────────────────────────────────────────────────

_INCIDENT_RISK_MAP: dict[IncidentType, RiskLevel] = {
    IncidentType.UNKNOWN_FACE:     RiskLevel.HIGH,
    IncidentType.BLACKLIST_MATCH:  RiskLevel.CRITICAL,
    IncidentType.AFTER_HOURS:      RiskLevel.MEDIUM,
    IncidentType.RESTRICTED_AREA:  RiskLevel.HIGH,
    IncidentType.MULTIPLE_ENTRIES: RiskLevel.LOW,
}

# Only create incident + alert if risk is at or above this threshold
_ALERT_THRESHOLD_ORDER = [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL]
_MIN_ALERT_RISK = RiskLevel.MEDIUM


def _risk_gte(risk: RiskLevel, threshold: RiskLevel) -> bool:
    return _ALERT_THRESHOLD_ORDER.index(risk) >= _ALERT_THRESHOLD_ORDER.index(threshold)


def handle_unknown_face(
    camera_id: str,
    s3_key: str,
    timestamp: str,
) -> SecurityIncident:
    """Handle UnknownFaceDetected event from WF3."""
    return _create_incident(
        incident_type=IncidentType.UNKNOWN_FACE,
        description=f"Phát hiện khuôn mặt không nhận dạng được tại camera '{camera_id}' lúc {timestamp}.",
        camera_id=camera_id,
        s3_key=s3_key,
    )


def handle_after_hours_access(
    user_id: str,
    camera_id: str,
    timestamp: str,
) -> SecurityIncident:
    """Handle AttendanceRecorded outside working hours."""
    return _create_incident(
        incident_type=IncidentType.AFTER_HOURS,
        description=f"Người dùng '{user_id}' truy cập ngoài giờ quy định lúc {timestamp}.",
        camera_id=camera_id,
        user_id=user_id,
    )


def _create_incident(
    incident_type: IncidentType,
    description: str,
    camera_id: str | None = None,
    user_id: str | None = None,
    s3_key: str | None = None,
) -> SecurityIncident:
    """Core: create incident, publish event, send SNS alert."""
    risk_level = _INCIDENT_RISK_MAP.get(incident_type, RiskLevel.LOW)
    now = datetime.now(timezone.utc).isoformat()
    incident_id = str(uuid.uuid4())

    item = {
        "incidentId": incident_id,
        "incidentType": incident_type.value,
        "riskLevel": risk_level.value,
        "status": IncidentStatus.OPEN.value,
        "description": description,
        "cameraId": camera_id,
        "userId": user_id,
        "s3Key": s3_key,
        "createdAt": now,
        "resolvedAt": None,
        "resolutionNote": None,
    }
    repo.save_incident(item)

    # Publish SecurityIncidentCreated event (non-critical)
    try:
        publish_security_incident_created(
            incident_id=incident_id,
            risk_level=risk_level.value,
            incident_type=incident_type.value,
            description=description,
            camera_id=camera_id,
            user_id=user_id,
        )
    except Exception:
        pass

    # Send SNS alert for HIGH / CRITICAL incidents
    if _risk_gte(risk_level, _MIN_ALERT_RISK) and settings.security_alert_topic_arn:
        try:
            publish_security_alert(
                topic_arn=settings.security_alert_topic_arn,
                incident={
                    "incidentId": incident_id,
                    "riskLevel": risk_level.value,
                    "incidentType": incident_type.value,
                    "description": description,
                    "cameraId": camera_id,
                    "userId": user_id,
                    "createdAt": now,
                },
            )
        except Exception:
            pass

    return _to_incident(item)


def list_incidents(
    status_filter: str | None,
    risk_level: str | None,
    limit: int,
) -> list[SecurityIncident]:
    items = repo.list_incidents(
        status_filter=status_filter,
        risk_level=risk_level,
        limit=limit,
    )
    return [_to_incident(i) for i in items]


def get_incident(incident_id: str) -> SecurityIncident:
    item = repo.get_incident(incident_id)
    if not item:
        raise AppException(
            ErrorCode.INTERNAL_ERROR,
            message=f"Security incident '{incident_id}' không tồn tại.",
        )
    return _to_incident(item)


def resolve_incident(incident_id: str, payload: ResolveIncidentRequest) -> SecurityIncident:
    existing = repo.get_incident(incident_id)
    if not existing:
        raise AppException(
            ErrorCode.INTERNAL_ERROR,
            message=f"Security incident '{incident_id}' không tồn tại.",
        )
    updated = repo.resolve_incident(incident_id, payload.resolution_note)
    # Merge updated fields into existing for response
    existing.update(updated)
    return _to_incident(existing)


def _to_incident(item: dict) -> SecurityIncident:
    return SecurityIncident(
        incident_id=item["incidentId"],
        incident_type=item["incidentType"],
        risk_level=item["riskLevel"],
        status=item["status"],
        description=item["description"],
        camera_id=item.get("cameraId"),
        user_id=item.get("userId"),
        s3_key=item.get("s3Key"),
        created_at=item["createdAt"],
        resolved_at=item.get("resolvedAt"),
        resolution_note=item.get("resolutionNote"),
    )


# ── Network & WAF Operations ───────────────────────────────────────────────────

import boto3
from . import settings_repo
from .schemas import NetworkItem, AddNetworkRequest, NetworkListResponse

def get_current_waf_ip() -> str | None:
    waf = boto3.client("wafv2", region_name="us-east-1")
    ip_set_name = "SmartCampusIPSet"
    ip_set_id = "4ebe5eff-235c-4a55-8c04-c1155b3118e0"
    try:
        res = waf.get_ip_set(
            Name=ip_set_name,
            Scope="CLOUDFRONT",
            Id=ip_set_id
        )
        addresses = res.get("IPSet", {}).get("Addresses", [])
        if addresses:
            return addresses[0].split("/")[0]
        return None
    except Exception:
        return None

def list_networks() -> NetworkListResponse:
    items = settings_repo.get_networks()
    networks = [NetworkItem(**i) for i in items]
    current_waf_ip = get_current_waf_ip()
    return NetworkListResponse(networks=networks, current_waf_ip=current_waf_ip)

def add_network(payload: AddNetworkRequest) -> NetworkItem:
    items = settings_repo.get_networks()
    new_item = {
        "id": str(uuid.uuid4()),
        "name": payload.name,
        "ip": payload.ip
    }
    items.append(new_item)
    settings_repo.save_networks(items)
    return NetworkItem(**new_item)

def update_waf_ip(ip: str) -> None:
    waf = boto3.client("wafv2", region_name="us-east-1")
    ip_set_name = "SmartCampusIPSet"
    ip_set_id = "4ebe5eff-235c-4a55-8c04-c1155b3118e0"
    
    res = waf.get_ip_set(
        Name=ip_set_name,
        Scope="CLOUDFRONT",
        Id=ip_set_id
    )
    lock_token = res["LockToken"]
    
    ip_with_cidr = f"{ip}/32" if "/" not in ip else ip
    waf.update_ip_set(
        Name=ip_set_name,
        Scope="CLOUDFRONT",
        Id=ip_set_id,
        Addresses=[ip_with_cidr],
        LockToken=lock_token
    )

