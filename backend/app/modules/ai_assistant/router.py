"""FastAPI router for the AI Assistant module (Workflow 6)."""

from fastapi import APIRouter

from app.core.responses import APIResponse
from .schemas import AIQueryRequest, AIQueryResponse
from . import service

router = APIRouter(prefix="/ai", tags=["AI Assistant"])


@router.post(
    "/ask",
    response_model=APIResponse[AIQueryResponse],
    summary="Truy vấn dữ liệu bằng ngôn ngữ tự nhiên (Workflow 6)",
    description="""
    Cho phép admin truy vấn dữ liệu hệ thống bằng tiếng Việt hoặc tiếng Anh
    mà không cần viết SQL.

    **Flow**:
    1. Câu hỏi được gửi đến Amazon Bedrock (Claude).
    2. Claude sinh câu SQL phù hợp với schema của hệ thống.
    3. SQL được thực thi trên Amazon Athena.
    4. Kết quả được diễn giải thành câu trả lời dễ hiểu.

    **Ví dụ câu hỏi**:
    - "Hôm nay có bao nhiêu sinh viên vắng mặt?"
    - "Khoa nào có tỷ lệ chuyên cần thấp nhất tuần này?"
    - "Có bao nhiêu lượt check-in sau 8 giờ sáng trong tuần này?"

    **Fallback**: Nếu Athena chưa cấu hình, hệ thống tự động query DynamoDB.
    """,
)
def ask_ai(payload: AIQueryRequest):
    data = service.ask(payload)
    return APIResponse.ok(data, message="Truy vấn AI thành công.")
