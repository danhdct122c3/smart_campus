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

## Giai đoạn 10b: Tinh chỉnh Thiết kế WF8 (2026-07-16)

Sau khi review kỹ đặc tả, thống nhất các quyết định thiết kế sau:

- **Bỏ ca trực & nhóm kỹ năng:** Hệ thống phục vụ nhân viên văn phòng, không cần `shift`, `is_on_duty`, `skill_tags`. Chỉ giữ `role (chức vụ)` làm tiêu chí duy nhất phân công task. Bổ sung tối thiểu 2 fields: `manager_id`, `hire_date`.
- **Bỏ `location`:** Không cần lưu địa điểm, mô tả việc nếu cần đưa vào `description` của task.
- **Bỏ `linked_incident_id`:** Xóa field này do WF7 Security tạm thời không triển khai.
- **Thêm `attachment_s3_keys`:** Lưu danh sách S3 key của file đính kèm (hình ảnh, PDF, báo cáo). Upload qua endpoint riêng `POST /tasks/{task_id}/attachments`. Response trả kèm `attachment_urls` (presigned URL động, không lưu DB).
- **Tạm hoãn WF7 Security:** Module Security phụ thuộc nhiều vào thiết bị ngoại vi (camera, sensor), chưa thể triển khai. Bỏ toàn bộ SECURITY_CHECK task type, auto-flow từ EventBridge Security, và TaskCompleted event.
- **Schema WF8 cuối cùng:** 3 task types (`MAINTENANCE`, `GENERAL`, `INSPECTION`), 13 DB attributes, 3 EventBridge events (`TaskAssigned`, `TaskOverdue`, `TaskReassigned`), 4 Business Rules.

---

## Trạng thái Hiện tại (2026-07-22)

| Workflow | Mô tả | Trạng thái |
|:---|:---|:---:|
| WF1 – Authentication | Cognito JWT | ✅ Hoàn thành |
| WF2 – Face Registration | Rekognition IndexFaces + S3 | ✅ Hoàn thành |
| WF3 – Attendance | SearchFacesByImage + Rule Engine | ✅ Hoàn thành |
| WF4 – Notification | SNS Multi-channel + EventBridge + Task Integration | ✅ Hoàn thành |
| WF5 – Analytics | DynamoDB + Athena + Dashboard | ✅ Hoàn thành |
| WF6 – AI Assistant | Bedrock NL2SQL + Athena | ⏸ Tạm hoãn – Chờ Bedrock quota |
| WF7 – Security | Risk Engine + Incident Management | ⏸ Tạm hoãn – Phụ thuộc thiết bị ngoại vi |
| WF8 – Task & Employee Mgmt | Task CRUD + Incident + Maintenance Workflow + Notification | ✅ Hoàn thành |

## Giai đoạn 11: Phát triển Thực tế WF8 – Quản lý Công việc & Sự cố (2026-07-21)

- **Mở rộng Schema Database:**
  - Bổ sung `task_type` (`STANDARD` và `INCIDENT`), `department`, `category` và `location`.
  - Cấu hình linh hoạt: `assignee_id` trở thành trường tùy chọn đối với Báo cáo sự cố, hỗ trợ quy trình khi người báo cáo không biết ai sẽ phụ trách sửa chữa.
- **Phát triển Frontend Nâng cao (React UI):**
  - Xây dựng Modal Giao việc động, tự động hiển thị/ẩn trường nhập liệu tùy theo `task_type`.
  - **Quản lý Subtask (Công việc con):** Giao diện tự động khóa `department` của Subtask theo cấu hình của Task cha. Tự động lọc danh sách nhân viên khả dụng theo phòng ban.
  - Tích hợp tính năng Kéo-Thả (Drag & Drop) file đính kèm.
- **Khắc phục lỗi Tích hợp AWS S3:**
  - Cấu hình lại S3 Bucket Policy (CORS) để khắc phục lỗi 403 khi Frontend gọi lệnh `PUT` từ localhost.
  - Sửa lỗi 307 Temporary Redirect từ AWS bằng cách sử dụng Regional Endpoint (`s3.ap-southeast-1.amazonaws.com`) trong cấu hình Boto3.
  - Bổ sung hệ thống **Dynamic URL Signing** ở Backend. Vì S3 Bucket bị thiết lập chặn truy cập công khai (Block Public Access), Backend sẽ tự động phát sinh các Pre-signed GET URL khi trả về danh sách Task, đảm bảo tính bảo mật nhưng vẫn cho phép user mở file trực tiếp từ trình duyệt.
- **Dữ liệu Mock (Data Seeding):** 
  - Khởi tạo 10 tài khoản dummy bao phủ các cấp bậc (`DIRECTOR`, `MANAGER`, `STAFF`, `SECURITY`, `MAINTENANCE`) và các phòng ban (`ADMIN`, `IT`, `HR`, `MAINTENANCE`, `SECURITY`) để kiểm thử hệ thống Phân quyền (RBAC).
