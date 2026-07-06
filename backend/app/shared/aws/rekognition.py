"""Amazon Rekognition wrapper – IndexFaces and SearchFacesByImage."""

import boto3
from functools import lru_cache
from botocore.exceptions import ClientError

from app.core.config import settings


@lru_cache
def get_rekognition_client():
    return boto3.client("rekognition", region_name=settings.aws_region)


class RekognitionError(Exception):
    """Raised when Rekognition returns an unexpected error."""


class NoFaceDetectedError(RekognitionError):
    """Raised when no face is found in the image."""


class MultipleFacesError(RekognitionError):
    """Raised when more than one face is detected."""


class FaceNotFoundError(RekognitionError):
    """Raised when SearchFacesByImage finds no matching face."""


def index_face(image_bytes: bytes, external_image_id: str) -> dict:
    """
    Register a face into the Rekognition Collection.

    Returns:
        {
            "faceId": str,
            "confidence": float,
            "boundingBox": dict,
        }

    Raises:
        NoFaceDetectedError: if no face is found.
        MultipleFacesError: if more than one face is detected.
        RekognitionError: on any other Rekognition failure.
    """
    client = get_rekognition_client()
    try:
        response = client.index_faces(
            CollectionId=settings.face_collection_id,
            Image={"Bytes": image_bytes},
            ExternalImageId=external_image_id,
            MaxFaces=1,
            QualityFilter="AUTO",
            DetectionAttributes=["DEFAULT"],
        )
    except ClientError as exc:
        raise RekognitionError(str(exc)) from exc

    face_records = response.get("FaceRecords", [])
    unindexed = response.get("UnindexedFaces", [])

    if not face_records and unindexed:
        # Face detected but quality too low
        reasons = [r for uf in unindexed for r in uf.get("Reasons", [])]
        raise RekognitionError(f"Face not indexed. Reasons: {reasons}")

    if not face_records:
        raise NoFaceDetectedError("No face detected in the provided image.")

    face = face_records[0]["Face"]
    return {
        "faceId": face["FaceId"],
        "confidence": face["Confidence"],
        "boundingBox": face["BoundingBox"],
        "externalImageId": face.get("ExternalImageId", external_image_id),
    }


def search_faces_by_image(image_bytes: bytes, threshold: float = 80.0) -> dict:
    """
    Search for a matching face in the Collection.

    Returns:
        {
            "faceId": str,
            "userId": str,   # externalImageId used during index_face
            "similarity": float,
            "confidence": float,
        }

    Raises:
        NoFaceDetectedError: if no face is found in the query image.
        FaceNotFoundError: if no match found above the threshold.
        RekognitionError: on Rekognition failure.
    """
    client = get_rekognition_client()
    try:
        response = client.search_faces_by_image(
            CollectionId=settings.face_collection_id,
            Image={"Bytes": image_bytes},
            MaxFaces=1,
            FaceMatchThreshold=threshold,
        )
    except client.exceptions.InvalidParameterException as exc:
        raise NoFaceDetectedError("No face detected in the query image.") from exc
    except ClientError as exc:
        raise RekognitionError(str(exc)) from exc

    matches = response.get("FaceMatches", [])
    if not matches:
        raise FaceNotFoundError("No matching face found above the confidence threshold.")

    best = matches[0]
    face = best["Face"]
    return {
        "faceId": face["FaceId"],
        "userId": face.get("ExternalImageId", ""),
        "similarity": best["Similarity"],
        "confidence": face["Confidence"],
    }


def delete_face(face_id: str) -> bool:
    """Remove a face from the Rekognition Collection."""
    client = get_rekognition_client()
    try:
        client.delete_faces(
            CollectionId=settings.face_collection_id,
            FaceIds=[face_id],
        )
        return True
    except ClientError as exc:
        raise RekognitionError(str(exc)) from exc
