"""Generic API response wrapper cho Smart Campus API.

Tương đương ApiResponse<T> trong Spring Boot — bọc tất cả response
thành một cấu trúc nhất quán: { success, code, message, data }.
"""

from typing import Generic, TypeVar, Optional
from pydantic import BaseModel

T = TypeVar("T")


class APIResponse(BaseModel, Generic[T]):
    """Wrapper chuẩn cho mọi API response.

    Success:
        { "success": true,  "code": "SUCCESS", "message": "OK",  "data": {...} }

    Error:
        { "success": false, "code": "USER_001", "message": "...", "data": null }
    """

    success: bool = True
    code: str = "SUCCESS"
    message: str = "OK"
    data: Optional[T] = None

    # ── Factory methods ────────────────────────────────────────────────────────

    @classmethod
    def ok(cls, data: T, message: str = "OK") -> "APIResponse[T]":
        """200 – thành công, trả dữ liệu."""
        return cls(success=True, code="SUCCESS", message=message, data=data)

    @classmethod
    def created(cls, data: T, message: str = "Resource created successfully") -> "APIResponse[T]":
        """201 – tạo mới thành công."""
        return cls(success=True, code="CREATED", message=message, data=data)

    @classmethod
    def error(cls, code: str, message: str) -> "APIResponse[None]":
        """4xx / 5xx – lỗi, không có data."""
        return cls(success=False, code=code, message=message, data=None)
