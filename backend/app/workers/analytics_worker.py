"""Analytics Worker (Workflow 5 – Analytics Pipeline).

Consumes AttendanceRecorded events from EventBridge and streams data to:
    S3 Data Lake (Direct Put) → Glue Catalog → Athena → QuickSight

Published Events:
    None (fire-and-forget streaming)
"""

import json
import logging
import boto3
import uuid
from functools import lru_cache

from app.core.config import settings
from app.shared.aws.eventbridge import publish_event

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


@lru_cache
def get_s3_client():
    return boto3.client("s3", region_name=settings.aws_region)


def _write_to_s3(record: dict) -> str:
    """Stream a single attendance record directly to S3 Data Lake."""
    client = get_s3_client()
    data = json.dumps(record, ensure_ascii=False, default=str)
    
    # Generate unique filename with partitioning prefix
    # E.g., year=2024/month=12/day=05/uuid.json
    year = record.get("year", "0000")
    month = record.get("month", "00")
    day = record.get("day", "00")
    file_name = f"year={year}/month={month}/day={day}/{uuid.uuid4().hex}.json"
    
    client.put_object(
        Bucket=settings.data_lake_bucket,
        Key=file_name,
        Body=data.encode("utf-8"),
        ContentType="application/json"
    )
    return file_name


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
                "status": detail.get("status"),
                "timestamp": detail.get("timestamp"),
                # Partitioning fields for Glue/Athena
                "year": detail.get("timestamp", "")[:4] if detail.get("timestamp") else None,
                "month": detail.get("timestamp", "")[5:7] if detail.get("timestamp") else None,
                "day": detail.get("timestamp", "")[8:10] if detail.get("timestamp") else None,
            }

            # Write directly to S3
            record_id = _write_to_s3(analytics_record)
            logger.info("Wrote to S3 Data Lake. MsgId=%s, File=%s", message_id, record_id)

        except Exception as exc:
            logger.error("Failed to process message %s: %s", message_id, exc, exc_info=True)
            failed_message_ids.append(message_id)

    # Return partial batch failure standard format
    return {
        "batchItemFailures": [{"itemIdentifier": msg_id} for msg_id in failed_message_ids]
    }
