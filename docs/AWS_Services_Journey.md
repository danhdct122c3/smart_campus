# Báo cáo Hành trình lên Cloud: Chi tiết các dịch vụ AWS sử dụng trong Smart Campus

Tài liệu này tổng hợp toàn bộ các dịch vụ AWS đã được sử dụng (dựa trên source code thực tế của dự án) và ứng dụng cụ thể của chúng trong từng tính năng của hệ thống Smart Campus. Đây là nguồn tài liệu quý giá để bổ sung vào báo cáo **First Cloud AWS Journey**.

---

## 1. Nhóm Dịch vụ Tính toán (Compute & API)

### 1.1. AWS Lambda
- **Vai trò:** Trái tim xử lý logic của toàn bộ hệ thống (Serverless Compute).
- **Ứng dụng thực tế trong code:**
  - Chạy backend **FastAPI (Python 3.12)** thông qua thư viện trung gian `Mangum` (khai báo trong `app/main.py`).
  - Chạy các Background Workers xử lý bất đồng bộ: `analytics_worker` và `notification_worker` (nhận trigger từ SQS).
  - Chạy Cronjob định kỳ (`check_and_notify_task_deadlines`) được trigger từ EventBridge để dò tìm các Task bị quá hạn.

### 1.2. Amazon API Gateway
- **Vai trò:** Cửa ngõ kết nối Internet (HTTP API) cho Backend.
- **Ứng dụng thực tế trong code:** Đứng trước AWS Lambda, tiếp nhận các HTTP Request từ Frontend React (React -> API Gateway -> Lambda FastAPI).

---

## 2. Nhóm Dịch vụ Lưu trữ & Cơ sở Dữ liệu (Storage & Database)

### 2.1. Amazon DynamoDB
- **Vai trò:** Cơ sở dữ liệu chính (OLTP NoSQL Database).
- **Ứng dụng thực tế trong code:**
  - Khai báo tại `app/shared/aws/dynamodb.py`.
  - Quản lý 8 bảng cốt lõi của hệ thống: `users`, `faces`, `attendance`, `tasks`, `leaves`, `notifications`, `security`, `holidays`.
  - Sử dụng mạnh mẽ **Global Secondary Index (GSI)** để truy vấn siêu tốc (ví dụ: lấy danh sách task theo `assigneeId` hoặc lấy log điểm danh theo `date`).

### 2.2. Amazon S3 (Simple Storage Service)
- **Vai trò:** Lưu trữ Object Storage đa mục đích.
- **Ứng dụng thực tế trong code:**
  - Lệnh gọi boto3 tại `app/shared/aws/s3.py`.
  - **Hosting tĩnh:** Host bộ code Frontend ReactJS sau khi build (thư mục `dist`).
  - **Lưu trữ File & Hình ảnh:** Lưu ảnh chụp sinh viên/nhân viên lúc điểm danh, tài liệu đính kèm (PDF, Doc) của tính năng Tasks. (Sử dụng *Pre-signed URL* để bảo mật file tải xuống).
  - **Làm Data Lake:** Lưu trữ dữ liệu log điểm danh dạng JSON để phục vụ cho Analytics (Truy vấn qua Athena).

---

## 3. Nhóm Dịch vụ Bảo mật & Phân quyền (Security & Identity)

### 3.1. Amazon Cognito
- **Vai trò:** Quản lý tài khoản (Identity Provider) và Cấp phát JWT.
- **Ứng dụng thực tế trong code:**
  - Lệnh gọi `boto3.client('cognito-idp')` tại `app/modules/auth/service.py` và `users/service.py`.
  - Đảm nhận toàn bộ nghiệp vụ Authentication: Sinh mật khẩu ngẫu nhiên khi Admin tạo tài khoản, bắt buộc đổi mật khẩu ở lần đăng nhập đầu tiên (Force Change Password), cấp phát và xác thực JWT token cho API.

