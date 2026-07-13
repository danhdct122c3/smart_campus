"""Custom exceptions và Error Codes cho Smart Campus API.

Tương đương @ControllerAdvice + ErrorCode enum trong Spring Boot.
"""
from enum import Enum
from fastapi import HTTPException
from starlette import status

class ErrorCode(Enum):
    # ── Auth ───────────────────────────────────────────────────────────────────
    UNAUTHORIZED            = ("AUTH_001", status.HTTP_401_UNAUTHORIZED, "Xác thực không thành công hoặc token đã hết hạn.")
    FORBIDDEN               = ("AUTH_002", status.HTTP_403_FORBIDDEN, "Bạn không có quyền truy cập tài nguyên này.")
    TOKEN_EXPIRED           = ("AUTH_003", status.HTTP_401_UNAUTHORIZED, "Phiên đăng nhập đã hết hạn.")

    # ── Users ──────────────────────────────────────────────────────────────────
    USER_NOT_FOUND          = ("USER_001", status.HTTP_404_NOT_FOUND, "Không tìm thấy thông tin người dùng.")
    USER_ALREADY_EXISTS     = ("USER_002", status.HTTP_409_CONFLICT, "Người dùng đã tồn tại trong hệ thống.")
    USER_SUSPENDED          = ("USER_003", status.HTTP_403_FORBIDDEN, "Tài khoản người dùng đã bị đình chỉ.")

    # ── Faces ──────────────────────────────────────────────────────────────────
    FACE_NOT_FOUND              = ("FACE_001", status.HTTP_404_NOT_FOUND, "Không tìm thấy dữ liệu khuôn mặt.")
    FACE_ALREADY_REGISTERED     = ("FACE_002", status.HTTP_409_CONFLICT, "Người dùng này đã đăng ký khuôn mặt trước đó.")
    FACE_INVALID_IMAGE          = ("FACE_003", status.HTTP_400_BAD_REQUEST, "Dữ liệu ảnh không hợp lệ.")
    FACE_NO_FACE_DETECTED       = ("FACE_004", status.HTTP_422_UNPROCESSABLE_ENTITY, "Không phát hiện khuôn mặt trong ảnh.")
    FACE_MULTIPLE_DETECTED      = ("FACE_005", status.HTTP_422_UNPROCESSABLE_ENTITY, "Phát hiện nhiều khuôn mặt trong ảnh, vui lòng chỉ chụp 1 người.")
    FACE_IMAGE_TOO_LARGE        = ("FACE_006", status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Kích thước ảnh vượt quá giới hạn 5 MB.")
    FACE_UNSUPPORTED_FORMAT     = ("FACE_007", status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Định dạng ảnh không được hỗ trợ. Chỉ chấp nhận JPEG và PNG.")

    # ── Attendance ─────────────────────────────────────────────────────────────
    ATTENDANCE_UNKNOWN_FACE     = ("ATTEND_001", status.HTTP_404_NOT_FOUND, "Không nhận diện được khuôn mặt. Sự kiện UnknownFaceDetected đã được ghi nhận.")
    ATTENDANCE_DUPLICATE        = ("ATTEND_002", status.HTTP_200_OK, "Điểm danh đã được ghi nhận trước đó.")
    ATTENDANCE_OUTSIDE_SESSION  = ("ATTEND_003", status.HTTP_200_OK, "Thời gian hiện tại không nằm trong ca học nào.")
    ATTENDANCE_INVALID_IMAGE    = ("ATTEND_004", status.HTTP_400_BAD_REQUEST, "Dữ liệu ảnh base64 không hợp lệ.")
    ATTENDANCE_INVALID_TIMESTAMP= ("ATTEND_005", status.HTTP_400_BAD_REQUEST, "Định dạng timestamp không hợp lệ. Sử dụng ISO-8601 (VD: 2026-07-06T09:00:00Z).")
    ATTENDANCE_MISSING_FILTER   = ("ATTEND_006", status.HTTP_400_BAD_REQUEST, "Vui lòng cung cấp ít nhất một trong hai tham số: user_id hoặc date.")

    # ── Reports ────────────────────────────────────────────────────────────────
    REPORT_INVALID_DATE_RANGE   = ("REPORT_001", status.HTTP_400_BAD_REQUEST, "Khoảng thời gian báo cáo không hợp lệ.")

    # ── AWS / System ───────────────────────────────────────────────────────────
    AWS_REKOGNITION_ERROR   = ("AWS_001", status.HTTP_503_SERVICE_UNAVAILABLE, "Lỗi dịch vụ Rekognition.")
    AWS_S3_ERROR            = ("AWS_002", status.HTTP_503_SERVICE_UNAVAILABLE, "Lỗi dịch vụ S3.")
    AWS_EVENTBRIDGE_ERROR   = ("AWS_003", status.HTTP_503_SERVICE_UNAVAILABLE, "Lỗi phát sự kiện EventBridge.")
    INTERNAL_ERROR          = ("SYS_001", status.HTTP_500_INTERNAL_SERVER_ERROR, "Lỗi hệ thống nội bộ.")
    VALIDATION_ERROR        = ("SYS_002", status.HTTP_422_UNPROCESSABLE_ENTITY, "Lỗi kiểm tra dữ liệu đầu vào.")

    def __init__(self, code: str, http_status: int, default_message: str):
        self.code = code
        self.http_status = http_status
        self.default_message = default_message

class AppException(HTTPException):
    """Custom exception với error_code được cấu hình từ ErrorCode enum.
    
    Usage:
        raise AppException(ErrorCode.USER_NOT_FOUND)
        # Hoặc ghi đè message:
        raise AppException(ErrorCode.USER_NOT_FOUND, message="User STU-123 không tồn tại")
    """

    def __init__(
        self,
        error_code: ErrorCode,
        message: str | None = None,
        status_code: int | None = None,
    ):
        self.error_code_enum = error_code
        self.error_code = error_code.code
        self.message = message or error_code.default_message
        super().__init__(status_code=status_code or error_code.http_status, detail=self.message)
