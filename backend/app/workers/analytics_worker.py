"""Analytics Worker (Workflow 5 – Analytics Pipeline).

Consumes AttendanceRecorded events from EventBridge and streams data to:
    Kinesis Firehose → S3 Data Lake → Glue Catalog → Athena → QuickSight

Published Events:
    None (fire-and-forget streaming)
"""

import json
import logging
import boto3
from functools import lru_cache

from app.core.config import settings
from app.shared.aws.eventbridge import publish_event

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


@lru_cache
def get_firehose_client():
    return boto3.client("firehose", region_name=settings.aws_region)


DELIVERY_STREAM = "smart-campus-attendance-stream"


def _send_to_firehose(record: dict) -> str:
    """Stream a single attendance record to Kinesis Firehose → S3 Data Lake."""
    client = get_firehose_client()
    # Firehose expects newline-delimited JSON
    data = json.dumps(record, ensure_ascii=False, default=str) + "\n"
    response = client.put_record(
        DeliveryStreamName=DELIVERY_STREAM,
        Record={"Data": data.encode("utf-8")},
    )
    return response["RecordId"]


def handler(event: dict, context) -> dict:
    """
    AWS Lambda entry point for Analytics Worker.

    Triggered by EventBridge rule matching source="smart-campus.api"
    and detail-type="AttendanceRecorded".
    """
    detail_type = event.get("detail-type", "")
    detail = event.get("detail", {})

    logger.info("AnalyticsWorker received: %s", detail_type)

    if detail_type != "AttendanceRecorded":
        logger.info("Skipping non-attendance event: %s", detail_type)
        return {"status": "skipped"}

    # Build analytics record (flattened for Athena/QuickSight)
    analytics_record = {
        "event_type": detail_type,
        "attendance_id": detail.get("attendanceId"),
        "user_id": detail.get("userId"),
        "camera_id": detail.get("cameraId"),
        "room_id": detail.get("roomId"),
        "status": detail.get("status"),
        "timestamp": detail.get("timestamp"),
        # Partitioning fields for Glue/Athena
        "year": detail.get("timestamp", "")[:4] if detail.get("timestamp") else None,
        "month": detail.get("timestamp", "")[5:7] if detail.get("timestamp") else None,
        "day": detail.get("timestamp", "")[8:10] if detail.get("timestamp") else None,
    }

    try:
        record_id = _send_to_firehose(analytics_record)
        logger.info("Streamed to Firehose. RecordId=%s", record_id)
        return {"status": "streamed", "recordId": record_id}
    except Exception as exc:
        logger.error("Failed to stream to Firehose: %s", exc, exc_info=True)
        raise  # Lambda retry / DLQ