### 3.2. AWS WAF (Web Application Firewall)
- **Vai trò:** Tường lửa bảo vệ Frontend/API.
- **Ứng dụng thực tế trong code:**
  - Lệnh gọi `boto3.client("wafv2", region_name="us-east-1")` tại `app/modules/security/service.py`.
  - Ứng dụng để **Whitelist IP (IP Set)** chặn việc điểm danh (check-in/check-out) ngoài khu vực cho phép. Admin có thể cập nhật IP mạng của công ty (`SmartCampusIPSet`) vào WAF ngay từ giao diện. WAF này được gắn thẳng vào CloudFront (`Scope="CLOUDFRONT"`).

---

## 4. Nhóm Dịch vụ Giao tiếp & Sự kiện (Messaging & Integration)

### 4.1. Amazon EventBridge
- **Vai trò:** Xe buýt sự kiện trung tâm (Event Bus).
- **Ứng dụng thực tế trong code:**
  - Lệnh gọi `boto3.client("events")` tại `app/shared/aws/eventbridge.py`.
  - Điều phối kiến trúc Event-driven: Khi có sự kiện xảy ra (ví dụ điểm danh thành công `AttendanceRecorded`), Backend đẩy event lên EventBridge. EventBridge sau đó tự động phân luồng (Routing) kích hoạt các quy trình khác mà không cần gọi hàm trực tiếp.

### 4.2. Amazon SQS (Simple Queue Service)
- **Vai trò:** Hàng đợi thông điệp (Message Queue) và chống mất dữ liệu.
- **Ứng dụng thực tế trong code:**
  - EventBridge không trực tiếp gọi Worker mà đẩy sự kiện vào SQS (`analytics-queue`, `notification-queue`).
  - Lambda (Worker) lấy batch từ SQS về xử lý (`main.py` -> `handler` kiểm tra `eventSource == "aws:sqs"`).
  - Tích hợp **Dead Letter Queue (DLQ)** để hứng các message xử lý lỗi quá số lần quy định.

### 4.3. Amazon SNS (Simple Notification Service)
- **Vai trò:** Hệ thống phát thông báo (Pub/Sub).
- **Ứng dụng thực tế trong code:**
  - Lệnh gọi `boto3.client("sns")` tại `app/shared/aws/sns.py`.
  - Dùng để gửi tin nhắn khẩn cấp (Push Notification, SMS) báo động khi phát hiện xâm nhập (Security Alert) hoặc có Task khẩn cấp.

### 4.4. Amazon SES (Simple Email Service)
- **Vai trò:** Dịch vụ gửi Email giao dịch.
- **Ứng dụng thực tế trong code:**
  - Lệnh gọi `boto3.client("ses")` tại `app/shared/aws/ses.py`.
  - Gửi mã xác thực tài khoản, gửi email welcome chứa thông tin đăng nhập, email nhắc nhở deadline công việc.

---

## 5. Nhóm Dịch vụ AI & Machine Learning

### 5.1. Amazon Rekognition
- **Vai trò:** Trí tuệ nhân tạo nhận diện hình ảnh/khuôn mặt.
- **Ứng dụng thực tế trong code:**
  - Lệnh gọi `boto3.client("rekognition")` tại `app/shared/aws/rekognition.py`.
  - Cung cấp API `IndexFaces` khi người dùng đăng ký khuôn mặt vào bộ sưu tập (Collection).
  - Cung cấp API `SearchFacesByImage` khi người dùng quét khuôn mặt điểm danh, tự động đối chiếu và trả về UUID kèm mức độ chính xác (Confidence).


---

## 6. Nhóm Dịch vụ Dữ liệu lớn & Phân tích (Analytics & Data Lake)

