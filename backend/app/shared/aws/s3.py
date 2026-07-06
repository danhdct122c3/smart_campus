"""S3 client wrapper – upload, download, and presigned URL helpers."""

import boto3
from functools import lru_cache
from botocore.exceptions import ClientError

from app.core.config import settings


@lru_cache
def get_s3_client():
    return boto3.client("s3", region_name=settings.aws_region)


def upload_bytes(
    bucket: str,
    key: str,
    data: bytes,
    content_type: str = "image/jpeg",
) -> str:
    """Upload raw bytes to S3. Returns the S3 URI."""
    client = get_s3_client()
    client.put_object(
        Bucket=bucket,
        Key=key,
        Body=data,
        ContentType=content_type,
    )
    return f"s3://{bucket}/{key}"


def upload_fileobj(bucket: str, key: str, fileobj, content_type: str = "image/jpeg") -> str:
    """Upload a file-like object to S3. Returns the S3 URI."""
    client = get_s3_client()
    client.upload_fileobj(
        fileobj,
        bucket,
        key,
        ExtraArgs={"ContentType": content_type},
    )
    return f"s3://{bucket}/{key}"


def get_presigned_url(bucket: str, key: str, expires_in: int = 3600) -> str:
    """Generate a pre-signed GET URL valid for `expires_in` seconds."""
    client = get_s3_client()
    url = client.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=expires_in,
    )
    return url


def delete_object(bucket: str, key: str) -> bool:
    """Delete an object from S3."""
    client = get_s3_client()
    client.delete_object(Bucket=bucket, Key=key)
    return True


def object_exists(bucket: str, key: str) -> bool:
    """Check whether an object exists in S3."""
    client = get_s3_client()
    try:
        client.head_object(Bucket=bucket, Key=key)
        return True
    except ClientError:
        return False
