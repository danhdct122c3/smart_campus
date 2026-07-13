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