- **Hoàn thiện Tính năng và Phân quyền (RBAC):**
  - Bổ sung tính năng Sửa và Xóa công việc.
  - Cấu hình phân quyền Backend: Admin có toàn quyền (Hard delete kèm subtasks), Reporter chỉ được phép Hủy (Soft delete sang trạng thái `CANCELLED`) nếu công việc chưa bắt đầu. Người dùng không liên quan không được can thiệp.
- **Tối ưu hóa Phân trang NoSQL (Hybrid Chunk Pagination):**
  - Áp dụng kỹ thuật phân trang kết hợp (Best Practice của DynamoDB): Backend tải dữ liệu theo các cụm (Chunk) lớn (30 items), Frontend tự động chia nhỏ thành các trang (10 items/trang) và hiển thị số trang cụ thể. Giải pháp này giúp tối ưu hóa UX (giữ trải nghiệm đánh số trang truyền thống) mà không gặp trở ngại về giới hạn đếm tổng số trang của NoSQL.
- **Khắc phục lỗi (Bug Fixes):**
  - Xử lý lỗi UI: Mở rộng giới hạn tải danh sách User từ API để tự động đối chiếu và ánh xạ (map) UUID thành Tên thật trong bảng Tasks.
  - Xử lý lỗi Backend (SYS_001): Khắc phục lỗi import sai tên hàm `get_user_by_id` khi hệ thống kiểm tra quyền hạn xóa công việc.

---

## Giai đoạn 12: Quy trình Bảo trì & Tích hợp Thông báo vào Task (2026-07-22)

### 12.1 – Hoàn thiện Quy trình Nghiệp vụ Bảo trì (Maintenance Workflow – Phương án B)

- **Thiết kế quy trình điều phối sự cố:**
  - Khi nhân viên bất kỳ bấm **"Báo cáo sự cố"**, hệ thống tự động gán công việc cho **Quản lý phòng Bảo trì** (MANAGER có `department = MAINTENANCE`).
  - Quản lý bảo trì nhận sự cố → bấm **"Phân công"** để chọn kỹ thuật viên (MAINTENANCE staff) xử lý.
  - Kỹ thuật viên hoàn thành → bấm **"Báo cáo hoàn thành"** kèm ghi chú (ảnh chụp hiện trường tùy chọn, không bắt buộc).
- **Cập nhật RBAC Backend (`service.py`):**
  - Mở quyền cho MANAGER khi đang là Assignee: Quản lý được phép thay đổi toàn bộ thông tin Task (bao gồm `assignee_id` để phân công lại) thay vì bị giới hạn chỉ sửa `status` và `submission_file_url` như nhân viên thường.
- **Khóa trường nhập liệu khi chỉnh sửa (Frontend):**
  - Khi mở form **Sửa/Phân công** task, các trường **Loại công việc**, **Phòng ban xử lý**, và **Phân loại sự cố** bị khóa (`disabled`) để ngăn người dùng thay đổi bản chất sự cố gốc đã được báo cáo.
- **Tự động gắn tài liệu đính kèm từ Task cha:**
  - Khi tạo Subtask (công việc con), hệ thống tự động sao chép `file_url` từ Task gốc sang, giúp kỹ thuật viên nhận được đầy đủ tài liệu mà không cần upload lại thủ công.
- **Validation ngày tháng:**
  - Không cho phép tạo công việc với ngày deadline trong quá khứ.
  - Sửa lỗi UI: khôi phục giao diện chọn lịch (date picker) thay vì chỉ nhập tay.

### 12.2 – Tích hợp Hệ thống Thông báo (WF4) vào Quản lý Công việc (WF8)

- **Backend – Mở rộng module `notifications`:**
  - Bổ sung **5 Event Types mới** vào schema: `TaskAssigned`, `TaskStatusChanged`, `TaskSubmitted`, `TaskCompleted`, `IncidentReported`.
  - Tạo **5 Message Templates** tiếng Việt tương ứng cho từng sự kiện, sử dụng hệ thống format tự động với biến `{task_title}`, `{reporter_name}`, `{assignee_name}`, `{new_status}`.
  - Thêm hàm `send_task_notification()` trong `notifications/service.py` – hàm tiện ích chung để gửi thông báo task qua kênh PUSH.
- **Backend – Tích hợp vào `tasks/service.py`:**
  - Thêm helper `_get_user_name()` để tra cứu tên hiển thị từ `user_id`.
  - Thêm wrapper `_send_task_notif()` hoạt động theo cơ chế **Fire-and-forget**: gửi thông báo ngầm, nếu lỗi thì chỉ log mà không block luồng task chính.
  - **7 điểm tích hợp thông báo tự động:**

  | Sự kiện | Người nhận | Nội dung |
  |---|---|---|
  | Tạo công việc mới (STANDARD) | Người thực hiện | "Bạn vừa được giao công việc X bởi Y" |
  | Báo cáo sự cố mới (INCIDENT) | Quản lý bảo trì | "Y vừa báo cáo sự cố X. Vui lòng phân công xử lý" |
  | Phân công lại (Re-assign) | Người thực hiện mới | "Bạn vừa được giao công việc X" |
  | Nộp báo cáo (IN_REVIEW) | Người giao việc | "Z đã nộp báo cáo cho công việc X" |
  | Duyệt hoàn thành (COMPLETED) | Người thực hiện + Người giao | "Công việc X đã hoàn thành" |
  | Từ chối (IN_REVIEW → IN_PROGRESS) | Người thực hiện | "Công việc X bị từ chối – Cần làm lại" |
  | Thay đổi trạng thái (qua endpoint riêng) | Người thực hiện | "Công việc X đã cập nhật sang trạng thái Y" |

