"""Business logic for the AI Assistant module (Workflow 6).

Flow:
    1. Admin nhập câu hỏi tự nhiên trên Dashboard.
    2. AI Service gửi câu hỏi đến Amazon Bedrock (Claude).
    3. Claude phân tích ý định (intent) và sinh câu SQL tương ứng.
    4. AI Service thực thi SQL trên Amazon Athena.
    5. Kết quả được tổng hợp và diễn giải thành câu trả lời dễ hiểu.
    6. Dashboard hiển thị kết quả + các số liệu liên quan.

Fallback: Nếu Athena chưa được cấu hình, query DynamoDB trực tiếp.

Example queries:
    - "Hôm nay có bao nhiêu sinh viên nghỉ học?"
    - "Khoa nào có tỷ lệ chuyên cần thấp nhất?"
    - "Có bao nhiêu lượt check-in sau 8 giờ sáng trong tuần này?"
"""

import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import status

from app.core.config import settings
from app.core.exceptions import AppException, ErrorCode
from app.shared.aws import bedrock, athena
from app.shared.aws.bedrock import BedrockError
from app.shared.aws.athena import AthenaQueryError
from .schemas import AIQueryRequest, AIQueryResponse


# ── Athena schema context for Claude ──────────────────────────────────────────

_SCHEMA_CONTEXT = """
Bạn là SQL expert cho hệ thống Smart Campus. Hãy tạo câu SQL query cho Amazon Athena.

DATABASE SCHEMA:
Table: attendance_records
  - attendance_id VARCHAR   -- UUID
  - user_id VARCHAR         -- UUID của sinh viên/nhân viên
  - face_id VARCHAR         -- Rekognition Face ID
  - camera_id VARCHAR       -- ID camera
  - room_id VARCHAR         -- Phòng học
  - session_type VARCHAR    -- MORNING | AFTERNOON | EVENING
  - status VARCHAR          -- PRESENT | LATE | ABSENT
  - confidence DOUBLE       -- Độ chính xác nhận diện (0-100)
  - timestamp VARCHAR       -- ISO-8601 datetime
  - date VARCHAR            -- YYYY-MM-DD (partition key)

Table: users
  - user_id VARCHAR         -- UUID
  - email VARCHAR
  - name VARCHAR
  - role VARCHAR            -- ADMIN | STUDENT | STAFF
  - department VARCHAR      -- Khoa/Bộ phận
  - status VARCHAR          -- ACTIVE | INACTIVE | SUSPENDED
  - face_registered BOOLEAN

RULES:
- Chỉ được dùng SELECT, không dùng INSERT/UPDATE/DELETE.
- Luôn thêm LIMIT 1000 vào các query lấy nhiều dòng.
- Dùng date = 'YYYY-MM-DD' để lọc theo ngày.
- Trả về CHỈ câu SQL, không giải thích, không markdown, không thêm gì khác.
"""


# ── Service functions ──────────────────────────────────────────────────────────

def ask(payload: AIQueryRequest) -> AIQueryResponse:
    """Full WF6 flow: natural language → SQL → Athena → human answer."""

    date_ctx = payload.date_context or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    question_with_ctx = f"{payload.question}\n\n[Context: Today is {date_ctx}]"

    # Step 1: Generate SQL via Bedrock (Claude)
    sql_query: str | None = None
    try:
        raw_sql = bedrock.invoke_claude(
            prompt=question_with_ctx,
            system_prompt=_SCHEMA_CONTEXT,
            max_tokens=512,
            temperature=0.0,
        )
        sql_query = _clean_sql(raw_sql)
    except BedrockError as exc:
        raise AppException(
            error_code=ErrorCode.INTERNAL_ERROR,
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            message=f"AI Service không khả dụng: {exc}",
        )

    # Step 2: Execute SQL on Athena (with fallback)
    raw_data: list[dict] = []
    fallback_used = False

    if settings.athena_output_location:
        try:
            raw_data = athena.run_query_sync(sql_query, timeout_seconds=30)
        except AthenaQueryError:
            # Athena failed — use DynamoDB fallback
            fallback_used = True
            raw_data = _dynamodb_fallback(payload.question, date_ctx)
    else:
        # Athena not configured yet (Phase 1) — use DynamoDB fallback
        fallback_used = True
        raw_data = _dynamodb_fallback(payload.question, date_ctx)

    # Step 3: Summarize results via Bedrock
    answer = _summarize_results(payload.question, raw_data, fallback_used)

    return AIQueryResponse(
        answer=answer,
        sql_query=sql_query if not fallback_used else None,
        raw_data=raw_data[:20],  # Return up to 20 rows for transparency
        record_count=len(raw_data),
        confidence=0.95 if not fallback_used else 0.75,
        fallback_used=fallback_used,
    )


def _clean_sql(raw: str) -> str:
    """Strip markdown code blocks and extra whitespace from Claude's output."""
    sql = re.sub(r"```(?:sql)?", "", raw, flags=re.IGNORECASE).strip()
    sql = re.sub(r"```", "", sql).strip()
    # Safety: block non-SELECT statements
    if not sql.upper().lstrip().startswith("SELECT"):
        raise AppException(
            error_code=ErrorCode.INTERNAL_ERROR,
            status_code=status.HTTP_400_BAD_REQUEST,
            message="AI chỉ được phép tạo câu SELECT.",
        )
    return sql


def _summarize_results(question: str, raw_data: list[dict], fallback_used: bool) -> str:
    """Ask Claude to summarize query results in Vietnamese."""
    if not raw_data:
        return "Không tìm thấy dữ liệu phù hợp với câu hỏi của bạn."

    summary_prompt = f"""
Câu hỏi: {question}

Dữ liệu trả về ({len(raw_data)} dòng):
{raw_data[:10]}

Hãy trả lời câu hỏi bằng tiếng Việt, ngắn gọn, dễ hiểu, dựa trên dữ liệu trên.
{"(Lưu ý: Dữ liệu được lấy từ nguồn dự phòng, có thể không đầy đủ.)" if fallback_used else ""}
"""
    try:
        return bedrock.invoke_claude(
            prompt=summary_prompt,
            max_tokens=300,
            temperature=0.3,
        )
    except BedrockError:
        # Fallback: simple format
        return f"Tìm thấy {len(raw_data)} bản ghi phù hợp. Dữ liệu đầu tiên: {raw_data[0] if raw_data else '{}'}"


def _dynamodb_fallback(question: str, date_ctx: str) -> list[dict]:
    """
    Phase 1 fallback: query DynamoDB directly when Athena is unavailable.
    Supports simple keyword-based routing.
    """
    from app.modules.attendance import repository as att_repo
    from app.modules.attendance.rule_engine import SESSIONS

    question_lower = question.lower()
    results: list[dict] = []

    # Route to appropriate query based on keywords
    if any(kw in question_lower for kw in ["hôm nay", "today", "ngày này", date_ctx]):
        for session in SESSIONS:
            records = att_repo.list_by_date_session(date_ctx, session.name)
            results.extend(records)
    elif any(kw in question_lower for kw in ["tuần", "week"]):
        from datetime import timedelta
        base = datetime.fromisoformat(date_ctx)
        for i in range(7):
            d = (base - timedelta(days=i)).strftime("%Y-%m-%d")
            for session in SESSIONS:
                results.extend(att_repo.list_by_date_session(d, session.name))

    return results
