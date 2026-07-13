from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.exceptions import AppException, ErrorCode
from app.core.responses import APIResponse


def create_app() -> FastAPI:
    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="Serverless API for Smart Campus Platform",
    )

    # CORS phải được add TRƯỚC khi include_router
    application.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(
        api_router,
        prefix="/api",
    )

    @application.get("/", tags=["Root"])
    def root() -> dict[str, str]:
        return {
            "message": "Welcome to Smart Campus API",
            "docs": "/docs",
        }

    # ── Exception Handlers (tương đương @ControllerAdvice) ────────────────────

    @application.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
        """Xử lý toàn bộ AppException – trả error_code chuẩn cho frontend."""
        return JSONResponse(
            status_code=exc.status_code,
            content=APIResponse.error(
                code=exc.error_code,
                message=exc.message,
            ).model_dump(),
        )

    @application.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        """Pydantic validation error → 422 với format chuẩn thay vì FastAPI default."""
        errors = exc.errors()
        if errors:
            first = errors[0]
            field = str(first["loc"][-1]) if first.get("loc") else "unknown"
            msg = f"Trường '{field}': {first['msg']}"
        else:
            msg = "Dữ liệu đầu vào không hợp lệ."
        return JSONResponse(
            status_code=422,
            content=APIResponse.error(
                code=ErrorCode.VALIDATION_ERROR,
                message=msg,
            ).model_dump(),
        )

    @application.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        """Catch-all – tránh lộ stack trace ra ngoài môi trường production."""
        return JSONResponse(
            status_code=500,
            content=APIResponse.error(
                code=ErrorCode.INTERNAL_ERROR,
                message="Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.",
            ).model_dump(),
        )

    return application


app = create_app()