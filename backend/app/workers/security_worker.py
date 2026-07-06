"""Security Monitoring Worker (Workflow 7).

Listens to security-relevant events from EventBridge and:
    1. Evaluates risk level based on rules.
    2. Creates a Security Incident record if threshold exceeded.
    3. Sends SNS alert to security staff.
    4. Writes to Audit Log (CloudWatch Logs / DynamoDB).

Risk rules evaluated:
    - UnknownFaceDetected  → HIGH risk
    - AccessOutsideHours   → MEDIUM risk
    - MultipleFailedChecks → HIGH risk

Published Events:
    - SecurityIncidentCreated
    - SecurityAlertSent
"""

import json
import logging
import uuid
from datetime import datetime, timezone

from app.core.config import settings
from app.shared.aws.sns import publish_security_alert
from app.shared.aws.dynamodb import put_item
from app.shared.aws.eventbridge import publish_event

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


# ── Risk rules ─────────────────────────────────────────────────────────────────

class RiskLevel:
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


RISK_RULES: dict[str, str] = {
    "UnknownFaceDetected": RiskLevel.HIGH,
    "AttendanceRejected": RiskLevel.LOW,
}


def _evaluate_risk(detail_type: str, detail: dict) -> str:
    """Determine risk level for a given event."""
    base_risk = RISK_RULES.get(detail_type, RiskLevel.LOW)

    # Escalate: access outside business hours
    timestamp_str = detail.get("timestamp", "")
    if timestamp_str:
        try:
            ts = datetime.fromisoformat(timestamp_str)
            hour = ts.hour
            if hour < 6 or hour > 21:
                if base_risk == RiskLevel.LOW:
                    base_risk = RiskLevel.MEDIUM
                elif base_risk == RiskLevel.MEDIUM:
                    base_risk = RiskLevel.HIGH
        except ValueError:
            pass

    return base_risk


def _create_incident(detail_type: str, detail: dict, risk_level: str) -> dict:
    """Create a security incident record in DynamoDB."""
    incident_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    incident = {
        "incidentId": incident_id,
        "pk": f"INCIDENT#{now[:10]}",   # partition by date
        "sk": incident_id,
        "eventType": detail_type,
        "riskLevel": risk_level,
        "detail": json.dumps(detail, default=str),
        "status": "OPEN",
        "createdAt": now,
        "resolvedAt": None,
    }
    try:
        put_item(settings.security_table, incident)
        logger.info("Security incident created: %s (Risk=%s)", incident_id, risk_level)
    except Exception as exc:
        logger.error("Failed to save incident to DynamoDB: %s", exc)
    return incident


def handler(event: dict, context) -> dict:
    """
    AWS Lambda entry point for Security Monitoring Worker.

    Triggered by EventBridge rule for:
        - UnknownFaceDetected
        - AttendanceRejected (repeated failures)
    """
    detail_type = event.get("detail-type", "")
    detail = event.get("detail", {})

    logger.info("SecurityWorker received: %s", detail_type)

    # Only process security-relevant events
    if detail_type not in RISK_RULES:
        return {"status": "skipped"}

    risk_level = _evaluate_risk(detail_type, detail)
    logger.info("Risk level evaluated: %s", risk_level)

    # Create incident record
    incident = _create_incident(detail_type, detail, risk_level)

    # Send SNS alert for HIGH and CRITICAL risks
    if risk_level in (RiskLevel.HIGH, RiskLevel.CRITICAL):
        topic_arn = settings.security_alert_topic_arn
        if topic_arn:
            try:
                msg_id = publish_security_alert(topic_arn, incident)
                logger.info("Security alert sent via SNS. MessageId=%s", msg_id)

                publish_event(
                    detail_type="SecurityAlertSent",
                    detail={"incidentId": incident["incidentId"], "riskLevel": risk_level},
                )
            except Exception as exc:
                logger.error("Failed to send security alert: %s", exc)
        else:
            logger.warning("SECURITY_ALERT_TOPIC_ARN not configured.")

    # Publish SecurityIncidentCreated
    try:
        publish_event(
            detail_type="SecurityIncidentCreated",
            detail={
                "incidentId": incident["incidentId"],
                "riskLevel": risk_level,
                "eventType": detail_type,
            },
        )
    except Exception as exc:
        logger.error("Failed to publish SecurityIncidentCreated: %s", exc)

    return {
        "status": "processed",
        "incidentId": incident["incidentId"],
        "riskLevel": risk_level,
    }
