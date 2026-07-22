# WF8 – Quản lý Công việc & Nhân viên (Task & Employee Management)

**Phiên bản:** 1.0
**Ngày tạo:** 2026-07-16
**Trạng thái:** 📋 Đặc tả hoàn chỉnh – Sẵn sàng phát triển

---

## 1. Tổng quan nghiệp vụ

Module WF8 mở rộng Smart Campus từ mô hình **"Giám sát"** sang **"Vận hành tự động"** — kết nối hai nghiệp vụ cốt lõi:

| Nghiệp vụ | Mô tả | Quan hệ |
|:---|:---|:---|
| **Employee Management** | Mở rộng module `users` hiện tại: bổ sung thông tin hồ sơ nhân viên văn phòng (ngày vào làm, quản lý trực tiếp). Dùng **chức vụ (role)** có sẵn làm tiêu chí phân công task — không cần ca trực hay nhóm kỹ năng. | Nền tảng cho Task assignment |
| **Task Management** | Tạo – Giao – Theo dõi – Hoàn thành công việc theo thời gian thực. Thông báo cho nhân viên qua SNS khi có task mới. | Phụ thuộc Employee Management |

### Vị trí trong hệ thống

```
[ADMIN / MANAGER tạo task thủ công]
           │
           ▼
       WF8 Tasks
           │
           ├─ TaskAssigned ─────► WF4 (Notification → SNS → Điện thoại nhân viên)
           │
           └─ TaskOverdue ─────► WF4 (Cảnh báo trễ hạn)
```

---

## 2. Phần 1: Employee Management (Mở rộng)

### 2.1. Phân tích hiện trạng

Module `users` hiện tại (`smart-campus-users`) đang lưu thông tin cơ bản:

```
user_id | email | name | role | department | phone | employee_id | status | face_registered
```

**Đánh giá:** Schema hiện tại đã có `role` — đây là tiêu chí chính để phân công task (ADMIN/MANAGER tạo task, STAFF/SECURITY/MAINTENANCE nhận task). Chỉ cần bổ sung thêm 2 fields thông tin hồ sơ và lịch sử task suy ra từ bảng tasks mới.

### 2.2. Chiến lược mở rộng (Không phá vỡ dữ liệu hiện tại)

> **Nguyên tắc:** Không xóa hoặc đổi tên các field cũ. Chỉ **thêm** fields mới vào DynamoDB (schema-less). Backend đọc với giá trị mặc định nếu field chưa tồn tại.

#### Thêm các fields mới vào `smart-campus-users`:

> Chỉ thêm tối thiểu những gì cần thiết, không thay đổi fields cũ.

| Field | Type | Giá trị mặc định | Mô tả |
|:---|:---|:---|:---|
| `manager_id` | String | `null` | UUID của quản lý trực tiếp (dùng khi cần báo cáo cấp trên) |
| `hire_date` | String | `null` | Ngày bắt đầu làm việc (ISO 8601 Date: `YYYY-MM-DD`) |

#### Các Role nhân viên hiện tại (giữ nguyên):

| Role | Mô tả | Loại task phù hợp |
|:---|:---|:---|
| `ADMIN` | Quản trị hệ thống | Tạo task, xem báo cáo |
| `MANAGER` | Trưởng phòng/ban | Tạo & phân công task |
| `STAFF` | Nhân viên văn phòng | `GENERAL` tasks |
| `SECURITY` | Nhân viên bảo vệ | `SECURITY_CHECK` tasks |
| `MAINTENANCE` | Nhân viên kỹ thuật | `MAINTENANCE` tasks |
| `STUDENT` | Sinh viên | Không nhận task |

### 2.3. API Endpoints bổ sung (Employee)

Thư mục: `app/modules/users/` — **mở rộng router hiện tại**

| Phương thức | Endpoint | Chức năng | Auth |
|:---|:---|:---|:---|
| `GET` | `/users/{user_id}/tasks` | Lịch sử công việc của nhân viên (query sang bảng tasks) | Chính mình, MANAGER, ADMIN |
| `GET` | `/users/{user_id}/stats` | Thống kê KPI: tổng task, hoàn thành, trễ hạn trong tháng | ADMIN, MANAGER |

#### Response `GET /users/{user_id}/tasks`:
```json
{
  "items": [
    {
      "task_id": "uuid-task-1",
      "title": "Cập nhật báo cáo Q3",
      "task_type": "GENERAL",
      "status": "DONE",
      "priority": "MEDIUM",
      "due_date": "2026-07-15",
      "completed_at": "2026-07-14T10:30:00Z"
    }
  ],
  "total": 12
}
```

