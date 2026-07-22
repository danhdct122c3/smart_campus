"""Shared AWS package – exposes all service clients."""

from .dynamodb import get_table, put_item, get_item, update_item, delete_item, query_items, scan_items, query_items_paginated, scan_items_paginated
from .s3 import upload_bytes, upload_fileobj, get_presigned_url, delete_object, object_exists
from .rekognition import (
    index_face,
    search_faces_by_image,
    delete_face,
    RekognitionError,
    NoFaceDetectedError,
    MultipleFacesError,
    FaceNotFoundError,
)
from .eventbridge import (
    publish_event,
    publish_face_registered,
    publish_attendance_recorded,
    publish_unknown_face_detected,
    publish_attendance_rejected,
    publish_security_incident_created,
    publish_notification_sent,
)
from .sns import publish_to_topic, publish_security_alert, publish_attendance_notification
from . import athena, bedrock, ses

__all__ = [
    # DynamoDB
    "get_table", "put_item", "get_item", "update_item", "delete_item",
    "query_items", "scan_items",
    # S3
    "upload_bytes", "upload_fileobj", "get_presigned_url", "delete_object", "object_exists",
    # Rekognition
    "index_face", "search_faces_by_image", "delete_face",
    "RekognitionError", "NoFaceDetectedError", "MultipleFacesError", "FaceNotFoundError",
    # EventBridge
    "publish_event", "publish_face_registered", "publish_attendance_recorded",
    "publish_unknown_face_detected", "publish_attendance_rejected",
    "publish_security_incident_created", "publish_notification_sent",
    # SNS
    "publish_to_topic", "publish_security_alert", "publish_attendance_notification",
    # Athena, Bedrock & SES (as modules)
    "athena", "bedrock", "ses",
]