### 6.1. Amazon Kinesis Data Firehose
- **Vai trò:** Ống dẫn dữ liệu tốc độ cao vào Data Lake.
- **Ứng dụng thực tế trong code:**
  - Lệnh gọi `boto3.client("firehose")` tại `app/workers/analytics_worker.py`.
  - Nhận hàng nghìn sự kiện điểm danh từ EventBridge/SQS, gom nhóm lại (batching) và đẩy luồng (Stream) dữ liệu dạng JSON xuống S3 Data Lake (DeliveryStreamName=`smart-campus-attendance-stream`).

### 6.2. AWS Glue (Data Catalog & Crawler)
- **Vai trò:** Danh mục siêu dữ liệu (Metadata) và tự động thu thập Schema của S3 Data Lake.
- **Ứng dụng thực tế trong code:**
  - Mặc dù Backend không trực tiếp gọi API Glue qua `boto3` (vì Glue hoạt động ngầm ở tầng hạ tầng), nhưng code tại `analytics_worker.py` đã chủ đích chia năm/tháng/ngày (Partitioning fields) để định dạng cấu trúc cho **Glue Crawler** đọc.
  - Glue Data Catalog là thành phần bắt buộc lưu trữ Schema để Athena có thể truy vấn được các file JSON trên S3 bằng ngôn ngữ SQL.

### 6.3. Amazon Athena
- **Vai trò:** Máy chủ truy vấn SQL tương tác trực tiếp trên S3 thông qua Data Catalog của Glue.
- **Ứng dụng thực tế trong code:**
  - Lệnh gọi `boto3.client("athena")` tại `app/shared/aws/athena.py`.
  - Chạy các câu truy vấn phân tích (OLAP) quy mô lớn để sinh Báo cáo phòng ban (WF5) hoặc phục vụ cho Trợ lý AI (WF6) lấy dữ liệu trả lời người dùng. Truy vấn không làm ảnh hưởng đến hiệu năng của DynamoDB (OLTP).

---

## 7. Nhóm Dịch vụ Giám sát & Mạng (Observability & Networking)

### 7.1. AWS X-Ray
- **Vai trò:** Chụp X-Quang theo vết (Distributed Tracing).
- **Ứng dụng thực tế trong code:**
  - Thư viện `aws_xray_sdk` được cài đặt và kích hoạt (`patch_all()`) ngay tại `app/main.py`.
  - Giúp theo dõi thời gian phản hồi của từng component: Từ khi API Gateway nhận Request -> Lambda xử lý -> Xuống DynamoDB mất bao nhiêu mili-giây, hoặc nghẽn ở bước gọi Rekognition hay không.

### 7.2. Amazon CloudFront
- **Vai trò:** Content Delivery Network (CDN).
- **Ứng dụng thực tế trong code:** Đóng vai trò làm HTTPS endpoint và Cache nội dung tĩnh cho Frontend (React/Vite). Đây cũng là nơi gắn mỏ neo (Scope) cho hệ thống Firewall AWS WAF chặn IP.

---

## 8. Nhóm Dịch vụ Phát triển & Triển khai (CI/CD Pipeline)

### 8.1. AWS CodeBuild & AWS CodePipeline
- **Vai trò:** Hệ thống Tích hợp & Triển khai liên tục (CI/CD) hoàn toàn tự động.
- **Ứng dụng thực tế trong code:**
  - Dự án khai báo sẵn 2 file cấu hình ở thư mục gốc: `buildspec-backend.yml` và `buildspec-frontend.yml`.
  - **Backend Pipeline:** Tự động cài đặt thư viện Python 3.12 (manylinux2014) để tương thích với Lambda, zip toàn bộ thư mục `app` và sử dụng lệnh `aws lambda update-function-code` đẩy thẳng lên môi trường AWS.
  - **Frontend Pipeline:** Chạy npm build (Vite), dùng lệnh `aws s3 sync` đẩy thư mục `dist` lên S3 Bucket (`smart-campus-frontend-2026`) và gọi lệnh `aws cloudfront create-invalidation` xóa Cache cũ để người dùng cập nhật giao diện mới nhất ngay lập tức.