#### Response `GET /users/{user_id}/stats`:
```json
{
  "total_tasks": 12,
  "done": 9,
  "in_progress": 2,
  "overdue": 1,
  "completion_rate": 75.0
}
```

---

## 3. Phần 2: Task Management (WF8 Core)

### 3.1. Phân loại Task

| Task Type | Mô tả | Người nhận phù hợp | Trigger |
|:---|:---|:---|:---|
| `MAINTENANCE` | Bảo trì thiết bị (máy lạnh, điện, mạng...) | `MAINTENANCE` role | Manual |
| `GENERAL` | Công việc hành chính, vận hành thông thường | `STAFF`, `MANAGER` | Manual |
| `INSPECTION` | Kiểm tra định kỳ (kiểm kê thiết bị, rà soát quy trình) | Mọi role (trừ `STUDENT`) | Manual |

### 3.2. Vòng đời Task (Task Lifecycle)

```
[Tạo task] --> TODO --> IN_PROGRESS --> DONE
                |                        |
                |                   [Publish TaskCompleted] → WF4 cảm ơn
                |
                +--> CANCELLED
```

#### Bảng trạng thái:

| Status | Mô tả | Người thực hiện |
|:---|:---|:---|
| `TODO` | Mới tạo, chờ nhận việc | Hệ thống tự động |
| `IN_PROGRESS` | Nhân viên đã nhận, đang xử lý | Assignee |
| `DONE` | Hoàn thành, có thể kèm ghi chú | Assignee |
| `CANCELLED` | Hủy bỏ (vd: incident đã được xử lý bởi bên khác) | ADMIN / MANAGER |
| `OVERDUE` | *(Virtual)* Tính toán khi `dueDate < now` và status vẫn là `TODO`/`IN_PROGRESS` | Hệ thống tính toán |

> **Lưu ý:** `OVERDUE` không lưu vào DB mà được tính toán động khi query.

### 3.3. Cấu trúc Database Schema (DynamoDB)

**Table:** `smart-campus-tasks`

| Attribute | Type | Required | Chú thích |
|:---|:---|:---:|:---|
| `task_id` | String (PK) | ✅ | UUID v4 |
| `task_type` | String | ✅ | `MAINTENANCE`, `GENERAL`, `INSPECTION` |
| `status` | String | ✅ | `TODO`, `IN_PROGRESS`, `DONE`, `CANCELLED` |
| `priority` | String | ✅ | `LOW`, `MEDIUM`, `HIGH`, `URGENT` |
| `title` | String | ✅ | Tiêu đề công việc (max 200 ký tự) |
| `description` | String | ✅ | Mô tả chi tiết (max 2000 ký tự) |
| `assignee_id` | String | ✅ | UUID của nhân viên được giao |
| `creator_id` | String | ✅ | UUID của người tạo task (ADMIN/MANAGER) |
| `attachment_s3_keys` | List[String] | ❌ | Danh sách các S3 key của file đính kèm (hình ảnh, PDF, báo cáo...). Upload qua endpoint riêng. |
| `created_at` | String | ✅ | ISO 8601 Timestamp |
| `due_date` | String | ❌ | Hạn hoàn thành (ISO 8601 Date: `YYYY-MM-DD`) |
| `started_at` | String | ❌ | Thời điểm nhân viên nhận task |
| `completed_at` | String | ❌ | Thời điểm hoàn thành |
| `completion_note` | String | ❌ | Ghi chú khi hoàn thành (nhân viên điền) |
| `updated_at` | String | ❌ | Lần cập nhật cuối |


#### GSI (Global Secondary Index):

| Index Name | Partition Key | Sort Key | Mục đích |
|:---|:---|:---|:---|
| `assigneeId-status-index` | `assignee_id` | `status` | Lấy tất cả task của 1 nhân viên theo trạng thái |
| `status-createdAt-index` | `status` | `created_at` | Lấy tất cả task OPEN/TODO sắp xếp theo thời gian |
| `taskType-status-index` | `task_type` | `status` | Lọc task theo loại và trạng thái (báo cáo) |

### 3.4. API Endpoints

Thư mục mới: `app/modules/tasks/`