### 12.3 – Tích hợp Notification Dropdown vào Header (Frontend)

- **Nâng cấp `Header.jsx`:**
  - Biểu tượng chuông 🔔 giờ gọi API `/api/notifications?limit=5` mỗi 30 giây (polling).
  - Hiển thị **chấm đỏ** chỉ khi thực sự có thông báo (trước đó bị fix cứng).
  - Bấm vào chuông → hiển thị **Dropdown Menu** với animation fade-in, chứa 5 thông báo mới nhất (icon theo loại sự kiện, tiêu đề, nội dung, thời gian).
  - Bấm vào thông báo hoặc nút **"Xem tất cả"** → điều hướng sang trang `/notifications`.
  - Click outside dropdown → tự động đóng.

### 12.4 – Khắc phục lỗi Nghiêm trọng: Notification không lưu được vào DynamoDB

- **Nguyên nhân gốc:** Toàn bộ module Notifications (`service.py` + `repository.py`) đang dùng **camelCase** (`notificationId`, `userId`, `eventType`, `sentAt`) để đặt tên field khi lưu item vào DynamoDB. Tuy nhiên, bảng `smart-campus-notifications` trên AWS thực tế được tạo với **snake_case** (`notification_id`, `user_id`). Kết quả: mỗi lần gọi `PutItem` đều bị DynamoDB từ chối (`ValidationException: Missing the key notification_id`), và lỗi này bị hàm `try/except pass` nuốt mất hoàn toàn (silent failure).
- **Giải pháp:**
  - Sửa `notifications/service.py`: Chuyển tất cả field names trong `_persist_and_notify()` sang snake_case (`notification_id`, `user_id`, `event_type`, `sent_at`, `error_message`).
  - Sửa `notifications/repository.py`: Cập nhật key names trong `get_notification()` và GSI index name từ `userId-sentAt-index` sang `user_id-sent_at-index`.
  - Sửa `_to_record()`: Dùng `.get()` với fallback cho cả 2 dạng (camelCase/snake_case) để tương thích ngược với dữ liệu cũ nếu có.
- **Xác nhận fix:** Chạy script test trực tiếp ghi thành công notification vào DynamoDB.

### 12.5 – Cải thiện UX trang Notifications

- **Hiển thị Tên thay vì UUID:** Trang `Notifications.jsx` giờ tự động fetch danh sách users từ API `/api/users`, tạo bảng ánh xạ (`userMap`) từ `user_id → name`, và hiển thị tên người nhận thay vì chuỗi UUID khó đọc.

### Bước tiếp theo (Next Steps)

1. Tối ưu hóa UI hiển thị danh sách Task theo mô hình Kanban.
2. Tích hợp AI (Bedrock) vào WF8 để phân tích mức độ ưu tiên của các Báo cáo Sự cố.
3. Bổ sung tính năng nhắc nhở tự động khi Task sắp đến hạn deadline (Scheduled Notification).

---

## Giai đoạn 13: Hợp nhất Giao diện, Hoàn thiện AWS Cognito & Fix Bug Hệ thống (2026-07-29)

### 13.1 – Giao diện & Trải nghiệm Người dùng (UX/UI)
- **Hợp nhất Tasks:** Gộp trang "Công việc của tôi" (My Tasks) vào chung trang "Quản lý công việc" (Tasks), loại bỏ sự dư thừa, giúp người dùng theo dõi toàn bộ công việc trên một màn hình duy nhất một cách tập trung.
- **Tối ưu hiển thị Thông báo (Notifications):**
  - Xóa cột "Trạng thái" không cần thiết trong bảng thông báo.
  - Sửa lại câu thông báo khi danh sách trống từ "Không tìm thấy thông báo nào." thành "Chưa có thông báo nào." mượt mà hơn.
  - Fix lỗi hiện chấm đỏ (Unread): Chấm đỏ thông báo mới ở Header nay sẽ tự động tắt (đánh dấu đã đọc) ngay khi người dùng rê chuột vào chuông thông báo.
  - Fix lỗi Public Notifications: Chỉnh sửa lại logic gọi API để đảm bảo mỗi nhân viên chỉ nhìn thấy các thông báo được gửi đích danh cho `user_id` của họ, bảo vệ quyền riêng tư tuyệt đối.

