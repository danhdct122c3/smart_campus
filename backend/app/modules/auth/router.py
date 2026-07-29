from fastapi import APIRouter

from app.core.responses import APIResponse
from .schemas import LoginRequest, TokenResponse, NewPasswordChallengeRequest
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
