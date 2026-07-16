# Báo cáo Tiến độ Phát triển Dự án (Development Log)
**Dự án:** Smart Campus Platform (Serverless & Event-Driven)
**Nền tảng AWS:** API Gateway, Lambda, DynamoDB, S3, Rekognition, EventBridge, SNS, Bedrock, Athena.

Tài liệu này tổng hợp toàn bộ các công việc, kiến trúc và tính năng đã được xây dựng từ lúc khởi tạo dự án cho đến thời điểm hiện tại. Nó đóng vai trò là nhật ký phát triển và là minh chứng phục vụ cho Đồ án.

---

## Giai đoạn 1: Thiết kế Kiến trúc và Khởi tạo Dự án
- **Cấu trúc Monorepo:** Khởi tạo hai thư mục tách biệt cho `backend` (FastAPI) và `frontend` (React + Vite).
- **Kiến trúc Event-Driven Serverless:** Chốt phương án thiết kế hệ thống phân tán, giao tiếp thông qua hệ thống Event Bus (Amazon EventBridge), giúp hệ thống dễ dàng mở rộng và ít bị nghẽn (bottleneck).
- **Tài liệu hóa hệ thống:** Đã biên soạn file tài liệu chi tiết `docs/System_Overview_and_Task_Management.md` định nghĩa kiến trúc toàn hệ thống, cấu trúc Database (5 bảng DynamoDB), và thiết kế rõ ràng **8 Luồng nghiệp vụ (Workflows)** cốt lõi.

## Giai đoạn 2: Xây dựng Backend (FastAPI Core & Modules)
- **Core Framework:** 
  - Khởi tạo FastAPI server.
  - Cấu hình Middleware, System Settings, và hệ thống Error Handler tập trung để trả về Error Code chuẩn cho Frontend.
- **Phát triển 7 Microservices / Modules:** 
  - `users`: Quản lý thông tin nhân viên, sinh viên (CRUD).
  - `faces`: Xử lý hình ảnh, kết nối với Amazon Rekognition (IndexFaces).
  - `attendance`: Điểm danh, chạy Rule Engine và gọi SearchFacesByImage.
  - `security`: Nhận diện người lạ, lưu vết cảnh báo an ninh.
  - `notifications`: Đẩy thông báo qua Amazon SNS.
  - `reports`: Lưu trữ dữ liệu log vào Data Lake (S3 + Athena).
  - `ai_assistant`: Tích hợp Amazon Bedrock (GenAI) cho tính năng chat/hỏi đáp nội bộ.
- **Database Repository (AWS Boto3):** Cấu hình thư viện `boto3` để tương tác trực tiếp với các dịch vụ AWS thay vì lưu Local.

## Giai đoạn 3: Xây dựng Giao diện Frontend (React + Glassmorphism UI)
- **Thiết lập giao diện siêu hiện đại:** Sử dụng CSS thuần với phong cách **Glassmorphism** (trong suốt như kính), Dark Mode, mang lại cảm giác xịn xò, cao cấp mang hơi hướng tương lai.
- **Các thành phần giao diện (Components & Layouts):**
  - Xây dựng `Sidebar`, `Topbar`, `Card`.
  - Sử dụng bộ icon `lucide-react` để giao diện trực quan.
- **Xây dựng các Màn hình (Pages):**
  - `Dashboard.jsx`: Tổng quan số liệu hệ thống.
  - `Users.jsx`: Trang quản lý người dùng và dữ liệu khuôn mặt.
  - `AIAssistant.jsx`: Giao diện chat với trợ lý ảo AI.

## Giai đoạn 4: Thiết lập Hạ tầng AWS (Infrastructure)
- **AWS CLI:** Cấu hình Access Key/Secret Key (`aws configure`) để kết nối từ Local lên tài khoản AWS thật.
- **Khởi tạo Amazon DynamoDB:** 
  - Tạo thủ công 5 bảng Database cốt lõi trên AWS Console để có ảnh minh chứng cho Đồ án.
  - Thiết lập chuẩn xác các Khóa chính (PK) và Khóa sắp xếp (SK), cùng các Global Secondary Index (GSI) để hỗ trợ truy vấn siêu tốc độ.
