"""FastAPI router for the Faces module (Workflow 2 – Face Registration)."""

from fastapi import APIRouter

from app.core.responses import APIResponse
from .schemas import FaceRegisterRequest, FaceResponse, FaceListResponse
from . import service

router = APIRouter(prefix="/faces", tags=["Faces"])


@router.post(
    "/register",
    response_model=APIResponse[FaceResponse],
    status_code=201,
    summary="Đăng ký khuôn mặt người dùng (Workflow 2)",
    description="""
    Đăng ký khuôn mặt của người dùng vào hệ thống nhận diện.

    **Flow**:
    1. Validate ảnh (format, kích thước).
    2. Upload ảnh gốc lên S3.
    3. Gửi ảnh đến Amazon Rekognition để thực hiện IndexFaces.
    4. Lưu Face Metadata vào DynamoDB.
    5. Publish event `FaceRegistered` lên EventBridge.
    """,
)
def register_face(payload: FaceRegisterRequest):
    data = service.register_face(payload)
    return APIResponse.created(data, message="Đăng ký khuôn mặt thành công.")


@router.get(
    "/{user_id}",
    response_model=APIResponse[FaceListResponse],
    summary="Danh sách khuôn mặt đã đăng ký của người dùng",
)
def list_faces(user_id: str):
    items = service.list_faces(user_id)
    data = FaceListResponse(items=items, total=len(items))
    return APIResponse.ok(data)
