# 🎓 Nền tảng Smart Campus (Smart Campus Platform)

Chào mừng bạn đến với kho lưu trữ mã nguồn của **Smart Campus Platform**! Đây là một giải pháp phần mềm toàn diện (End-to-End) được thiết kế nhằm số hóa và hiện đại hóa quy trình quản lý văn phòng và điểm danh cho doanh nghiệp. 

Hệ thống được xây dựng hoàn toàn trên đám mây với kiến trúc **100% Serverless trên AWS**, đảm bảo khả năng mở rộng linh hoạt, độ tin cậy cao và tối ưu chi phí vận hành đến mức tối đa.

---

## 🚀 Tổng quan dự án

**Smart Campus** giải quyết triệt để các bài toán nhức nhối trong quản lý truyền thống như: gian lận điểm danh, dữ liệu nhân sự phân mảnh, chi phí duy trì máy chủ nội bộ (On-premises) đắt đỏ và thiếu hệ thống cảnh báo chủ động.

### Mục tiêu cốt lõi
- **Tự động hóa & Chính xác:** Ứng dụng công nghệ nhận diện khuôn mặt (AI) kết hợp với hàng rào IP (IP Whitelisting) để chống gian lận.
- **Tối ưu chi phí 100%:** Áp dụng mô hình Pure Serverless (Pay-As-You-Go), doanh nghiệp chỉ trả tiền khi hệ thống thực sự xử lý giao dịch. Chi phí bằng $0 khi không có người sử dụng.
- **Vận hành hướng sự kiện (Event-Driven):** Tách rời các dịch vụ để tự động hóa luồng thông báo đa kênh (Push, SMS, Email) và xử lý ngầm (background jobs) mà không làm chậm trải nghiệm người dùng.
- **Tập trung hóa dữ liệu:** Tích hợp đường ống dữ liệu Analytics Data Lake để thu thập log và phục vụ trích xuất báo cáo thời gian thực.

---

## 🏗 Các luồng nghiệp vụ chính

Hệ thống ứng dụng kiến trúc **Event-Driven** và sử dụng hơn 15 dịch vụ đám mây bản địa (native services) của AWS. 

Dưới đây là 6 luồng nghiệp vụ cốt lõi:
1. **Quản lý Tài khoản & Phân quyền (Auth & RBAC):** Sử dụng **Amazon Cognito** để quản lý người dùng và cấp phát JWT token. Giao diện Frontend được phân phối tốc độ cao qua **S3 & CloudFront**.
2. **Đăng ký Khuôn mặt (Face Registration):** Trích xuất và lưu trữ đặc trưng sinh trắc học thông qua sức mạnh AI của **Amazon Rekognition**.
3. **Điểm danh Thông minh (Smart Attendance):** Nhận diện khuôn mặt theo thời gian thực. API được bảo vệ bởi tường lửa **AWS WAF** (chặn IP lạ), và được xử lý bởi **API Gateway + AWS Lambda + DynamoDB**.
4. **Quản lý Công việc & Sự cố (Task & Incident Management):** Giao việc và theo dõi tiến độ với cơ sở dữ liệu **DynamoDB**. Sử dụng **EventBridge Cronjobs** để tự động rà soát và cảnh báo công việc trễ hạn.
5. **Xin Nghỉ phép & Thông báo (Leave & Notifications):** Xử lý đơn từ tự động và đẩy thông báo đa kênh tới cấp quản lý thông qua **SQS, SNS, và SES**.
6. **Phân tích Dữ liệu Lớn (Data Lake Analytics):** Gom nhóm và lưu trữ log điểm danh quy mô lớn trên S3, phân loại cấu trúc tự động bằng **AWS Glue** và truy vấn siêu tốc qua **Amazon Athena**.

---

## 🛠 Công nghệ & Dịch vụ AWS sử dụng

- **Frontend:** ReactJS / Vite (Lưu trữ trên Amazon S3 + CloudFront)
- **Backend:** FastAPI (Python) chạy trên môi trường AWS Lambda
- **Cơ sở dữ liệu:** Amazon DynamoDB (OLTP)
- **Data Lake (Phân tích):** Amazon S3 + AWS Glue + Amazon Athena (OLAP)
- **Trí tuệ nhân tạo (AI/ML):** Amazon Rekognition
- **Bảo mật:** AWS WAF, Amazon Cognito, IAM (Nguyên tắc Đặc quyền tối thiểu)
- **Hàng đợi & Sự kiện:** Amazon EventBridge, Amazon SQS, Amazon SNS, Amazon SES
- **CI/CD:** AWS CodeBuild & AWS CodePipeline

---

## 📁 Cấu trúc mã nguồn (Repository)

```text
smart-campus/
├── backend/                  # Mã nguồn Backend (FastAPI & Lambda Handlers)
├── frontend/                 # Mã nguồn Frontend (ReactJS/Vite)
├── infrastructure/           # Infrastructure as Code (Templates triển khai hạ tầng)
├── docs/                     # Các tài liệu mô tả kiến trúc và nhật ký phát triển
├── buildspec-backend.yml     # Kịch bản CI/CD CodeBuild cho Backend
└── buildspec-frontend.yml    # Kịch bản CI/CD CodeBuild cho Frontend
```

---