| Phương thức | Endpoint | Chức năng | Auth |
|:---|:---|:---|:---|
| `POST` | `/tasks` | Tạo task mới (thủ công) | ADMIN, MANAGER |
| `GET` | `/tasks` | Danh sách task (có filter) | ADMIN, MANAGER |
| `GET` | `/tasks/my` | Task được giao cho tôi | Tất cả nhân viên |
| `GET` | `/tasks/{task_id}` | Chi tiết 1 task | ADMIN, MANAGER, Assignee |
| `PATCH` | `/tasks/{task_id}/status` | Cập nhật trạng thái task | Assignee, ADMIN |
| `PATCH` | `/tasks/{task_id}/assign` | Giao lại task cho người khác | ADMIN, MANAGER |
| `POST` | `/tasks/{task_id}/attachments` | Upload file đính kèm lên S3 | ADMIN, MANAGER, Assignee |
| `DELETE` | `/tasks/{task_id}` | Hủy task (soft delete → CANCELLED) | ADMIN |

#### Query Parameters `GET /tasks`:
```
?assignee_id=uuid-123        # Filter theo người thực hiện
?status=TODO                 # Filter theo trạng thái
?task_type=MAINTENANCE       # Filter theo loại
?priority=URGENT             # Filter theo độ ưu tiên
?overdue=true                # Chỉ lấy task quá hạn
?limit=50                    # Số bản ghi tối đa
```

#### Request body `POST /tasks`:
```json
{
  "task_type": "MAINTENANCE",
  "priority": "HIGH",
  "title": "Kiểm tra hệ thống điện khu A",
  "description": "Thiết bị điện tầng 2 bị chovào lúc 14h, cần kiểm tra ngược trạch nhiệm.",
  "assignee_id": "uuid-456",
  "due_date": "2026-07-17"
}
```

#### Request body `POST /tasks/{task_id}/attachments`:
```json
{
  "file_name": "bao_cao_kiem_tra.pdf",
  "file_base64": "JVBERi0xLjQg...",
  "content_type": "application/pdf"
}
```
*Backend sẽ upload lên S3 vào path `tasks/{task_id}/{file_name}`, lưu S3 key vào `attachment_s3_keys` của task.*

#### Request body `PATCH /tasks/{task_id}/status`:
```json
{
  "status": "DONE",
  "completion_note": "Đã kiểm tra và thay thế dây cáp HDMI. Camera hoạt động bình thường."
}
```

### 3.5. Luồng nghiệp vụ chi tiết

#### Luồng 1: Tạo Task thủ công (Manual-flow)

```
[ADMIN/MANAGER vào trang Tasks trên Frontend]
    │   Điền form: tiêu đề, mô tả, loại, độ ưu tiên, assignee, hạn chót
    ▼
[POST /api/tasks]
    │   Backend validate: assignee tồn tại, role phù hợp với task_type
    ▼
[Lưu DynamoDB, Publish TaskAssigned → EventBridge]
    ▼
[WF4 Notification gửi SNS cho assignee]
    ▼
[Nhân viên mở app, xác nhận và bắt đầu làm việc]
    ▼
[Cập nhật trạng thái TODO → IN_PROGRESS → DONE]
```

#### Luồng 2: Kiểm tra Task quá hạn (OVERDUE Detection)

```
[Scheduled EventBridge Rule: mỗi 30 phút]
    ▼
[Lambda: tasks_overdue_checker.py]
    │   Scan task WHERE status IN [TODO, IN_PROGRESS] AND due_date < today
    │   Publish TaskOverdue event cho mỗi task
    ▼
[WF4 Notification]
    │   Gửi cảnh báo cho assignee và manager
    │   "Task '[title]' đã quá hạn [N] ngày"
```

### 3.6. Events EventBridge

| Tên Event | Source | Detail | Mục đích |
|:---|:---|:---|:---|
| `TaskAssigned` | `smart-campus.tasks` | `task_id`, `assignee_id`, `task_type`, `priority`, `title` | Kích hoạt WF4 gửi thông báo cho nhân viên được giao |
| `TaskOverdue` | `smart-campus.tasks` | `task_id`, `assignee_id`, `due_date`, `days_overdue` | Kích hoạt WF4 cảnh báo trễ hạn |
| `TaskReassigned` | `smart-campus.tasks` | `task_id`, `old_assignee_id`, `new_assignee_id` | Kích hoạt WF4 thông báo đổi người |

---

## 4. Phần 3: Business Rules & Validation

### 4.1. Quy tắc gán Task (Assignment Rules)