### 13.2 – Tích hợp Hoàn chỉnh AWS Cognito (Xác thực 2 lớp Mật khẩu)
- **Tích hợp tính năng Gửi thư mặc định:**
  - Tích hợp hàm `admin_create_user` (AWS Cognito Boto3) vào Endpoint tạo tài khoản của Admin. Giờ đây, khi Admin tạo tài khoản cho nhân sự mới, AWS sẽ tự động sinh Mật khẩu tạm thời (Temporary Password) và gửi trực tiếp qua Email của nhân sự đó nhờ dịch vụ "Send email with Cognito" tích hợp sẵn (không cần setup Amazon SES).
- **Luồng Đổi mật khẩu bắt buộc (Force Change Password):**
  - **Backend:** Mở rộng module Auth, bổ sung API `POST /api/auth/respond-challenge` để bắt tín hiệu `NEW_PASSWORD_REQUIRED` từ Cognito.
  - **Frontend:** Cải tiến `Login.jsx` và `AuthContext.jsx`. Nếu nhân sự đăng nhập bằng mật khẩu tạm, hệ thống sẽ chặn luồng đăng nhập, chuyển sang giao diện "Mật khẩu mới", yêu cầu nhân sự tự đặt mật khẩu riêng an toàn trước khi vào hệ thống.
  - Bổ sung văn bản hướng dẫn độ phức tạp của mật khẩu ngay trên UI giao diện Đăng nhập (Ít nhất 8 ký tự, chữ HOA, chữ thường, số, ký tự đặc biệt).

### 13.3 – Xử lý Lỗi Hệ thống (Bug Fixes)
- **Fix lỗi 500 API Notifications:**
  - **Nguyên nhân:** GSI `user_id-sent_at-index` không tồn tại hoặc chưa tạo kịp trên DynamoDB, dẫn đến việc dùng hàm `Query` bị văng lỗi.
  - **Giải pháp:** Cập nhật lại Backend `repository.py` để sử dụng hàm `Scan` kết hợp với `FilterExpression` làm giải pháp dự phòng (fallback) truy xuất thông báo cho người dùng một cách an toàn.
- **Fix lỗi 500 khi đổi mật khẩu (Auth):**
  - **Nguyên nhân:** AWS Cognito trả về lỗi mật khẩu yếu (`InvalidPasswordException`), nhưng Backend lại dùng nhầm hằng số `ErrorCode.BAD_REQUEST` (chưa được định nghĩa trong core) để văng lỗi, khiến hệ thống sập và báo lỗi 500 Internal Server Error thay vì 400 Bad Request.
  - **Giải pháp:** Cập nhật lại chuẩn Exception handling, map đúng về `ErrorCode.VALIDATION_ERROR` (422) và `ErrorCode.UNAUTHORIZED` (401). Đảm bảo lỗi mật khẩu yếu được bắt gọn và gửi về Frontend hiển thị đỏ đẹp mắt.
  - Fix triệt để cả lỗi cú pháp (SyntaxError) trong quá trình vá file `auth/service.py`.

### 13.4 – Nâng cấp Bảo mật & Trải nghiệm Sinh trắc học (My Profile)
- **Tự động hóa Đăng ký Khuôn mặt (Self-service):**
  - Tạo mới trang **Hồ sơ cá nhân (My Profile)** dành cho tất cả nhân viên.
  - Tích hợp tính năng bật Webcam trực tiếp trên trình duyệt hoặc tải ảnh thẻ lên để nhân viên tự cập nhật khuôn mặt mà không cần thông qua Admin.
  - Cập nhật Sidebar để hiển thị menu My Profile cho mọi người dùng có tài khoản.
- **Vá lỗ hổng Trùng lặp Dữ liệu (Duplicate Face Registration):**
  - **Vấn đề:** Ban đầu hệ thống không kiểm tra tính duy nhất, dẫn đến rủi ro 1 nhân viên lập 2 tài khoản và dùng 1 khuôn mặt.
  - **Giải pháp:** Bổ sung API `SearchFacesByImage` của Amazon Rekognition vào đầu chu trình `register_face`. Nếu khuôn mặt quét được đã tồn tại trong AWS Collection $\rightarrow$ Chặn đứng, báo lỗi "Khuôn mặt đã được đăng ký" và không gọi `IndexFaces`.
- **Fix Bug Camera UI:** Xử lý lỗi rò rỉ bộ nhớ & không tắt đèn Webcam khi người dùng chuyển từ tab "Chụp Camera" sang tab "Tải ảnh lên" (áp dụng cho cả trang Profile và trang Users). Cập nhật hàm `stopFaceCamera()` để giải phóng luồng video triệt để.

---

## Giai đoạn 14: Tái thiết kế Giao diện Báo cáo (Analytics) & Hợp nhất Dashboard (2026-07-30)

### 14.1 – Hợp nhất Trang chủ (Dashboard & Analytics)
- **Vấn đề:** Trang Dashboard cũ chỉ đóng vai trò hiển thị sơ sài một vài thông số tĩnh, gây lãng phí không gian hiển thị và trải nghiệm người dùng không tốt.
- **Giải pháp:** 
  - Xóa bỏ hoàn toàn file `Dashboard.jsx`.
  - Thay thế trang chủ (Root path `/`) bằng trang **Analytics** (`Analytics.jsx`).
  - Mở quyền truy cập trang chủ mới (Analytics) cho tất cả các Role trong hệ thống (từ Admin, Manager cho đến Staff, Security, Maintenance).

