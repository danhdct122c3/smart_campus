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

    Triggered by SQS Queue (smart-campus-analytics-queue) containing batches
    of EventBridge 'AttendanceRecorded' events.
    """
    records = event.get("Records", [])
    logger.info("AnalyticsWorker (SQS) received %d records", len(records))

    failed_message_ids = []

    for record in records:
        message_id = record.get("messageId")
        try:
            # EventBridge payload is embedded in the SQS body
            body_str = record.get("body", "{}")
            eb_event = json.loads(body_str)
            
            detail_type = eb_event.get("detail-type", "")
            detail = eb_event.get("detail", {})

            if detail_type != "AttendanceRecorded":
                logger.info("Skipping non-attendance event: %s (MsgId: %s)", detail_type, message_id)
                continue

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

            record_id = _send_to_firehose(analytics_record)
            logger.info("Streamed to Firehose. MsgId=%s, RecordId=%s", message_id, record_id)

        except Exception as exc:
            logger.error("Failed to process message %s: %s", message_id, exc, exc_info=True)
            failed_message_ids.append(message_id)

    # Return partial batch failure standard format
    return {
        "batchItemFailures": [{"itemIdentifier": msg_id} for msg_id in failed_message_ids]
    }
