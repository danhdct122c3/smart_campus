from fastapi import APIRouter

from app.core.responses import APIResponse

router = APIRouter()


@router.get(
    "/health",
    response_model=APIResponse[dict],
    summary="Kiểm tra trạng thái hệ thống",
)
def health_check():
    data = {
        "status": "healthy",
        "service": "smart-campus-api",
    }
    return APIResponse.ok(data)