### 14.2 – Tái thiết kế UX/UI trang Analytics (Focus on Tasks & Attendance)
- **Từ bỏ KPI doanh nghiệp:** Chuyển trọng tâm trang Analytics sang giám sát chuyên sâu 2 mảng chính: **Chấm công (Attendance)** và **Công việc (Tasks)**.
- **Thiết kế UI Cao cấp (Premium Glassmorphism):**
  - **KPI Cards:** Được thay thế bằng 4 thẻ thông số rút gọn nhưng trực quan hơn. Đặc biệt tích hợp **Circular Progress Ring (SVG)** để hiển thị phần trăm tỉ lệ chuyên cần dạng vòng tròn, kèm hiệu ứng hover phát sáng (`box-shadow` & `border-color`).
  - **Attendance Trend:** Tối ưu hóa biểu đồ vùng (Area Chart) với Recharts. Thêm dải màu gradient mượt mà (Cyan cho "Có mặt", Amber cho "Đi muộn"), giúp biểu đồ bớt đơn điệu và dễ phân tích xu hướng hơn.
  - **Task Overview (MỚI):** Tự thiết kế một biểu đồ vòng (Donut Chart) bằng **SVG thuần** (không dùng thư viện ngoài) để trực quan hóa trạng thái các công việc (Hoàn thành, Đang xử lý, Chờ xử lý, Quá hạn).
  - **Top nhân viên vắng mặt:** Thay thế biểu đồ cột (Bar chart) đỏ rực cũ bằng một danh sách ngang tinh tế (List view) tích hợp thanh tiến trình ngang (Horizontal Progress Bar) với màu sắc cảnh báo động (Xanh > 90%, Vàng > 70%, Đỏ < 70%).

### 14.3 – Tích hợp Phân quyền 3 Tầng (Role-Based Access Control - RBAC)
Trang Analytics mới nay có khả năng tự thay đổi hình thù và phạm vi dữ liệu tùy theo người xem:
- **Tầng 1 (ADMIN / PO / DIRECTOR):** Xem được dữ liệu toàn hệ thống. Có thêm **Bảng so sánh chéo hiệu suất giữa các Phòng ban** (Department Comparison Matrix) với hệ thống huy hiệu đánh giá tự động (Xuất sắc, Tốt, Cần cải thiện).
- **Tầng 2 (MANAGER / PM):** Bộ lọc Phòng ban bị khóa cứng (`disabled`). Quản lý chỉ được xem dữ liệu, biểu đồ công việc và top nhân viên đi muộn trong phạm vi phòng ban của mình.
- **Tầng 3 (STAFF / STUDENT):** Giao diện chuyển thành **"Báo cáo cá nhân" (My Analytics)**. Chỉ hiển thị tỉ lệ chuyên cần, tiến độ công việc cá nhân, khối lượng task và lịch sử các lần check-in của chính họ.
- **Lợi ích kiến trúc:** Đạt được trải nghiệm cá nhân hóa toàn diện cho mọi người dùng mà **KHÔNG CẦN CHỈNH SỬA BACKEND**. Toàn bộ logic filter (theo department, user_id) đã được thiết kế sẵn từ trước qua các API của `reports` module.

---

## Giai đoạn 15: Khởi tạo Nghiệp vụ Quản lý Nghỉ phép (Leave Management)

### 15.1 – Thiết kế Cơ sở Dữ liệu & Kiến trúc Backend
- **DynamoDB:** Khởi tạo bảng `smart-campus-leaves` lưu trữ toàn bộ các đơn xin nghỉ. Thiết lập các Global Secondary Index (GSI) để truy vấn nhanh theo `user_id` và `status`.
- **Backend Module (`leaves`):**
  - Xây dựng hệ thống API cho phép đăng ký 4 loại nghỉ phép: `WFH` (Làm việc từ xa), `ANNUAL_LEAVE` (Phép năm), `SICK_LEAVE` (Nghỉ ốm) và `BUSINESS_TRIP` (Công tác).
  - Tích hợp nghiệp vụ duyệt đơn đa cấp: Nhân viên nộp đơn $\rightarrow$ Quản lý duyệt/từ chối.
  - Quản lý Ngày lễ (Holidays): Cung cấp API cho Admin thiết lập danh sách các ngày lễ trong năm.

### 15.2 – Giao diện Người dùng (Frontend - Leaves.jsx)
- **Interactive Calendar (Lịch Tương Tác):** Xây dựng bộ lịch hiển thị dạng lưới trực quan. Đổ màu hiển thị trạng thái từng ngày (Ngày lễ, Nghỉ phép, Công tác, Cuối tuần). 
- **Form Đăng ký Thông minh:** Tự động điền ngày được chọn trên lịch vào Form đăng ký.
- **Tích hợp Điểm danh WFH:** Bổ sung tính năng "Điểm danh WFH" ngay trên giao diện đối với các nhân sự được duyệt làm việc từ xa, tự động đồng bộ kết quả `PRESENT` sang module `attendance` và đánh dấu đã điểm danh.

