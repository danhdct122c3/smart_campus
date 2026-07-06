"""Pydantic schemas for the Faces module (Workflow 2 – Face Registration)."""

from typing import Optional
from pydantic import BaseModel, Field


# ── Request models ─────────────────────────────────────────────────────────────

class FaceRegisterRequest(BaseModel):
    """Register a face for a specific user."""
    user_id: str = Field(..., description="ID of the user to register face for")
    image_base64: str = Field(..., description="Base64-encoded image (JPEG/PNG)")


# ── Response models ────────────────────────────────────────────────────────────

class FaceResponse(BaseModel):
    face_id: str
    user_id: str
    s3_key: str
    confidence: float
    status: str
    registered_at: str
    presigned_url: Optional[str] = None


class FaceListResponse(BaseModel):
    items: list[FaceResponse]
    total: int