- **Khắc phục lỗi Dữ liệu (Migration):** Dọn dẹp Database, chuẩn hóa tên các trường dữ liệu từ dạng `camelCase` (như `createdAt`) sang chuẩn Backend `snake_case` (như `created_at`).

## Giai đoạn 5: Tích hợp Hệ thống (Đưa API lên Frontend)
- **Cấu trúc lại Database (Enterprise Ready):** 
  - Mở rộng hệ thống từ quy mô Trường học sang Doanh nghiệp bằng cách đổi trường `student_id` thành `employee_id`.
  - Mở rộng chức vụ (`UserRole`) với các vị trí: `MANAGER`, `SECURITY`, `MAINTENANCE`.
- **Cấu hình CORS (Cross-Origin):** Sửa code FastAPI Backend để trình duyệt mở khóa cho phép Frontend gọi API qua các port khác nhau (từ `5173` sang `8000`).
- **Lột xác trang Users.jsx (Frontend Integration):**
  - **Fetch Dữ liệu động:** Đổ dữ liệu thật từ bảng `smart-campus-users` DynamoDB lên giao diện Web thay vì dữ liệu mock giả.
  - **Thêm User (POST API):** Xây dựng Modal popup Form để điền thông tin thêm mới User.
  - **Tự động sinh mã (Auto-generate Code):** Viết logic tự động tạo Mã nhân sự (`STU-1234`, `MAN-4561`) tương ứng ngay khi người dùng chọn Vai trò trong Form, đồng thời khóa cứng ô Mã nhân sự không cho phép nhập tay.
  - **Chỉnh sửa User (PATCH API):** Tái sử dụng Modal để làm Form cập nhật thông tin. Mở khóa cho phép sửa `email` và `role` trực tiếp trên web, gọi API gửi thẳng xuống Backend (kèm theo tính năng backend tự kiểm tra xem email cập nhật có bị trùng không).
  - **UX/UI Fix:** Khắc phục triệt để lỗi màu chữ trắng khó nhìn trên background trắng của thẻ thả xuống (Dropdown Select).

## Giai đoạn 6: Tích hợp Hệ thống Nhận diện Khuôn mặt (AWS Rekognition & S3)
- **Thiết lập tài nguyên AWS (AWS Console & CLI):**
  - Khởi tạo S3 Bucket (`smart-campus-images`) để lưu trữ ảnh chụp.
  - Tạo Rekognition Collection (`smart-campus-faces`) để lập chỉ mục khuôn mặt.
- **Phát triển luồng đăng ký khuôn mặt (WF2 - Face Registration - End-to-End):**
  - **Giao diện Frontend (React):** Thêm Modal "Đăng ký khuôn mặt" trên trang `Users.jsx`. Hỗ trợ 2 phương thức: Upload file ảnh có sẵn hoặc **bật Webcam chụp trực tiếp** trên trình duyệt (sử dụng HTML5 `navigator.mediaDevices`).
  - **Xử lý Backend (FastAPI):** 
    - Nhận dữ liệu base64, decode và validate định dạng ảnh (JPEG/PNG) cũng như giới hạn kích thước (tối đa 5MB).
    - Gọi API lưu ảnh gốc lên S3 Bucket.
    - Tích hợp **AWS Rekognition (`IndexFaces`)** để nhận diện, tạo `faceId`, tính độ tin cậy (`confidence`) và lấy tọa độ khuôn mặt (`BoundingBox`).
  - **Khắc phục lỗi Dữ liệu (DynamoDB & Boto3):** 
    - Fix lỗi `500 Internal Server Error` do Boto3 không hỗ trợ kiểu `Float` trả về từ Rekognition, tự động parse các giá trị BoundingBox sang `String` trước khi lưu vào cơ sở dữ liệu.
    - Đồng bộ tên Khóa chính PK từ `faceId` sang `face_id` chuẩn theo schema của bảng `smart-campus-faces`.
  - **Khắc phục lỗi Hệ thống (CORS Policy):** Sửa lỗi thiết lập cấu hình CORS trong `main.py` của FastAPI để chặn tình trạng browser báo lỗi `Failed to fetch` khi backend phát sinh exception.