| Rule | Mô tả |
|:---|:---|
| **R1 - Role matching** | `MAINTENANCE` → chỉ gán cho `MAINTENANCE` role. `GENERAL` → gán cho `STAFF`, `MANAGER`, `ADMIN`. `INSPECTION` → gán cho mọi role (trừ `STUDENT`). |
| **R2 - Active user** | Chỉ gán task cho nhân viên có `status = ACTIVE`. |
| **R3 - Load limit** | Không gán quá 5 task `TODO`/`IN_PROGRESS` cho 1 nhân viên cùng lúc (cảnh báo, không block). |
| **R4 - Self-update** | Nhân viên chỉ được tự cập nhật status task của chính mình. |

### 4.2. Quy tắc chuyển trạng thái (State Machine Rules)

```
Chuyển trạng thái hợp lệ:
  TODO       --> IN_PROGRESS  (Assignee, ADMIN)
  TODO       --> CANCELLED    (ADMIN, MANAGER)
  IN_PROGRESS --> DONE        (Assignee) — bắt buộc có completion_note >= 10 ký tự
  IN_PROGRESS --> CANCELLED   (ADMIN, MANAGER)
  DONE       --> (không thay đổi được)
  CANCELLED  --> (không thay đổi được)

Chuyển trạng thái KHÔNG hợp lệ:
  DONE --> bất kỳ
  CANCELLED --> bất kỳ
  IN_PROGRESS --> TODO (không cho đi lùi)
```

### 4.3. Priority & SLA

| Priority | SLA (thời gian xử lý tối đa) | Màu |
|:---|:---|:---|
| `LOW` | 5 ngày làm việc | Xanh dương |
| `MEDIUM` | 2 ngày làm việc | Vàng |
| `HIGH` | 4 giờ | Cam |
| `URGENT` | 30 phút | Đỏ |

---

## 5. Cấu trúc Code (Backend)

```
app/modules/tasks/
├── __init__.py
├── router.py         # FastAPI endpoints
├── schemas.py        # Pydantic models: TaskCreate, TaskUpdate, TaskResponse...
├── service.py        # Business logic: create, assign, update_status...
├── repository.py     # DynamoDB CRUD
└── event_handler.py  # Xử lý events từ EventBridge (SecurityIncidentCreated)
```

### Schemas chính (Pydantic):

```python
class TaskType(str, Enum):
    MAINTENANCE = "MAINTENANCE"
    GENERAL     = "GENERAL"
    INSPECTION  = "INSPECTION"

class TaskStatus(str, Enum):
    TODO        = "TODO"
    IN_PROGRESS = "IN_PROGRESS"
    DONE        = "DONE"
    CANCELLED   = "CANCELLED"

class TaskPriority(str, Enum):
    LOW    = "LOW"
    MEDIUM = "MEDIUM"
    HIGH   = "HIGH"
    URGENT = "URGENT"

class TaskCreate(BaseModel):
    task_type:   TaskType
    priority:    TaskPriority
    title:       str  # max 200
    description: str  # max 2000
    assignee_id: str
    due_date:    Optional[str] = None  # YYYY-MM-DD

class TaskAttachmentUpload(BaseModel):
    file_name:    str           # Tên file gốc (ví dụ: bao_cao.pdf)
    file_base64:  str           # Nội dung file dưới dạng base64
    content_type: str           # MIME type: "application/pdf", "image/jpeg"...

class TaskStatusUpdate(BaseModel):
    status:          TaskStatus
    completion_note: Optional[str] = None  # Bắt buộc khi status=DONE (>=10 ký tự)

class TaskAssignUpdate(BaseModel):
    assignee_id: str
    reason:      Optional[str] = None  # Lý do giao lại

class TaskResponse(BaseModel):
    task_id:              str
    task_type:            TaskType
    status:               TaskStatus
    priority:             TaskPriority
    title:                str
    description:          str
    assignee_id:          str
    assignee_name:        Optional[str] = None   # Join từ users table
    creator_id:           str
    attachment_s3_keys:   list[str] = []          # Các S3 key của file đính kèm
    attachment_urls:      list[str] = []          # Presigned URL để download (tính toán động, không lưu DB)
    created_at:           str
    due_date:             Optional[str] = None
    started_at:           Optional[str] = None
    completed_at:         Optional[str] = None
    completion_note:      Optional[str] = None
    is_overdue:           bool = False  # Computed field
```

---

## 6. Cấu trúc Giao diện Frontend

### Pages mới:

| Page | Đường dẫn | Dành cho |
|:---|:---|:---|
| `Tasks.jsx` | `/tasks` | ADMIN, MANAGER — quản lý toàn bộ task |
| `MyTasks.jsx` | `/my-tasks` | Nhân viên — xem và xử lý task của mình |

### Components trong `Tasks.jsx`:

