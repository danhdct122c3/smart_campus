from fastapi import APIRouter

from app.modules.health.router import router as health_router
from app.modules.users.router import router as users_router
from app.modules.faces.router import router as faces_router
from app.modules.attendance.router import router as attendance_router
from app.modules.reports.router import router as reports_router
from app.modules.notifications.router import router as notifications_router
from app.modules.security.router import router as security_router
from app.modules.ai_assistant.router import router as ai_router
from app.modules.tasks.router import router as tasks_router

api_router = APIRouter()

api_router.include_router(health_router, tags=["Health"])
api_router.include_router(users_router)
api_router.include_router(faces_router)
api_router.include_router(attendance_router)
api_router.include_router(reports_router)
api_router.include_router(notifications_router)
api_router.include_router(security_router)
api_router.include_router(ai_router)
api_router.include_router(tasks_router)