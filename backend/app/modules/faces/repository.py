"""DynamoDB repository for the Faces module.

Table: smart-campus-faces
PK: userId
SK: faceId  (from Rekognition)
Attributes: s3Key, confidence, registeredAt, status
"""

from boto3.dynamodb.conditions import Key, Attr

from app.core.config import settings
from app.shared.aws.dynamodb import put_item, get_item, query_items, update_item

TABLE = settings.faces_table


def save_face(item: dict) -> dict:
    """Persist face metadata after successful Rekognition IndexFaces."""
    put_item(TABLE, item)
    return item


def get_face(user_id: str, face_id: str) -> dict | None:
    return get_item(TABLE, key={"userId": user_id, "faceId": face_id})


def list_faces_by_user(user_id: str) -> list[dict]:
    """List all registered faces for a user."""
    return query_items(TABLE, key_condition=Key("userId").eq(user_id))


def deactivate_face(user_id: str, face_id: str) -> dict:
    """Mark a face record as INACTIVE (soft delete)."""
    return update_item(
        TABLE,
        key={"userId": user_id, "faceId": face_id},
        update_expression="SET #s = :s",
        expression_values={":s": "INACTIVE"},
        expression_names={"#s": "status"},
    )
