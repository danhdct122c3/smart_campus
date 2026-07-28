import time
import uuid
import boto3
from botocore.exceptions import ClientError
from fastapi import status

from app.core.config import get_settings
from app.core.exceptions import AppException, ErrorCode
from app.modules.users import repository as user_repo
from .schemas import LoginRequest, TokenResponse, UserProfile

settings = get_settings()

def get_cognito_client():
    if not settings.cognito_user_pool_id or not settings.cognito_client_id:
        return None
    return boto3.client('cognito-idp', region_name=settings.aws_region)

def authenticate_user(payload: LoginRequest) -> TokenResponse:
    """
    Authenticate user. Uses AWS Cognito if configured, otherwise falls back to local DB demo mode.
    """
    email = payload.email.lower()
    password = payload.password
    
    # 1. Tra cứu thông tin nghiệp vụ từ DynamoDB
    user_item = user_repo.get_user_by_email(email)
    if not user_item:
        raise AppException(
            ErrorCode.NOT_FOUND,
            message="Tài khoản không tồn tại trong hệ thống.",
            status_code=status.HTTP_401_UNAUTHORIZED
        )
        
    if user_item.get("status") != "ACTIVE":
        raise AppException(
            ErrorCode.FORBIDDEN,
            message="Tài khoản của bạn đã bị khóa hoặc chưa kích hoạt.",
            status_code=status.HTTP_403_FORBIDDEN
        )
        
    user_profile = UserProfile(
        user_id=user_item["user_id"],
        email=user_item["email"],
        name=user_item["name"],
        role=user_item["role"],
        department=user_item.get("department"),
        face_registered=user_item.get("face_registered", False)
    )

    cognito_client = get_cognito_client()
    
    # 2. Xác thực với AWS Cognito
    if cognito_client:
        try:
            response = cognito_client.initiate_auth(
                ClientId=settings.cognito_client_id,
                AuthFlow='USER_PASSWORD_AUTH',
                AuthParameters={
                    'USERNAME': email,
                    'PASSWORD': password
                }
            )
            auth_result = response.get('AuthenticationResult', {})
            
            return TokenResponse(
                access_token=auth_result.get('AccessToken', ''),
                id_token=auth_result.get('IdToken', ''),
                refresh_token=auth_result.get('RefreshToken'),
                expires_in=auth_result.get('ExpiresIn', 3600),
                user=user_profile
            )
            
        except cognito_client.exceptions.NotAuthorizedException:
            raise AppException(
                ErrorCode.UNAUTHORIZED,
                message="Email hoặc mật khẩu không chính xác.",
                status_code=status.HTTP_401_UNAUTHORIZED
            )
        except cognito_client.exceptions.UserNotFoundException:
            raise AppException(
                ErrorCode.NOT_FOUND,
                message="Tài khoản không tồn tại trên AWS Cognito. Vui lòng liên hệ Admin.",
                status_code=status.HTTP_401_UNAUTHORIZED
            )
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', '')
            if error_code == 'PasswordResetRequiredException':
                raise AppException(
                    ErrorCode.FORBIDDEN,
                    message="Bạn cần đặt lại mật khẩu trước khi đăng nhập.",
                    status_code=status.HTTP_403_FORBIDDEN
                )
            raise AppException(
                ErrorCode.INTERNAL_SERVER_ERROR,
                message=f"Lỗi xác thực từ máy chủ AWS: {str(e)}",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    # 3. Fallback: Local Demo Mode (nếu chưa cấu hình Cognito)
    # Trong môi trường dev/demo không cấu hình Cognito, chúng ta sẽ tự tạo mock token.
    # Mật khẩu hợp lệ trong chế độ demo thường là 'password' hoặc bỏ qua kiểm tra mật khẩu.
    # Để an toàn cho demo, ta vẫn có thể dùng mật khẩu ngẫu nhiên hoặc pass cứng.
    return TokenResponse(
        access_token=f"mock_access_token_{uuid.uuid4().hex}",
        id_token=f"mock_id_token_{uuid.uuid4().hex}",
        refresh_token=f"mock_refresh_token_{uuid.uuid4().hex}",
        expires_in=3600,
        user=user_profile
    )
