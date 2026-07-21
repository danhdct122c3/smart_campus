from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

class TaskType(str, Enum):
    STANDARD = "STANDARD"
    INCIDENT = "INCIDENT"

class Department(str, Enum):
    IT = "IT"
    MAINTENANCE = "MAINTENANCE"
    SECURITY = "SECURITY"
    HR = "HR"
    ADMIN = "ADMIN"

class TaskCategory(str, Enum):
    ELECTRIC = "ELECTRIC"
    WATER = "WATER"
    HVAC = "HVAC"
    FURNITURE = "FURNITURE"
    NETWORK = "NETWORK"
    OTHER = "OTHER"

class TaskStatus(str, Enum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    IN_REVIEW = "IN_REVIEW"
    COMPLETED = "COMPLETED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"

class TaskPriority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"

class TaskCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = None
    reporter_id: str
    assignee_id: Optional[str] = None
    parent_task_id: Optional[str] = None
    priority: TaskPriority = TaskPriority.MEDIUM
    due_date: Optional[str] = None
    file_url: Optional[str] = None
    submission_file_url: Optional[str] = None
    
    # New fields for Incident & RBAC routing
    task_type: TaskType = TaskType.STANDARD
    department: Optional[Department] = None
    category: Optional[TaskCategory] = None
    location: Optional[str] = None
    submission_note: Optional[str] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assignee_id: Optional[str] = None
    priority: Optional[TaskPriority] = None
    status: Optional[TaskStatus] = None
    due_date: Optional[str] = None
    file_url: Optional[str] = None
    submission_file_url: Optional[str] = None
    
    # New fields
    department: Optional[Department] = None
    category: Optional[TaskCategory] = None
    location: Optional[str] = None
    submission_note: Optional[str] = None

class TaskStatusUpdate(BaseModel):
    status: TaskStatus

class TaskResponse(BaseModel):
    task_id: str
    title: str
    description: Optional[str] = None
    reporter_id: str
    assignee_id: Optional[str] = None
    parent_task_id: Optional[str] = None
    status: TaskStatus
    priority: TaskPriority
    due_date: Optional[str] = None
    file_url: Optional[str] = None
    submission_file_url: Optional[str] = None
    
    task_type: TaskType
    department: Optional[Department] = None
    category: Optional[TaskCategory] = None
    location: Optional[str] = None
    submission_note: Optional[str] = None
    
    created_at: str
    updated_at: Optional[str] = None

class TaskListResponse(BaseModel):
    items: list[TaskResponse]
    total: int
