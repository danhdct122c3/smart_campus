"""Business logic for Face Registration (Workflow 2).

Flow:
    1. Validate image format / size.
    2. Upload original image to S3 Raw Bucket.
    3. Call Rekognition IndexFaces → get faceId.
    4. Save Face Metadata to DynamoDB.
    5. Publish FaceRegistered event to EventBridge.
    6. Mark user.faceRegistered = True.
"""

import base64
import uuid
from datetime import datetime, timezone

from fastapi import status

from app.core.config import settings
from app.core.exceptions import AppException, ErrorCode
from app.shared.aws import (
    s3,
    rekognition as reko,
    publish_face_registered,
    get_presigned_url,
)
from app.modules.users import service as user_service
from .schemas import FaceRegisterRequest, FaceResponse
from . import repository as repo


_ALLOWED_FORMATS = {b"\xff\xd8\xff": "image/jpeg", b"\x89PNG": "image/png"}
_MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


def _decode_image(image_base64: str) -> bytes:
    """Decode base64 image string and validate format/size."""
    if "," in image_base64:
        image_base64 = image_base64.split(",", 1)[1]

    try:
        image_bytes = base64.b64decode(image_base64)
    except Exception:
        raise AppException(
            error_code=ErrorCode.FACE_INVALID_IMAGE,
            status_code=status.HTTP_400_BAD_REQUEST,
            message="Dữ liệu ảnh base64 không hợp lệ.",
        )

    if len(image_bytes) > _MAX_SIZE_BYTES:
        raise AppException(
            error_code=ErrorCode.FACE_IMAGE_TOO_LARGE,
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            message=f"Ảnh vượt quá kích thước tối đa {_MAX_SIZE_BYTES // 1024 // 1024} MB.",
        )

    for magic in _ALLOWED_FORMATS:
        if image_bytes[: len(magic)] == magic:
            return image_bytes

    raise AppException(
        error_code=ErrorCode.FACE_UNSUPPORTED_FORMAT,
        status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
        message="Định dạng ảnh không được hỗ trợ. Chỉ chấp nhận JPEG và PNG.",
    )


def register_face(payload: FaceRegisterRequest) -> FaceResponse:
    """Full Workflow 2 – register a user's face."""

    # 1. Ensure user exists
    user_service.get_user(payload.user_id)  # raises AppException 404 if not found

    # 2. Decode + validate image
    image_bytes = _decode_image(payload.image_base64)

    # 3. Upload to S3 raw bucket
    now = datetime.now(timezone.utc)
    s3_key = f"faces/raw/{payload.user_id}/{now.strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}.jpg"
    try:
        s3.upload_bytes(settings.image_bucket, s3_key, image_bytes)
    except Exception as exc:
        raise AppException(
            error_code=ErrorCode.AWS_S3_ERROR,
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            message=f"Không thể upload ảnh lên S3: {exc}",
        )

    # 4. Rekognition IndexFaces
    try:
        result = reko.index_face(image_bytes, external_image_id=payload.user_id)
    except reko.NoFaceDetectedError:
        raise AppException(
            error_code=ErrorCode.FACE_NO_FACE_DETECTED,
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            message="Không phát hiện khuôn mặt trong ảnh. Vui lòng tải ảnh chụp rõ khuôn mặt.",
        )
    except reko.MultipleFacesError:
        raise AppException(
            error_code=ErrorCode.FACE_MULTIPLE_DETECTED,
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            message="Phát hiện nhiều khuôn mặt. Vui lòng tải ảnh chỉ có một người.",
        )
    except reko.RekognitionError as exc:
        raise AppException(
            error_code=ErrorCode.AWS_REKOGNITION_ERROR,
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            message=f"Lỗi dịch vụ nhận diện khuôn mặt: {exc}",
        )

    # 5. Save face metadata to DynamoDB
    face_item = {
        "face_id": result["faceId"],   # DynamoDB PK (snake_case)
        "userId": payload.user_id,
        "faceId": result["faceId"],
        "s3Key": s3_key,
        "confidence": str(result["confidence"]),
        "boundingBox": {k: str(v) for k, v in result["boundingBox"].items()},
        "status": "ACTIVE",
        "registeredAt": now.isoformat(),
    }
    repo.save_face(face_item)

    # 6. Publish FaceRegistered event (non-critical)
    try:
        publish_face_registered(
            user_id=payload.user_id,
            face_id=result["faceId"],
            confidence=result["confidence"],
        )
    except Exception:
        pass

    # 7. Mark user.faceRegistered = True (non-critical)
    try:
        user_service.mark_face_registered(payload.user_id)
    except Exception:
        pass

    # 8. Generate presigned URL for viewing
    presigned = get_presigned_url(settings.image_bucket, s3_key, expires_in=3600)

    return FaceResponse(
        face_id=result["faceId"],
        user_id=payload.user_id,
        s3_key=s3_key,
        confidence=float(result["confidence"]),
        status="ACTIVE",
        registered_at=now.isoformat(),
        presigned_url=presigned,
    )


def list_faces(user_id: str) -> list[FaceResponse]:
    """List all face records for a user."""
    user_service.get_user(user_id)  # 404 guard
    items = repo.list_faces_by_user(user_id)
    result = []
    for item in items:
        presigned = get_presigned_url(settings.image_bucket, item["s3Key"])
        result.append(
            FaceResponse(
                face_id=item["faceId"],
                user_id=item["userId"],
                s3_key=item["s3Key"],
                confidence=float(item.get("confidence", 0)),
                status=item.get("status", "ACTIVE"),
                registered_at=item["registeredAt"],
                presigned_url=presigned,
            )
        )
    return result