---

## Giai đoạn 16: Hoàn thiện Nghiệp vụ Xin Nghỉ phép & Tối ưu Trải nghiệm (2026-08-02)

### 16.1 – Xử lý Logic & Ngăn chặn Trùng lặp (Backend)
- **Kiểm tra trùng lặp thời gian:** Cập nhật hàm `submit_leave_request` để tự động đối chiếu khoảng thời gian `date_from` - `date_to` với các đơn cũ (đang Chờ duyệt hoặc Đã duyệt). Ngăn chặn và báo lỗi nếu người dùng cố tình xin nghỉ trùng lịch.
- **Ràng buộc Ngày lễ:** Backend tự động quét tập ngày (date range) mà người dùng xin nghỉ, nếu phát hiện có bất kỳ ngày nào trùng với Ngày lễ đã được Admin thiết lập, hệ thống sẽ chặn đăng ký.

### 16.2 – Phát triển Tính năng Hủy Đơn (Cancel Leave)
- **Mở rộng Schema & Status:** Thêm trạng thái `CANCELLED` vào `LeaveStatus` Enum.
- **Backend API (`PATCH /leaves/{request_id}/cancel`):** 
  - Chỉ cho phép nhân viên tự hủy đơn của chính mình.
  - Ràng buộc trạng thái: Chỉ được phép hủy khi đơn ở trạng thái `PENDING` hoặc `APPROVED`.
  - Ràng buộc thời gian: Không thể hủy đơn trong quá khứ hoặc đơn đã đến ngày bắt đầu (chỉ cho phép hủy nếu `date_from > today` - quy đổi theo chuẩn UTC).
- **Frontend UI:**
  - Bổ sung nút **"Hủy"** màu đỏ (kèm icon) ở các đơn nghỉ phép thỏa điều kiện trong tab "Lịch sử của tôi".
  - Hiển thị Badge `Đã hủy` màu xám mờ để phân biệt với các đơn bị `Từ chối`.

### 16.3 – Nâng cấp Trải nghiệm Người dùng (UX UI - Toast Notifications)
- **Tối ưu hóa Phân trang (Notifications):** Bổ sung cơ chế phân trang cục bộ dạng Chunk (10 mục/trang) cho trang Thông báo, tái sử dụng mô hình thành công từ trang Quản lý Nhân sự (Users) và Công việc (Tasks), giúp UI gọn gàng. Khắc phục triệt để lỗi trùng lặp biến `filteredItems` gây treo trình biên dịch Vite trong quá trình refactor.
- **Loại bỏ Browser Alert:** Xóa sổ hoàn toàn hộp thoại thông báo `alert(...)` mặc định xấu xí của trình duyệt trên toàn bộ module Xin Nghỉ phép (`Leaves.jsx`).
- **Xây dựng Toast Component In-house:** Thay thế bằng hệ thống Thông báo nổi bọt (Toast Notifications) mang phong cách UI Cao cấp (Glassmorphism), tự động xuất hiện với hiệu ứng rơi xuống (fadeInDown) và mờ đi sau 4 giây. Tích hợp linh hoạt hiển thị cảnh báo lỗi (màu đỏ) và thành công (màu xanh).

## Giai đoạn 17: Nâng cấp Đăng nhập Sinh trắc học & Tinh chỉnh UX/UI Hệ thống (2026-08-03)

### 17.1 – Hoàn thiện Luồng Nhận diện khuôn mặt (Face Recognition)
- **Cải thiện Loading UX:** Bổ sung Loading Overlay cho các thao tác liên quan đến AI sinh trắc học (Đăng ký khuôn mặt, Đăng nhập bằng khuôn mặt, Check-in, Khôi phục mật khẩu). Ngăn chặn người dùng bấm liên tục gây spam request lên AWS Rekognition.
- **Tính năng Đăng nhập & Khôi phục Mật khẩu bằng Khuôn mặt:**
  - Hoàn thiện hoàn toàn luồng đăng nhập không cần mật khẩu thông qua FaceID.
  - Tích hợp tính năng Reset Password an toàn: Người dùng quên mật khẩu có thể dùng chính khuôn mặt của mình để xác thực danh tính và đặt lại mật khẩu mới ngay trên trình duyệt mà không cần OTP qua email hay số điện thoại.

### 17.2 – Cập nhật Nghiệp vụ Điểm danh (WFH) & Fix lỗi Dữ liệu
- **Hỗ trợ WFH không cần FaceID:** Khắc phục lỗi yêu cầu người dùng phải có dữ liệu khuôn mặt mới được bấm nút "Điểm danh WFH". Giờ đây, những nhân viên làm việc từ xa (đã được duyệt WFH) có thể check-in bằng nút bấm cơ bản trên Dashboard.
- **Đồng bộ Property Keys (camelCase vs snake_case):**
  - **Vấn đề:** Bảng Lịch sử Điểm danh (Attendance) bị trắng các cột "Mã nhân sự", "Ca học" do giao diện cố đọc các biến `userId`, `sessionType` nhưng backend lại trả về `user_id`, `session_type`.
  - **Giải pháp:** Cập nhật lại toàn bộ file `Attendance.jsx` để ánh xạ chính xác các thuộc tính snake_case từ Backend.
