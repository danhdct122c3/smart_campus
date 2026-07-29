from fastapi import APIRouter

from app.core.responses import APIResponse
from .schemas import LoginRequest, TokenResponse, NewPasswordChallengeRequest, VerifyFaceRequest, ResetPasswordFaceRequest
from . import service

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post(
    "/login",
    response_model=APIResponse[TokenResponse],
    summary="Đăng nhập hệ thống",
    description="Xác thực người dùng qua Amazon Cognito (hoặc Local DB mode) và trả về Access Token cùng User Profile."
)
def login(payload: LoginRequest):
    data = service.authenticate_user(payload)
    return APIResponse.ok(data, message="Xử lý thành công.")

@router.post(
    "/respond-challenge",
    response_model=APIResponse[TokenResponse],
    summary="Đổi mật khẩu lần đầu (Force Change Password)",
    description="Xử lý luồng NEW_PASSWORD_REQUIRED của AWS Cognito."
)
def respond_challenge(payload: NewPasswordChallengeRequest):
    data = service.respond_to_new_password_challenge(payload)
    return APIResponse.ok(data, message="Đổi mật khẩu thành công.")

@router.post(
    "/verify-face-reset",
    response_model=APIResponse[dict],
    summary="Xác thực khuôn mặt để reset mật khẩu",
    description="Nhận email và ảnh, kiểm tra qua AWS Rekognition xem có đúng khuôn mặt của chủ tài khoản không."
)
def verify_face_reset(payload: VerifyFaceRequest):
    data = service.verify_face_for_reset(payload)
    return APIResponse.ok(data)

@router.post(
    "/reset-password-face",
    response_model=APIResponse[dict],
    summary="Đổi mật khẩu bằng khuôn mặt",
    description="Xác thực lại khuôn mặt một lần nữa và tiến hành đặt lại mật khẩu mới vĩnh viễn trên Cognito."
)
def reset_password_face(payload: ResetPasswordFaceRequest):
    data = service.reset_password_by_face(payload)
    return APIResponse.ok(data)
