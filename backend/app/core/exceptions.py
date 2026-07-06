"""Custom exceptions và Error Codes cho Smart Campus API.

Tương đương @ControllerAdvice + ErrorCode enum trong Spring Boot.
"""

from fastapi import HTTPException


class ErrorCode:
    # ── Auth ───────────────────────────────────────────────────────────────────
    UNAUTHORIZED            = "AUTH_001"
    FORBIDDEN               = "AUTH_002"
    TOKEN_EXPIRED           = "AUTH_003"

    # ── Users ──────────────────────────────────────────────────────────────────
    USER_NOT_FOUND          = "USER_001"
    USER_ALREADY_EXISTS     = "USER_002"
    USER_SUSPENDED          = "USER_003"

    # ── Faces ──────────────────────────────────────────────────────────────────
    FACE_NOT_FOUND              = "FACE_001"
    FACE_ALREADY_REGISTERED     = "FACE_002"
    FACE_INVALID_IMAGE          = "FACE_003"
    FACE_NO_FACE_DETECTED       = "FACE_004"
    FACE_MULTIPLE_DETECTED      = "FACE_005"
    FACE_IMAGE_TOO_LARGE        = "FACE_006"
    FACE_UNSUPPORTED_FORMAT     = "FACE_007"

    # ── Attendance ─────────────────────────────────────────────────────────────
    ATTENDANCE_UNKNOWN_FACE     = "ATTEND_001"
    ATTENDANCE_DUPLICATE        = "ATTEND_002"
    ATTENDANCE_OUTSIDE_SESSION  = "ATTEND_003"
    ATTENDANCE_INVALID_IMAGE    = "ATTEND_004"
    ATTENDANCE_INVALID_TIMESTAMP= "ATTEND_005"
    ATTENDANCE_MISSING_FILTER   = "ATTEND_006"

    # ── Reports ────────────────────────────────────────────────────────────────
    REPORT_INVALID_DATE_RANGE   = "REPORT_001"

    # ── AWS / System ───────────────────────────────────────────────────────────
    AWS_REKOGNITION_ERROR   = "AWS_001"
    AWS_S3_ERROR            = "AWS_002"
    AWS_EVENTBRIDGE_ERROR   = "AWS_003"
    INTERNAL_ERROR          = "SYS_001"
    VALIDATION_ERROR        = "SYS_002"


class AppException(HTTPException):
    """Custom exception với error_code để frontend xử lý một cách nhất quán.

    Tương đương AppException / BusinessException trong Spring Boot.

    Usage:
        raise AppException(
            error_code=ErrorCode.USER_NOT_FOUND,
            status_code=404,
            message="User 'xyz' không tồn tại.",
        )
    """

    def __init__(
        self,
        error_code: str,
        status_code: int,
        message: str | None = None,
    ):
        self.error_code = error_code
        self.message = message or error_code
        super().__init__(status_code=status_code, detail=self.message)