---

## Giai đoạn 7: Hoàn thiện WF3 – Luồng Điểm danh (Attendance)

- **Rule Engine (Nghiệp vụ Điểm danh):**
  - Định nghĩa 3 ca học: `MORNING` (7:00–12:00), `AFTERNOON` (13:00–17:30), `EVENING` (17:30–21:00).
  - Phân loại tự động: `PRESENT` (đúng giờ), `LATE` (muộn sau ngưỡng 15 phút), `REJECTED` (trùng lặp, ngoài ca).
  - Cơ chế **Idempotency**: ngăn điểm danh trùng trong cùng một ca học.
- **Backend – `attendance` module:**
  - Repository với 3 GSI hỗ trợ truy vấn nhanh: `date-index`, `userid-index`.
  - Service tích hợp `SearchFacesByImage` từ Rekognition, sau đó gọi Rule Engine và lưu kết quả vào DynamoDB.
  - Publish event `AttendanceRecorded` / `AttendanceRejected` / `UnknownFaceDetected` lên EventBridge.
- **Frontend – `Attendance.jsx`:**
  - Giao diện quản lý bản ghi điểm danh, filter theo ngày và ca học.
  - Hiển thị badge trạng thái (`PRESENT` / `LATE` / `REJECTED`) với màu sắc trực quan.

---

## Giai đoạn 8: Hoàn thiện WF4 – Luồng Thông báo (Notifications)

- **Backend – `notifications` module (hoàn chỉnh):**
  - **Message Templates:** Định nghĩa template thông báo cho 5 loại sự kiện: `AttendanceRecorded`, `AttendanceRejected`, `UnknownFaceDetected`, `SecurityIncidentCreated`, `Custom`.
  - **Đa kênh (Multi-channel):** Hỗ trợ gửi qua `EMAIL`, `SMS`, `PUSH`, `TEAMS`, `SLACK`, `WEBHOOK`.
  - **Gửi thực qua SNS:** Tích hợp `publish_to_topic()` qua Amazon SNS ARN.
  - **Audit Trail:** Mỗi thông báo được lưu vào bảng `smart-campus-notifications` DynamoDB (trạng thái `SENT` / `FAILED`).
  - **Publish Event:** Sau khi gửi thành công, publish sự kiện `NotificationSent` lên EventBridge để các module khác theo dõi.
  - **Repository** với GSI `userId-sentAt-index` cho phép tra cứu lịch sử thông báo theo user và thời gian.
- **Endpoints:**
  - `GET /api/notifications` – Lịch sử thông báo (filter theo `user_id`).
  - `POST /api/notifications/send` – Gửi thông báo thủ công (Admin).
- **Frontend – `Notifications.jsx`:** Giao diện xem lịch sử thông báo đã gửi.

---

## Giai đoạn 9: Hoàn thiện WF5 – Analytics Pipeline (Báo cáo & Phân tích)

### Backend

- **Thiết kế 2 Phase:**
  - **Phase 1 (DynamoDB):** Truy vấn trực tiếp bảng `smart-campus-attendance` — luôn sẵn sàng, không cần cấu hình thêm.
  - **Phase 2 (Athena/S3 Data Lake):** Khi biến môi trường `ATHENA_OUTPUT_LOCATION` được cấu hình, hệ thống tự động chuyển sang query Athena với auto-fallback về DynamoDB nếu Athena lỗi.