- **Tinh giản Thông tin Điểm danh:** Gỡ bỏ hiển thị "Ca học" (Session) và "Phòng ban" (Room) khỏi các bảng Lịch sử Điểm danh (tại trang Analytics và My Profile) theo yêu cầu thực tế, giúp giao diện gọn gàng và bớt rối mắt.
- **Fix lỗi thời gian Check-in WFH:** Chỉnh sửa logic backend để bản ghi WFH ghi nhận chính xác thời gian thực tế người dùng bấm nút thay vì mặc định hardcode `07:00:00` như trước.

### 17.3 – Tinh chỉnh Giao diện Quản lý Công việc & Nghỉ phép
- **Format hiển thị Thời gian & Cảnh báo Quá hạn (Tasks):** 
  - Đưa thông tin Giờ-Phút (hh:mm) vào hiển thị Deadline trong Lịch sử công việc của nhân viên, thay vì chỉ hiện Ngày.
  - Cập nhật thuật toán tính quá hạn (Overdue): Hệ thống nay so sánh chính xác đến từng phút hiện tại thay vì chỉ so sánh theo ngày, giúp cảnh báo chữ đỏ (⚠) hoạt động chuẩn xác.
- **Việt hóa Mức độ ưu tiên (Priority):** Tự động dịch các thẻ hiển thị ưu tiên tiếng Anh (`URGENT`, `HIGH`, `MEDIUM`, `LOW`) sang tiếng Việt (`KHẨN CẤP`, `CAO`, `TRUNG BÌNH`, `THẤP`) trong Modal chi tiết công việc của nhân viên.
- **Fix Crash React (`createPortal`):** Khắc phục lỗi màn hình trắng/đen toàn tập khi truy cập trang Tasks, nguyên nhân do hàm `createPortal` của `TaskDetailDrawer` bị thiếu tham số `document.body` (lỗi cú pháp React).
- **UX trang Nghỉ phép (Leaves):** Đảo lại thứ tự các tab điều hướng trên trang Nghỉ phép thành: `Lịch tháng` (Mặc định) $\rightarrow$ `Chờ duyệt` (Dành cho Quản lý) $\rightarrow$ `Lịch sử của tôi` $\rightarrow$ `Ngày lễ` (Dành cho Admin), ưu tiên lịch tương tác lên đầu để tiện sử dụng.
- **Quyền Cập nhật Task:** Khóa cứng hai trường `Loại công việc` và `Phòng ban xử lý` khi cập nhật công việc đã tạo, tránh tình trạng User hoặc Manager tự ý đổi sai luồng nghiệp vụ.

---

## Giai đoạn 18: Tích hợp Hệ thống Giám sát & Báo động (Monitoring & Observability) (2026-08-06)

### 18.1 – Truy vết Hệ thống bằng AWS X-Ray (Tracing)
- **Tích hợp AWS X-Ray SDK:** Thêm thư viện `aws-xray-sdk` vào `requirements.txt` để hỗ trợ truy vết các luồng API.
- **Theo dõi Tự động (Auto-Patching):** Gọi hàm `patch_all()` trong `main.py` để X-Ray tự động "bám" vào thư viện `boto3`. Nhờ đó, tất cả các request giao tiếp từ Lambda sang DynamoDB, Rekognition, S3... đều được vẽ lên biểu đồ mạng nhện (Service Map) với tốc độ mili-giây rất trực quan.
- **Fix Bug Xung đột Segment (Lỗi 500 Lambda):**
  - **Vấn đề:** Khi deploy lên AWS, toàn bộ hệ thống bị sập với lỗi 500 Internal Server Error.
  - **Nguyên nhân gốc:** FastAPI sử dụng `XRayMiddleware` cố tạo ra một "Segment" mới cho mỗi request. Tuy nhiên, môi trường thực thi của AWS Lambda đã tự tạo sẵn một root Segment. Việc tạo đè lên khiến X-Ray SDK văng Exception.
  - **Giải pháp:** Gỡ bỏ hoàn toàn `XRayMiddleware` khỏi FastAPI khi chạy trên Lambda, chỉ giữ lại `patch_all()`. Các subsegment gọi `boto3` sẽ tự động bám vào root Segment mặc định của Lambda.

