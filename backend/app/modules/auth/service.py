import time
import uuid
import time
import uuid
import boto3
from botocore.exceptions import ClientError
from fastapi import status

from app.core.config import get_settings
from app.core.exceptions import AppException, ErrorCode
from app.modules.users import repository as user_repo
from .schemas import LoginRequest, TokenResponse, UserProfile, NewPasswordChallengeRequest, VerifyFaceRequest, ResetPasswordFaceRequest
from app.shared.aws import rekognition as reko
from app.modules.faces.service import _decode_image

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
            ErrorCode.USER_NOT_FOUND,
            message="Tài khoản không tồn tại trong hệ thống."
        )
        
    if user_item.get("status") != "ACTIVE":
        raise AppException(
            ErrorCode.FORBIDDEN,
            message="Tài khoản của bạn đã bị khóa hoặc chưa kích hoạt."
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
            
            if response.get('ChallengeName') == 'NEW_PASSWORD_REQUIRED':
                return TokenResponse(
                    challenge_name='NEW_PASSWORD_REQUIRED',
                    session=response['Session'],
                    user=user_profile
                )
                
            auth_result = response.get('AuthenticationResult', {})
            
            return TokenResponse(
                access_token=auth_result.get('AccessToken', ''),
                id_token=auth_result.get('IdToken', ''),
                refresh_token=auth_result.get('RefreshToken'),
                expires_in=auth_result.get('ExpiresIn', 3600),
                user=user_profile
            )
            
        except cognito_client.exceptions.NotAuthorizedException as e:
            print(f"Cognito NotAuthorizedException: {e}")
            raise AppException(
                ErrorCode.UNAUTHORIZED,
                message=f"Email hoặc mật khẩu không chính xác. (Lý do AWS: {str(e)})"
            )
        except cognito_client.exceptions.UserNotFoundException:
            # Tự động đồng bộ Mock User lên Cognito (Tính năng đặc biệt cho môi trường Demo/Thực tập)
            # Nếu user có trong DynamoDB nhưng chưa có trên Cognito -> Tự động tạo luôn trên Cognito!
            try:
                # 1. Tạo user trên Cognito (không gửi email)
                cognito_client.admin_create_user(
                    UserPoolId=settings.cognito_user_pool_id,
                    Username=email,
                    TemporaryPassword=password,
                    MessageAction='SUPPRESS'
                )
                # 2. Đặt mật khẩu vĩnh viễn luôn (tránh lỗi Force Change Password)
                cognito_client.admin_set_user_password(
                    UserPoolId=settings.cognito_user_pool_id,
                    Username=email,
                    Password=password,
                    Permanent=True
                )
                # 3. Đăng nhập lại ngay lập tức
                return authenticate_user(payload)
                
            except Exception as e:
                raise AppException(
                    ErrorCode.USER_NOT_FOUND,
                    message="Tài khoản không tồn tại trên Cognito. Đã thử đồng bộ nhưng thất bại: " + str(e)
                )
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', '')
            if error_code == 'PasswordResetRequiredException':
                raise AppException(
                    ErrorCode.FORBIDDEN,
                    message="Bạn cần đặt lại mật khẩu trước khi đăng nhập."
                )
            raise AppException(
                ErrorCode.INTERNAL_ERROR,
                message=f"Lỗi xác thực từ máy chủ AWS: {str(e)}"
            )
    
    # 3. Fallback: Local Demo Mode (nếu chưa cấu hình Cognito)
    # Trong môi trường dev/demo không cấu hình Cognito, chúng ta sẽ tự tạo mock token.
    # Mật khẩu hợp lệ trong chế độ demo thường là 'password' hoặc bỏ qua kiểm tra mật khẩu.
    # Để an toàn cho demo, ta vẫn có thể dùng mật khẩu ngẫu nhiên hoặc pass cứng.    
    return TokenResponse(
        access_token=f"mock_access_token_{uuid.uuid4()}",
        id_token=f"mock_id_token_{uuid.uuid4()}",
        expires_in=3600,
        user=user_profile
    )

def respond_to_new_password_challenge(payload: NewPasswordChallengeRequest) -> TokenResponse:
    email = payload.email.lower()
    
    # Lấy thông tin user profile
    user_item = user_repo.get_user_by_email(email)
    if not user_item:
        raise AppException(ErrorCode.USER_NOT_FOUND, message="Tài khoản không tồn tại.")
        
    user_profile = UserProfile(
        user_id=user_item["user_id"],
        email=user_item["email"],
        name=user_item["name"],
        role=user_item["role"],
        department=user_item.get("department"),
        face_registered=user_item.get("face_registered", False)
    )

    cognito_client = get_cognito_client()
    if not cognito_client:
        raise AppException(ErrorCode.VALIDATION_ERROR, message="Hệ thống đang chạy offline, không có Cognito.")
        
    try:
        response = cognito_client.respond_to_auth_challenge(
            ClientId=settings.cognito_client_id,
            ChallengeName='NEW_PASSWORD_REQUIRED',
            Session=payload.session,
            ChallengeResponses={
                'USERNAME': email,
                'NEW_PASSWORD': payload.new_password
            }
        )
        
        auth_result = response.get('AuthenticationResult', {})
        if not auth_result:
            raise AppException(ErrorCode.UNAUTHORIZED, message="Không thể hoàn tất đổi mật khẩu.")
            
        # Tự động gửi email verify trên AWS SES cho user
        try:
            from app.shared.aws.ses import get_ses_client
            ses = get_ses_client()
            ses.verify_email_identity(EmailAddress=email)
            print(f"[SES] Đã kích hoạt gửi link xác thực email tới: {email}")
        except Exception as ses_err:
            print(f"[SES WARNING] Lỗi khi tự động gửi verify email tới {email}: {ses_err}")
            
        return TokenResponse(
            access_token=auth_result.get('AccessToken', ''),
            id_token=auth_result.get('IdToken', ''),
            refresh_token=auth_result.get('RefreshToken'),
            expires_in=auth_result.get('ExpiresIn', 3600),
            user=user_profile
        )
    except cognito_client.exceptions.InvalidPasswordException as e:
        raise AppException(ErrorCode.VALIDATION_ERROR, message="Mật khẩu không đủ mạnh. Vui lòng thử lại.")
    except Exception as e:
        raise AppException(ErrorCode.INTERNAL_ERROR, message=f"Lỗi xử lý xác thực: {str(e)}")


def _verify_face_logic(email: str, image_base64: str) -> dict:
    user_item = user_repo.get_user_by_email(email.lower())
    if not user_item:
        raise AppException(ErrorCode.USER_NOT_FOUND, message="Tài khoản không tồn tại.")
    if not user_item.get("face_registered"):
        raise AppException(ErrorCode.VALIDATION_ERROR, message="Tài khoản chưa đăng ký khuôn mặt. Vui lòng liên hệ Admin.")
    
    image_bytes = _decode_image(image_base64)
    try:
        reko_result = reko.search_faces_by_image(image_bytes)
        if reko_result.get("userId") != user_item["user_id"]:
            raise AppException(ErrorCode.UNAUTHORIZED, message="Khuôn mặt không khớp với chủ tài khoản.")
    except reko.NoFaceDetectedError:
        raise AppException(ErrorCode.VALIDATION_ERROR, message="Không tìm thấy khuôn mặt trong ảnh.")
    except reko.FaceNotFoundError:
        raise AppException(ErrorCode.UNAUTHORIZED, message="Khuôn mặt không khớp với chủ tài khoản.")
    except AppException:
        raise
    except Exception as e:
        raise AppException(ErrorCode.INTERNAL_ERROR, message=f"Lỗi xác thực khuôn mặt: {str(e)}")
        
    return user_item

def verify_face_for_reset(payload: VerifyFaceRequest) -> dict:
    _verify_face_logic(payload.email, payload.image_base64)
    return {"message": "Xác thực khuôn mặt thành công."}

def reset_password_by_face(payload: ResetPasswordFaceRequest) -> dict:
    user_item = _verify_face_logic(payload.email, payload.image_base64)
    
    cognito_client = get_cognito_client()
    if not cognito_client:
        return {"message": "Demo Mode: Thành công (Offline)."}
        
    try:
        cognito_client.admin_set_user_password(
            UserPoolId=settings.cognito_user_pool_id,
            Username=payload.email.lower(),
            Password=payload.new_password,
            Permanent=True
        )
    except cognito_client.exceptions.UserNotFoundException:
        try:
            # Sync user to Cognito if they only exist in local DB
            cognito_client.admin_create_user(
                UserPoolId=settings.cognito_user_pool_id,
                Username=payload.email.lower(),
                TemporaryPassword=payload.new_password,
                MessageAction='SUPPRESS'
            )
            cognito_client.admin_set_user_password(
                UserPoolId=settings.cognito_user_pool_id,
                Username=payload.email.lower(),
                Password=payload.new_password,
                Permanent=True
            )
        except Exception as sync_err:
            raise AppException(ErrorCode.INTERNAL_ERROR, message=f"Lỗi đồng bộ tài khoản lên Cognito: {str(sync_err)}")
    except Exception as e:
        raise AppException(ErrorCode.INTERNAL_ERROR, message=f"Lỗi Cognito: {str(e)}")
        
    return {"message": "Cập nhật mật khẩu thành công."}
