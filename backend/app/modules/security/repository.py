"""DynamoDB repository for the Security Monitoring module.

Table: smart-campus-security
PK: incidentId (UUID)
SK: "INCIDENT"
GSI: status-createdAt-index  (PK=status, SK=createdAt) – query open incidents
GSI: cameraId-index          (PK=cameraId) – query by camera
"""

from datetime import datetime, timezone

from boto3.dynamodb.conditions import Key, Attr

from app.core.config import settings
from app.shared.aws.dynamodb import put_item, get_item, update_item, query_items, scan_items

TABLE = settings.security_table
_SK = "INCIDENT"


def save_incident(item: dict) -> dict:
    """Persist a new security incident."""
    item["sk"] = _SK
    put_item(TABLE, item)
    return item


def get_incident(incident_id: str) -> dict | None:
    return get_item(TABLE, key={"incidentId": incident_id, "sk": _SK})


def list_incidents(
    status_filter: str | None = None,
    risk_level: str | None = None,
    limit: int = 100,
) -> list[dict]:
    """Scan incidents with optional filters."""
    filter_expr = Attr("sk").eq(_SK)
    if status_filter:
        filter_expr &= Attr("status").eq(status_filter)
    if risk_level:
        filter_expr &= Attr("riskLevel").eq(risk_level)
    return scan_items(TABLE, filter_expression=filter_expr, limit=limit)


def resolve_incident(incident_id: str, resolution_note: str) -> dict:
    """Mark an incident as resolved."""
    now = datetime.now(timezone.utc).isoformat()
    return update_item(
        TABLE,
        key={"incidentId": incident_id, "sk": _SK},
        update_expression="SET #s = :s, resolvedAt = :ra, resolutionNote = :rn, updatedAt = :ua",
        expression_values={
            ":s":  "RESOLVED",
            ":ra": now,
            ":rn": resolution_note,
            ":ua": now,
        },
        expression_names={"#s": "status"},
    )