- **`analytics_worker.py` (Lambda):** Lắng nghe sự kiện `AttendanceRecorded` từ EventBridge → stream dữ liệu qua **Kinesis Firehose** → lưu xuống **S3 Data Lake** theo phân vùng `year/month/day` cho Glue Catalog và Athena.
- **`reports/repository.py` (Tạo mới):** Layer truy cập dữ liệu thống nhất cho cả DynamoDB và Athena, hàm `get_trend_records()` / `get_user_records()` tự chọn nguồn tối ưu.
- **Fix bug `get_report_summary()`:** Loại bỏ **double-query** (N×M DynamoDB reads) — chuyển sang **single-pass loop** tích lũy dữ liệu per-user trong cùng vòng lặp, giảm đáng kể số lần gọi DB.
- **Fix `KeyError: userId`:** Xử lý không nhất quán giữa `camelCase` (`userId` trong attendance table) và `snake_case` (`user_id` trong users table) bằng cách dùng `r.get("userId") or r.get("user_id")`.
- **4 REST Endpoints mới:**
  | Endpoint | Mô tả | Nguồn dữ liệu |
  |---|---|---|
  | `GET /api/reports/summary` | Báo cáo tổng hợp kỳ | DynamoDB |
  | `GET /api/reports/daily/{date}` | Báo cáo theo ngày/ca | DynamoDB |
  | `GET /api/reports/trend` | Dữ liệu xu hướng cho biểu đồ | Athena → DynamoDB |
  | `GET /api/reports/users/{id}/stats` | Thống kê chi tiết 1 user | Athena → DynamoDB |

### Frontend

- **Trang `Analytics.jsx` (Tạo mới):**
  - **4 KPI Cards** hiển thị: Tỉ lệ điểm danh tổng thể, Tổng user, Số ca ghi nhận, Số người vắng nhiều nhất.
  - **Area Chart** (Recharts): Xu hướng điểm danh theo ngày — phân biệt `Có mặt` và `Muộn` bằng màu sắc.
  - **Bar Chart**: Top 8 người có tỉ lệ điểm danh thấp nhất.
  - **User Lookup Panel**: Tra cứu theo User ID, hiển thị mini bar chart và bảng lịch sử điểm danh chi tiết.
  - **Date Range Picker**: Chọn khoảng ngày tùy ý, tự động tải lại dữ liệu.
  - **DataSource Badge**: Hiển thị rõ nguồn dữ liệu thực tế đang dùng (`Amazon Athena` hay `DynamoDB`).
- **`Dashboard.jsx` (Nâng cấp):** Thay thế placeholder chart bằng **Area Chart thực** từ `/reports/trend`, KPI cards lấy số liệu thực từ `/reports/summary`.
- **Thêm menu `Analytics`** vào Sidebar với icon `BarChart2`.
- **Cài đặt thư viện `recharts`** cho data visualization.

### Hạ tầng & Cấu hình

- **Vite Proxy:** Thêm cấu hình proxy `/api → http://localhost:8000` trong `vite.config.js` để giải quyết triệt để CORS khi phát triển local — request từ frontend không cần gọi trực tiếp sang port 8000 nữa.
- **API Base URL:** Chuẩn hóa `API_BASE = '/api'` (relative path) thay vì absolute URL để đảm bảo proxy hoạt động.

---

## Giai đoạn 10: Đặc tả nghiệp vụ WF8 – Task & Employee Management (2026-07-16)

- **Phân tích hiện trạng module `users`:** Xác định các field còn thiếu để hỗ trợ task assignment (`shift`, `is_on_duty`, `skill_tags`, `manager_id`, `hire_date`). Đề xuất chiến lược mở rộng schema-less, không phá vỡ dữ liệu cũ.
- **Thiết kế 4 loại Task:** `SECURITY_CHECK`, `MAINTENANCE`, `GENERAL`, `INSPECTION` với quy tắc gán task theo role.
- **Thiết kế State Machine:** Vòng đời task `TODO → IN_PROGRESS → DONE` với quy tắc chuyển trạng thái chặt chẽ và `OVERDUE` status ảo tính toán động.
- **Thiết kế DynamoDB Table `smart-campus-tasks`:** 15 attributes + 3 GSI (`assigneeId-status-index`, `status-createdAt-index`, `taskType-status-index`).
- **Thiết kế 7 API Endpoints** cho module tasks và 4 endpoints mở rộng module users.
- **Thiết kế 3 luồng nghiệp vụ:** Auto-flow từ WF7, Manual-flow từ Frontend, OVERDUE Detection định kỳ.
- **Thiết kế 4 Events EventBridge mới:** `TaskAssigned`, `TaskCompleted`, `TaskOverdue`, `TaskReassigned`.
- **Lập kế hoạch triển khai 4 Phase:** Backend Core → Frontend Core → Event-Driven Integration → Advanced Features.
- **Tài liệu:** Tạo file `docs/WF8_Task_and_Employee_Management.md` — đặc tả đầy đủ sẵn sàng phát triển.

