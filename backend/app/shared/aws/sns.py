"""Amazon SNS wrapper – publish notifications."""

import json
import boto3
from functools import lru_cache
from botocore.exceptions import ClientError

from app.core.config import settings


@lru_cache
def get_sns_client():
    return boto3.client("sns", region_name=settings.aws_region)


def publish_to_topic(topic_arn: str, subject: str, message: str | dict) -> str:
    """
    Publish a message to an SNS topic.

    Args:
        topic_arn: Full ARN of the SNS topic.
        subject: Email subject (for email subscriptions).
        message: Plain string or dict (will be JSON-serialised).

    Returns:
        SNS MessageId.
    """
    client = get_sns_client()
    body = message if isinstance(message, str) else json.dumps(message, default=str)
    try:
        response = client.publish(
            TopicArn=topic_arn,
            Subject=subject,
            Message=body,
        )
        return response["MessageId"]
    except ClientError as exc:
        raise RuntimeError(f"SNS publish failed: {exc}") from exc


def publish_security_alert(topic_arn: str, incident: dict) -> str:
    """Publish a security alert message."""
    return publish_to_topic(
        topic_arn=topic_arn,
        subject="[Smart Campus] Security Alert",
        message=incident,
    )


def publish_attendance_notification(topic_arn: str, payload: dict) -> str:
    """Publish an attendance notification to SNS."""
    return publish_to_topic(
        topic_arn=topic_arn,
        subject="[Smart Campus] Attendance Recorded",
        message=payload,
    )
