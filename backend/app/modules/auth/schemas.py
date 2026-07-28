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
    access_token: str
    id_token: str
    refresh_token: Optional[str] = None
    expires_in: int
    user: UserProfile
