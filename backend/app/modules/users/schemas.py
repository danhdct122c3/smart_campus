"""Pydantic schemas for the Users module."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class UserRole(str, Enum):
    ADMIN = "ADMIN"
    STUDENT = "STUDENT"
    STAFF = "STAFF"


class UserStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    SUSPENDED = "SUSPENDED"


# ── Request models ─────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=2, max_length=100)
    role: UserRole = UserRole.STUDENT
    department: Optional[str] = None
    phone: Optional[str] = None
    employee_id: Optional[str] = Field(None, description="Mã nhân viên / Sinh viên")


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    department: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[UserStatus] = None


# ── Response models ────────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    user_id: str
    email: str
    name: str
    role: UserRole
    department: Optional[str] = None
    phone: Optional[str] = None
    employee_id: Optional[str] = None
    status: UserStatus
    face_registered: bool = False
    created_at: str
    updated_at: Optional[str] = None


class UserListResponse(BaseModel):
    items: list[UserResponse]
    total: int
