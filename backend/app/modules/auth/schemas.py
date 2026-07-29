from typing import Optional
from pydantic import BaseModel, EmailStr

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserProfile(BaseModel):
    user_id: str
    email: str
    name: str
    role: str
    department: Optional[str] = None
    face_registered: bool = False

class TokenResponse(BaseModel):
    access_token: Optional[str] = None
    id_token: Optional[str] = None
    refresh_token: Optional[str] = None
    expires_in: Optional[int] = None
    user: Optional[UserProfile] = None
    challenge_name: Optional[str] = None
    session: Optional[str] = None

class NewPasswordChallengeRequest(BaseModel):
    email: EmailStr
    new_password: str
    session: str

class VerifyFaceRequest(BaseModel):
    email: EmailStr
    image_base64: str

class ResetPasswordFaceRequest(BaseModel):
    email: EmailStr
    new_password: str
    image_base64: str