## Giai đoạn 10b: Tiủnh chỉnh Thiết kế WF8 (2026-07-16)

Sau khi review kỹ đặc tả, thống nhất các quyết định thiết kế sau:

- **Bỏ ca trực & nhóm kỹ năng:** Hệ thống phục vụ nhân viên văn phòng, không cần `shift`, `is_on_duty`, `skill_tags`. Chỉ giữ `role (chức vụ)` làm tiêu chí duy nhất phân công task. Bổ sung tối thiểu 2 fields: `manager_id`, `hire_date`.
- **Bỏ `location`:** Không cần lưu địa điểm, mô tả việc nếu cần đưa vào `description` của task.
- **Bỏ `linked_incident_id`:** Xóa field này do WF7 Security tạm thời không triển khai.
- **Thêm `attachment_s3_keys`:** Lưu danh sách S3 key của file đính kèm (hình ảnh, PDF, báo cáo). Upload qua endpoint riêng `POST /tasks/{task_id}/attachments`. Response trả kèm `attachment_urls` (presigned URL động, không lưu DB).
- **Tạm hoãn WF7 Security:** Module Security phụ thuộc nhiều vào thiết bị ngoại vi (camera, sensor), chưa thể triển khai. Bỏ toàn bộ SECURITY_CHECK task type, auto-flow từ EventBridge Security, và TaskCompleted event.
- **Schema WF8 cuối cùng:** 3 task types (`MAINTENANCE`, `GENERAL`, `INSPECTION`), 13 DB attributes, 3 EventBridge events (`TaskAssigned`, `TaskOverdue`, `TaskReassigned`), 4 Business Rules.

---

## Trạng thái Hiện tại (2026-07-16)

| Workflow | Mô tả | Trạng thái |
|:---|:---|:---:|
| WF1 – Authentication | Cognito JWT | ✅ Hoàn thành |
| WF2 – Face Registration | Rekognition IndexFaces + S3 | ✅ Hoàn thành |
| WF3 – Attendance | SearchFacesByImage + Rule Engine | ✅ Hoàn thành |
| WF4 – Notification | SNS Multi-channel + EventBridge | ✅ Hoàn thành |
| WF5 – Analytics | DynamoDB + Athena + Dashboard | ✅ Hoàn thành |
| WF6 – AI Assistant | Bedrock NL2SQL + Athena | ⏸ Tạm hoãn – Chờ Bedrock quota |
| WF7 – Security | Risk Engine + Incident Management | ⏸ Tạm hoãn – Phụ thuộc thiết bị ngoại vi |
| WF8 – Task & Employee Mgmt | Task CRUD + File Attachment + EventBridge | 📋 Đặc tả chốt – **Sẵn sàng phát triển** |

### Bước tiếp theo (Next Steps)

1. **[Phase 1 – AWS Console]** Tạo DynamoDB table `smart-campus-tasks` (13 attributes, 3 GSI)
2. **[Phase 1 – Backend]** Code `app/modules/tasks/`: schemas → repository → service → router
3. **[Phase 1 – Backend]** Mở rộng `app/modules/users/`: thêm endpoint `/{user_id}/tasks` và `/{user_id}/stats`, bổ sung field `manager_id`, `hire_date`
4. **[Phase 2 – Frontend]** Tạo `Tasks.jsx` (Kanban view, KPI cards) + `MyTasks.jsx`
5. **[Phase 2 – Frontend]** Bổ sung Employee KPI badge và Task History Link vào `Users.jsx`
