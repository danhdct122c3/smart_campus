"""Pydantic schemas for the AI Assistant module (Workflow 6)."""

from typing import Optional
from pydantic import BaseModel, Field


# ── Request models ─────────────────────────────────────────────────────────────

class AIQueryRequest(BaseModel):
    """Natural language question to the AI Assistant."""
    question: str = Field(
        ...,
        min_length=5,
        max_length=500,
        description="Câu hỏi bằng ngôn ngữ tự nhiên (tiếng Việt hoặc tiếng Anh).",
        examples=["Hôm nay có bao nhiêu sinh viên vắng mặt?"],
    )
    date_context: Optional[str] = Field(
        None,
        description="Ngày tham chiếu (YYYY-MM-DD). Mặc định là hôm nay.",
    )


# ── Response models ────────────────────────────────────────────────────────────

class AIQueryResponse(BaseModel):
    """Structured response from the AI Assistant."""
    answer: str                             # Human-readable answer in Vietnamese
    sql_query: Optional[str] = None         # Generated SQL (for transparency)
    raw_data: Optional[list[dict]] = None   # Raw query results
    record_count: int = 0
    confidence: float = 1.0                 # 0.0 - 1.0
    fallback_used: bool = False             # True nếu Athena unavailable và dùng DynamoDB
