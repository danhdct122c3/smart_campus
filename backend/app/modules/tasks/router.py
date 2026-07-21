"""FastAPI router for the Tasks module (Workflow 8)."""

from typing import Optional

from fastapi import APIRouter, Query, Path
from pydantic import BaseModel

from app.core.responses import APIResponse
from .schemas import (
    TaskCreate,
    TaskUpdate,
    TaskStatusUpdate,
    TaskResponse,
    TaskListResponse
)
from . import service

router = APIRouter(prefix="/tasks", tags=["Tasks"])

@router.post("", response_model=APIResponse[TaskResponse], summary="Create a new task")
def create_task(payload: TaskCreate):
    data = service.create_task(payload)
    return APIResponse.ok(data)

@router.get("", response_model=APIResponse[TaskListResponse], summary="List all tasks")
def list_tasks(
    user_id: Optional[str] = Query(None, description="Lọc theo người liên quan (Reporter hoặc Assignee)"),
    status: Optional[str] = Query(None, description="Lọc theo trạng thái"),
    task_type: Optional[str] = Query(None, description="Lọc theo loại (STANDARD/INCIDENT)"),
    department: Optional[str] = Query(None, description="Lọc theo phòng ban"),
):
    items = service.list_tasks(user_id=user_id, status=status, task_type=task_type, department=department)
    data = TaskListResponse(items=items, total=len(items))
    return APIResponse.ok(data)

@router.get("/{task_id}", response_model=APIResponse[TaskResponse], summary="Get task by ID")
def get_task(task_id: str = Path(...)):
    data = service.get_task(task_id)
    return APIResponse.ok(data)

@router.patch("/{task_id}", response_model=APIResponse[TaskResponse], summary="Update a task")
def update_task(payload: TaskUpdate, task_id: str = Path(...)):
    data = service.update_task(task_id, payload)
    return APIResponse.ok(data)

@router.patch("/{task_id}/status", response_model=APIResponse[TaskResponse], summary="Update task status")
def update_task_status(payload: TaskStatusUpdate, task_id: str = Path(...)):
    data = service.update_task_status(task_id, payload)
    return APIResponse.ok(data)

@router.delete("/{task_id}", response_model=APIResponse[dict], summary="Delete a task")
def delete_task(task_id: str = Path(...)):
    service.delete_task(task_id)
    return APIResponse.ok({"deleted": True})

class PresignedUrlRequest(BaseModel):
    file_name: str
    file_type: str

@router.post("/upload-url", response_model=APIResponse[dict], summary="Get S3 presigned URL for task attachment")
def get_upload_url(payload: PresignedUrlRequest):
    data = service.get_presigned_upload_url(payload.file_name, payload.file_type)
    return APIResponse.ok(data)
