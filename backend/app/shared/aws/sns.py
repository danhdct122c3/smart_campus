"""Amazon SNS wrapper – publish notifications."""

import json
import boto3
from functools import lru_cache
from botocore.exceptions import ClientError

from app.core.config import settings


@lru_cache
def get_sns_client():
    return boto3.client("sns", region_name=settings.aws_region)


def publish_to_topic(
    topic_arn: str,
    subject: str,
    message: str | dict,
    message_attributes: dict | None = None,
) -> str:
    """
    Publish a message to an SNS topic.

    Args:
        topic_arn: Full ARN of the SNS topic.
        subject: Email subject (for email subscriptions).
        message: Plain string or dict (will be JSON-serialised).
        message_attributes: Optional SNS MessageAttributes dict for subscription filtering.

    Returns:
        SNS MessageId.
    """
    client = get_sns_client()
    body = message if isinstance(message, str) else json.dumps(message, default=str)
    try:
        kwargs = {
            "TopicArn": topic_arn,
            "Subject": subject,
            "Message": body,
        }
        if message_attributes:
            kwargs["MessageAttributes"] = message_attributes
        response = client.publish(**kwargs)
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


def subscribe_email_to_topic(topic_arn: str, email: str) -> str:
    """
    Subscribe an email address to an Amazon SNS topic.

    Note: AWS will immediately send a verification email with a 'Confirm subscription'
    link to this email address. The user MUST click that link before receiving any messages.
    """
    client = get_sns_client()
    try:
        response = client.subscribe(
            TopicArn=topic_arn,
            Protocol="email",
            Endpoint=email,
            ReturnSubscriptionArn=True,
        )
        return response["SubscriptionArn"]
    except ClientError as exc:
        raise RuntimeError(f"SNS email subscribe failed: {exc}") from exc