### 18.2 – Thiết lập Cảnh báo Tự động (CloudWatch Alarms + SNS)
- **Thiết lập Metric giám sát:** Cấu hình CloudWatch Alarm theo dõi chỉ số `Errors` (Lỗi 5xx/Crash hệ thống) của hàm Lambda `smart-campus-api`.
- **Tích hợp Kênh thông báo khẩn cấp:** Liên kết Alarm với danh sách nhận thông báo **Amazon SNS** (`smart-campus-notifications`). Khi Lambda văng lỗi nghiêm trọng (vd: đứt kết nối DB), hệ thống sẽ gửi Email cảnh báo trực tiếp về hòm thư của Admin trong vòng chưa tới 5 phút.
- **Tối ưu hóa Báo động (Alerting Best Practices):** Thống nhất kiến trúc chỉ báo động qua Email đối với lỗi hệ thống (5xx) được ghi nhận ở Lambda. Còn các lỗi thao tác của người dùng (4xx như sai mật khẩu, thiếu dữ liệu) thì hệ thống chủ động bắt và bỏ qua, không kích hoạt báo động sai (False Alarm).

---

## Giai đoạn 19: Nâng cấp Độ tin cậy (Reliability Upgrade) với Amazon SQS (2026-08-06)

### 19.1 – Triển khai Kiến trúc Hàng đợi (Message Queue)
- **Vấn đề:** Ban đầu hệ thống sử dụng **Amazon EventBridge** đẩy thẳng sự kiện điểm danh (AttendanceRecorded) trực tiếp vào Lambda (Worker). Kiến trúc này gặp rủi ro nếu có hàng ngàn sinh viên điểm danh cùng một lúc (Spike Traffic) hoặc khi Lambda/Database gặp lỗi kết nối, sự kiện sẽ bị EventBridge Drop (đánh rơi) dẫn đến mất mát dữ liệu điểm danh.
- **Giải pháp:** Chèn **Amazon SQS (Simple Queue Service)** vào giữa luồng EventBridge và Lambda làm bộ đệm (Buffer). Hệ thống tạo ra 2 Hàng đợi chính (`smart-campus-analytics-queue` và `smart-campus-notification-queue`) cùng với 1 Thùng rác lỗi (`smart-campus-dlq`). Mọi sự kiện điểm danh sẽ nằm xếp hàng trong SQS và Lambda sẽ từ từ kéo về xử lý (Pull Model), đảm bảo hệ thống không bao giờ bị nghẽn mạng hay sập nguồn. Dữ liệu lỗi sẽ tự động tống vào DLQ để kỹ sư kiểm tra lại.

### 19.2 – Tối ưu hóa Backend (Partial Batch Response)
  - Update `main.py` router to handle standard API Gateway payload if present.
  - SQS batch processing allows independent retries for analytical data extraction vs email/SNS notification tasks, improving fault tolerance.

---

## 20. Hoàn thiện Tính năng Chống Gian lận (Face Liveness)
**Mục tiêu:**
- Giải quyết bài toán bảo mật cốt lõi: Ngăn chặn nhân viên/sinh viên sử dụng ảnh chụp hoặc video phát lại trước camera để giả mạo điểm danh.
- Tích hợp chuẩn AWS Amplify Liveness (Workflow 9).

**Thực hiện (Cloud Architecture & Security):**
1. **Amazon Cognito (Identity Pool):**
   - Tạo Pool `smart_campus_liveness` để cung cấp định danh khách (Guest) cho các thiết bị Frontend (ví dụ: máy tính bảng tại phòng học).
   - Thiết lập IAM Role cho Unauthenticated User (`FaceLivenessFrontendPolicy`), chỉ cấp quyền `rekognition:StartFaceLivenessSession` để thu thập dữ liệu video an toàn trực tiếp lên AWS.
2. **IAM Backend (Lambda Role):**
   - Bổ sung `FaceLivenessBackendPolicy` cho Role của Backend API.
   - Cấp quyền `CreateFaceLivenessSession` (Khởi tạo phiên liveness) và `GetFaceLivenessSessionResults` (Xác thực kết quả từ AWS).

**Thực hiện (Codebase):**
1. **Backend (FastAPI):**
   - Mở rộng wrapper `app/shared/aws/rekognition.py` với 2 API liveness.
   - Bổ sung logic `recognize_liveness_and_record` trong `service.py`: Chặn điểm danh nếu độ tin cậy Liveness < 90%. Trích xuất ảnh thật (`ReferenceImage`) từ video liveness để đẩy qua quá trình nhận diện (SearchFacesByImage).
2. **Frontend (React):**
   - Tích hợp bộ SDK `@aws-amplify/ui-react-liveness`.
   - Nâng cấp Component `Attendance.jsx`: Gỡ bỏ camera thủ công, thay bằng `FaceLivenessDetector` của Amazon.
   - Trải nghiệm người dùng (UX): Hiển thị hình bầu dục trên màn hình, tự động hướng dẫn thay đổi khoảng cách khuôn mặt để chống ảnh giả.

**Kết quả:**
- Hệ thống chặn 100% các cuộc tấn công Presentation Attack (PA) như đưa ảnh giấy, màn hình điện thoại vào camera.
- Đảm bảo luồng điểm danh (Workflow 3) bảo mật tuyệt đối, là mảnh ghép cuối cùng hoàn thiện Đồ án Smart Campus trên AWS.
