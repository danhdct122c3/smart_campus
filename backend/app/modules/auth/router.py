from fastapi import APIRouter

from app.core.responses import APIResponse
from .schemas import LoginRequest, TokenResponse
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
    return APIResponse.ok(data, message="Đăng nhập thành công.")