1. **KPI Summary Bar** — Tổng task, đang xử lý, hoàn thành hôm nay, quá hạn
2. **Filter Panel** — Lọc theo: status, task_type, priority, assignee, ngày
3. **Task Board (Kanban View)** — 4 cột: TODO | IN_PROGRESS | DONE | OVERDUE
   - Mỗi card hiển thị: tiêu đề, tên assignee, priority badge, due_date, task_type icon
4. **Task List (Table View)** — Chuyển đổi qua lại với Kanban
5. **Create Task Modal** — Form tạo task với dropdown chọn assignee (lọc theo role phù hợp với task_type)
6. **Task Detail Drawer** — Slide-in panel xem chi tiết, cập nhật trạng thái, ghi chú

### Components trong `MyTasks.jsx` (Mobile-first):

1. **My Task Cards** — Hiển thị các task được giao, sắp xếp: URGENT → HIGH → MEDIUM → LOW
2. **Quick Status Update** — Nút "Bắt đầu" / "Hoàn thành" ngay trên card
3. **Completion Note Input** — Textarea hiện ra khi nhấn "Hoàn thành"

### Bổ sung trong `Users.jsx`:

1. **Employee KPI Badge** — Hiển thị số task hoàn thành / tổng task trong tháng ngay trên card nhân viên
2. **Role Badge** — Badge màu hiển thị chức vụ rõ ràng (ADMIN / MANAGER / STAFF / SECURITY / MAINTENANCE)
3. **Task History Link** — Nút xem lịch sử công việc của từng nhân viên

---

## 7. Kế hoạch phát triển (Implementation Plan)

### Phase 1: Backend Core (Ưu tiên cao nhất)

- [ ] Tạo DynamoDB table `smart-campus-tasks` với đủ GSI trên AWS Console
- [ ] Tạo `app/modules/tasks/schemas.py`
- [ ] Tạo `app/modules/tasks/repository.py`
- [ ] Tạo `app/modules/tasks/service.py` (CRUD + Business Rules + State Machine)
- [ ] Tạo `app/modules/tasks/router.py` và đăng ký vào `app/main.py`
- [ ] Mở rộng `app/modules/users/router.py` thêm endpoint `/{user_id}/tasks` và `/{user_id}/stats`
- [ ] Mở rộng `app/modules/users/schemas.py` thêm `UserUpdate` field `manager_id`, `hire_date`

### Phase 2: Frontend Core (Ưu tiên cao)

- [ ] Tạo `frontend/src/pages/Tasks.jsx` (Kanban + Table view, KPI cards)
- [ ] Tạo `frontend/src/pages/MyTasks.jsx`
- [ ] Cập nhật `App.jsx` thêm route `/tasks` và `/my-tasks`
- [ ] Cập nhật `Sidebar` thêm menu items (Tasks, My Tasks)
- [ ] Bổ sung Employee KPI badge và task history link vào `Users.jsx`

### Phase 3: Event-Driven Integration (Ưu tiên trung)

- [ ] Publish `TaskAssigned`, `TaskOverdue`, `TaskReassigned` lên EventBridge
- [ ] Mở rộng WF4 Notifications nhận events mới của WF8 (`TaskAssigned`, `TaskOverdue`)

### Phase 4: Advanced Features (Ưu tiên thấp)

- [ ] `tasks_overdue_checker.py` Lambda (scheduled EventBridge Rule mỗi 30 phút)
- [ ] Thống kê KPI nhân viên `GET /users/{id}/stats`
- [ ] Filter task quá hạn `?overdue=true`
- [ ] Export báo cáo task ra CSV

---

## 8. Tổng kết Tích hợp hệ thống

| Module | Tương tác với WF8 |
|:---|:---|
| WF1 (Auth) | JWT xác định creator_id, role validation |
| WF4 (Notify) | Nhận `TaskAssigned`, `TaskOverdue`, `TaskReassigned` để gửi thông báo SNS cho nhân viên |
| Users Module | Cung cấp assignee info và **role (chức vụ)** làm tiêu chí phân công task |

> **WF7 (Security) và WF6 (AI Assistant):** Tạm thời bỏ qua do phụ thuộc vào thiết bị ngoại vi và Bedrock quota. Sẽ tích hợp sau khi có hạ tầng.

**Kết luận:** WF8 là module "orchestrator" kết nối toàn bộ hệ thống, biến Smart Campus từ nền tảng giám sát thụ động thành hệ thống vận hành chủ động. Đây là module phức tạp nhất và có giá trị nghiệp vụ cao nhất của đồ án.
