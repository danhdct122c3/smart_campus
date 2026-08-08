---
title: "Bản đề xuất (Proposal)"
weight: 2
chapter: false
---

# Bản đề xuất (Project Proposal)

## 1. Tổng quan dự án (Project Overview)
**Smart Campus Platform** là một hệ thống phần mềm toàn diện nhằm hiện đại hóa và số hóa quy trình quản lý tại các khuôn viên trường học/công ty. Dự án chuyển đổi mô hình từ "Giám sát thụ động" sang "Vận hành tự động", bao gồm tự động hóa điểm danh bằng khuôn mặt (AI), quản lý công việc và nghỉ phép (Task & Leave Management), và trung tâm báo cáo dữ liệu lớn (Analytics Command Center). 

Đặc biệt, hệ thống được thiết kế **100% Serverless trên nền tảng AWS**, áp dụng kiến trúc Event-Driven Microservices để đảm bảo tính mở rộng cao, chi phí thấp và khả năng vận hành bền bỉ.

## 2. Vấn đề cần giải quyết (Problem Statement)
Hệ thống giải quyết các bài toán nhức nhối trong quản lý truyền thống:
- **Điểm danh thủ công & gian lận:** Việc sử dụng thẻ từ hay vân tay dễ bị lách luật, quên thẻ, hoặc chậm trễ vào giờ cao điểm.
- **Dữ liệu phân mảnh:** Dữ liệu nhân sự, công việc và điểm danh nằm rải rác, gây khó khăn cho Giám đốc/Quản lý khi muốn xem báo cáo toàn cảnh.
- **Chi phí vận hành Server cao:** Các hệ thống nội bộ thường không có người dùng 24/7 (buổi tối và cuối tuần thường trống) nhưng doanh nghiệp vẫn phải trả tiền duy trì máy chủ vật lý.
- **Thiếu cảnh báo chủ động:** Quản lý không được thông báo kịp thời khi nhân viên đi trễ, nghỉ phép hay công việc bị quá hạn.

## 3. Mục tiêu (Objectives)
- **Tự động hóa & Chính xác:** Ứng dụng AI nhận diện khuôn mặt kết hợp hàng rào IP (IP Whitelisting) để điểm danh nhanh chóng, chính xác tuyệt đối và chống gian lận.
- **Tập trung hóa dữ liệu (Data Lake):** Xây dựng một đường ống dữ liệu (Analytics Pipeline) thu thập hàng ngàn luồng sự kiện để phục vụ phân tích báo cáo thời gian thực.
- **Tối ưu chi phí 100%:** Ứng dụng triệt để kiến trúc Serverless (trả tiền theo mỗi lần gọi API), đảm bảo chi phí bằng 0 khi không có người sử dụng.
- **Bảo mật theo tiêu chuẩn đám mây:** Phân quyền chặt chẽ (RBAC) và bảo vệ dữ liệu nhạy cảm bằng hệ thống Firewall và Token.

## 4. Các luồng nghiệp vụ và Kiến trúc giải pháp (Workflows & Solution Architecture)

> **[SƠ ĐỒ KIẾN TRÚC TỔNG THỂ]**
> <!-- TODO: Khi vẽ xong sơ đồ kiến trúc, hãy chèn ảnh vào đây bằng cú pháp: ![Sơ đồ kiến trúc](/images/architecture.png) -->

Hệ thống được thiết kế dựa trên kiến trúc **Event-Driven Microservices** và ứng dụng hơn 15 dịch vụ đám mây của AWS. Dưới đây là chi tiết 6 luồng nghiệp vụ cốt lõi và cách các dịch vụ AWS phối hợp giải quyết bài toán:

### 4.1. Luồng Xác thực & Phân quyền (Auth & Users Workflow)
- **Nghiệp vụ:** Quản lý vòng đời tài khoản người dùng, phân quyền Role-Based Access Control (RBAC) cho Admin, Manager, Staff. Bắt buộc người dùng mới phải đổi mật khẩu ở lần đăng nhập đầu tiên.
- **Dịch vụ AWS:** Sử dụng **Amazon Cognito** làm Identity Provider để cấp phát và xác thực JWT Token. Giao diện Frontend React/Vite được lưu trữ trên **Amazon S3** và phân phối qua **Amazon CloudFront**.

### 4.2. Luồng Đăng ký Khuôn mặt (Face Registration Workflow)
- **Nghiệp vụ:** Chống gian lận bằng cách mỗi nhân viên chỉ được phép đăng ký duy nhất 1 khuôn mặt chính chủ vào hệ thống.
- **Dịch vụ AWS:** Gọi API `IndexFaces` của **Amazon Rekognition** để trích xuất đặc trưng sinh trắc học và lưu FaceID. Hình ảnh gốc định dạng JPEG/PNG được bảo mật tuyệt đối trong **Amazon S3 Private Bucket**.

### 4.3. Luồng Điểm danh Thông minh (Smart Attendance Workflow)
- **Nghiệp vụ:** Quá trình check-in/check-out được thực hiện bằng cách đưa khuôn mặt qua camera. Hệ thống tự động so khớp, kiểm tra khung giờ hợp lệ, và đối chiếu xem nhân viên có đang sử dụng đúng IP của văn phòng hay không (chống fake GPS/VPN).
- **Dịch vụ AWS:** 
  - **AWS WAF (Web Application Firewall):** Chặn các request điểm danh đến từ ngoài mạng công ty (IP Whitelisting).
  - **Amazon Rekognition:** Gọi hàm `SearchFacesByImage` để đối chiếu độ trùng khớp (Confidence > 95%).
  - **Amazon API Gateway & AWS Lambda:** API Gateway tiếp nhận request từ Frontend, chuyển cho Lambda (chạy FastAPI) xử lý logic và lưu trạng thái vào **Amazon DynamoDB**.

### 4.4. Luồng Xử lý Sự kiện & Thông báo (Event-driven Notifications)
- **Nghiệp vụ:** Khi một nhân viên điểm danh thành công hoặc bị giao việc mới, hệ thống tự động đẩy thông báo đa kênh cho người liên quan mà không làm chậm trải nghiệm của người dùng.
- **Dịch vụ AWS:** 
  - **Amazon EventBridge:** Nhận sự kiện (ví dụ `AttendanceRecorded`) và phân luồng (Routing).
  - **Amazon SQS:** Làm hàng đợi hứng sự kiện từ EventBridge, gửi cho Lambda Background Worker.
  - **Amazon SNS & Amazon SES:** Gửi Push Notification, SMS (SNS) và Email (SES) tới cấp quản lý.

### 4.5. Luồng Quản lý Công việc (Task Management Workflow)
- **Nghiệp vụ:** Phân công công việc (Task) với thời hạn nghiêm ngặt (Deadline) và xử lý quy trình xin nghỉ phép (Leave Request). Quản lý có thể đính kèm tài liệu mật vào task.
- **Dịch vụ AWS:**
  - **Amazon DynamoDB:** Lưu cấu trúc dữ liệu Tasks và Leaves với các Global Secondary Index (GSI) để truy vấn nhanh.
  - **Amazon S3 Pre-signed URL:** Sinh link động có thời hạn để tải tài liệu mật đính kèm, ngăn chặn rò rỉ dữ liệu.
  - **Amazon EventBridge (Cronjob):** Chạy lịch trình định kỳ mỗi 30 phút để quét và cảnh báo các Task quá hạn.

### 4.6. Luồng Phân tích Dữ liệu lớn (Data Lake Analytics Workflow)
- **Nghiệp vụ:** Thu thập log điểm danh khổng lồ từ các khuôn viên, gom nhóm dữ liệu để Giám đốc có thể xem Báo cáo hiệu suất (Dashboard) so sánh giữa các phòng ban.
- **Dịch vụ AWS:**
  - **Amazon Kinesis Data Firehose:** Nhận stream log điểm danh, tự động chia folder theo ngày tháng (Dynamic Partitioning) và lưu thành file lớn xuống **S3 Data Lake**.
  - **AWS Glue (Data Catalog):** Tự động thu thập cấu trúc (Schema) của các file JSON trên S3.
  - **Amazon Athena:** Động cơ truy vấn SQL Serverless, đọc trực tiếp dữ liệu từ S3 qua Glue Catalog để trả về kết quả thống kê siêu tốc cho Frontend.


### 4.7. Bảng Liệt Kê Các Dịch Vụ AWS Cốt Lõi
Dưới đây là bảng tổng hợp các dịch vụ AWS được ứng dụng trong sơ đồ kiến trúc:

| STT | DỊCH VỤ AWS | VAI TRÒ & NHIỆM VỤ TRONG SMART CAMPUS | LÝ DO LỰA CHỌN & LỢI ÍCH KỸ THUẬT |
| :---: | :--- | :--- | :--- |
| 1 | **Amazon CloudFront** | Phân phối ứng dụng React Frontend từ S3 Bucket đến người dùng. Đóng vai trò mỏ neo cho AWS WAF. | Tăng tốc tải trang bằng caching ở các Edge Locations. Hỗ trợ HTTPS tự động, giảm tải băng thông. |
| 2 | **AWS WAF** | Tường lửa bảo vệ điểm danh, chặn các IP không thuộc văn phòng. | Ngăn chặn gian lận điểm danh từ xa, chống các đợt tấn công Web và Spam request. |
| 3 | **Amazon S3** | **Bucket 1:** Lưu trữ Frontend. <br> **Bucket 2:** Lưu trữ ảnh khuôn mặt & tài liệu bảo mật. <br> **Bucket 3:** S3 Data Lake lưu log. | Chi phí lưu trữ rẻ, độ tin cậy 99.999999999%. Hỗ trợ S3 Presigned URL ẩn file bảo mật. Tích hợp tốt với Athena. |
| 4 | **Amazon API Gateway** | Cổng giao tiếp RESTful/HTTP API tiếp nhận request từ Frontend và gọi AWS Lambda. | Hỗ trợ Rate Limiting, tích hợp sẵn xác thực JWT qua Cognito Authorizer mà không cần code. |
| 5 | **AWS Lambda** | **API Handler:** Xử lý logic API. <br> **Workers:** Xử lý Event chạy nền. | Mô hình Serverless Pay-As-You-Go (chỉ trả tiền khi code chạy). Tự động scale tức thì, không quản lý server. |
| 6 | **Amazon DynamoDB** | Lưu trữ toàn bộ dữ liệu nghiệp vụ (Users, Tasks, Leaves, Attendance). | Database NoSQL Serverless, tốc độ phản hồi tính bằng mili-giây, linh hoạt với Global Secondary Index. |
| 7 | **Amazon Cognito** | Quản lý User Pool, xác thực đăng nhập và cấp phát JWT Token. | Không phải tự build hệ thống Auth. Bảo mật cao, hỗ trợ bắt buộc đổi mật khẩu lần đầu đăng nhập. |
| 8 | **Amazon EventBridge** | Event Bus định tuyến các sự kiện (ví dụ: `AttendanceRecorded`) và chạy Cronjob. | Tách rời các module (Decoupling) theo chuẩn Event-Driven, dễ dàng thêm nghiệp vụ mới. |
| 9 | **Amazon SQS** | Hàng đợi tin nhắn (Queue) đứng trước các Worker. | Đảm bảo không mất dữ liệu khi có lỗi xảy ra. Tích hợp Dead Letter Queue (DLQ) để retry. |
| 10 | **Amazon Rekognition** | So khớp khuôn mặt nhân viên qua camera khi check-in. | AI có sẵn siêu mạnh, không tốn thời gian train model. Độ chính xác cao (Confidence > 95%). |
| 11 | **Amazon Kinesis Data Firehose, Glue & Athena** | Bộ ba pipeline gom log điểm danh trên S3, phân tích và truy vấn bằng SQL. | Batching file tự động để tiết kiệm phí S3/Athena. Tách bạch hệ thống OLTP và OLAP. |
| 12 | **AWS CodeBuild & CodePipeline** | Thiết lập CI/CD Pipeline tự động build Frontend và đóng gói Lambda Backend. | Triển khai liên tục (Continuous Deployment) một cách hoàn toàn tự động từ source code. Đảm bảo an toàn và nhất quán giữa các lần release. |

### 4.8. Đánh giá Kiến trúc theo 5 Trụ cột AWS Well-Architected Framework
Toàn bộ kiến trúc của Smart Campus Platform được thiết kế tuân thủ nghiêm ngặt 5 trụ cột (Pillars) của AWS Well-Architected Framework:

1. **Operational Excellence (Vận hành xuất sắc):** Quản lý toàn bộ vòng đời ứng dụng tự động bằng kịch bản CI/CD (CodeBuild/CodePipeline). Giám sát tập trung log và các luồng sự kiện (event metrics) qua Amazon CloudWatch để phát hiện sớm điểm nghẽn.
2. **Security (Bảo mật):** Thực thi nguyên tắc Đặc quyền tối thiểu (Least Privilege) qua các IAM Roles cụ thể cho từng hàm Lambda. Ẩn tài liệu đính kèm nhạy cảm bằng S3 Pre-signed URL, mã hóa kết nối bằng HTTPS/TLS của CloudFront, và bảo vệ cổng API bằng AWS WAF kết hợp Cognito JWT Authorizer.
3. **Reliability (Độ tin cậy):** Đảm bảo tính khả dụng (High Availability) liên tục nhờ kiến trúc Multi-AZ mặc định của hệ sinh thái Serverless. Cơ chế Retry tự động và đẩy tin nhắn lỗi vào Dead-Letter Queue (DLQ) của Amazon SQS giúp ngăn ngừa mất mát log điểm danh.
4. **Performance Efficiency (Hiệu năng):** Phân phối ứng dụng Frontend tĩnh mượt mà qua các Edge locations của CloudFront. Tối ưu thời gian đọc/ghi dữ liệu ở mức mili-giây với DynamoDB, đồng thời giải tải cho hệ thống OLTP chính bằng cách đẩy dữ liệu truy vấn lớn sang luồng Data Lake (Firehose & Athena).
5. **Cost Optimization (Tối ưu chi phí):** Áp dụng triệt để mô hình 100% Serverless Event-Driven (chỉ trả tiền khi hệ thống được gọi). Thiết lập S3 Lifecycle Rules để tự động hạ tầng lưu trữ (chuyển log cũ sang Glacier), tối thiểu hóa chi phí lưu trữ lạnh.

## 5. Timeline dự kiến
| Tuần | Hạng mục công việc |
| :--- | :--- |
| **Tuần 1-2** | Phân tích yêu cầu, thiết kế kiến trúc hệ thống, vẽ sơ đồ UML và Architecture. Thiết lập tài nguyên mạng AWS, CloudFront, WAF, S3 tĩnh. |
| **Tuần 3-5** | Xây dựng Backend API (FastAPI) trên AWS Lambda và DynamoDB. Tích hợp Cognito và Rekognition cho tính năng điểm danh bằng khuôn mặt. |
| **Tuần 6-8** | Thiết kế Event-Driven Architecture với EventBridge và SQS. Hoàn thiện luồng Gửi thông báo (SNS/SES). |
| **Tuần 9-10**| Xây dựng Data Lake Pipeline (Firehose -> S3 -> Glue -> Athena) phục vụ Báo cáo Analytics. Xây dựng Frontend ReactJS kết nối API. |
| **Tuần 11-12**| Tích hợp CI/CD (CodeBuild, CodePipeline), Automation Testing, tối ưu hiệu năng (X-Ray), tổng kết và viết báo cáo. |

## 6. Ước Tính Ngân Sách Hàng Tháng (Monthly Budget Estimation)
Dự toán ngân sách được tính dựa trên quy mô vận hành thực tế tại 1 khuôn viên vừa: **200 nhân viên, mỗi người điểm danh trung bình từ 1 đến 4 lượt/ngày** (sáng đến, trưa đi ăn, chiều quay lại, tối về). Tổng cộng hệ thống sẽ xử lý khoảng **20.000 lượt điểm danh/tháng** và khoảng **150.000 API requests/tháng** (bao gồm cả giao việc, báo cáo, nghỉ phép).

Để chứng minh tính tối ưu của Serverless, dự toán dưới đây được tính **dựa trên đơn giá gốc (Pay-As-You-Go)** mà không phụ thuộc vào gói Free Tier 12 tháng của AWS.

| DỊCH VỤ AWS | MỨC ĐỘ SỬ DỤNG DỰ KIẾN / THÁNG | ĐƠN GIÁ THAM KHẢO (AP-SOUTHEAST-1) | CHI PHÍ HÀNG THÁNG (USD) |
| :--- | :--- | :--- | :---: |
| **AWS Lambda** | 150,000 API Requests + 40,000 Worker executions (Memory: 512MB, Avg: 1s) | $0.20 / 1M Requests + Compute time | **$1.62** |
| **Amazon API Gateway** | 150,000 HTTP API calls | $1.00 / 1M Requests | **$0.15** |
| **Amazon SQS** | 50,000 SQS Requests (Send & Receive) | $0.40 / 1M Requests | **$0.02** |
| **Amazon DynamoDB** | 500,000 WCU, 500,000 RCU (On-Demand Mode) + 2GB Storage | $1.25 / 1M WCU, $0.25 / 1M RCU + $0.25/GB | **$1.26** |
| **Amazon S3** | ~5GB Storage (Frontend, Hình ảnh, Data Lake) + 100k GET/PUT | $0.025 / GB Storage + $0.004 / 1k PUT | **$0.53** |
| **Amazon CloudFront** | 20GB Data Transfer Out + 200k HTTPS Requests | $0.09 / GB | **$1.80** |
| **AWS WAF** | 1 Web ACL + 1 Rule (IP Match) + 150k Requests | $5.00/Web ACL + $1.00/Rule + $0.60/1M Req | **$6.09** |
| **Amazon Cognito** | Dưới 1,000 MAU (Monthly Active Users) | Miễn phí (Dưới 50,000 MAU vĩnh viễn) | **$0.00** |
| **Amazon Rekognition** | 20,000 lần quét ảnh đối chiếu khuôn mặt (SearchFacesByImage) | $0.001 / Ảnh quét | **$20.00** |
| **Amazon Firehose & Athena** | ~1GB Data Ingestion & Scanned by Athena query | $0.03/GB Ingestion + $5.00/TB Scanned | **$0.04** |
| **Amazon CloudWatch** | 1GB Ingestion Logs + 3 Custom Metrics | $0.57 / GB Logs | **$1.47** |
| **AWS CodeBuild & CodePipeline** | ~100 phút build (linux-small) + 1 Active Pipeline | $0.005 / phút + $1.00/Pipeline | **$1.50** |
| **TỔNG CỘNG** | **Chi phí vận hành mô hình Smart Campus (200 Users)** | | **~ $34.48 / tháng** |

### 6.1. Chiến Lược Tối Ưu Chi Phí
Mặc dù chi phí vận hành cơ bản đã rất thấp, hệ thống vẫn áp dụng thêm các chiến lược tối ưu chuyên sâu:
1. **Mô hình Pure Serverless Pay-As-You-Go:** Sử dụng AWS Lambda và **API Gateway HTTP API** (rẻ hơn 71% so với REST API) giúp hệ thống không tốn bất kỳ chi phí duy trì máy chủ nào trong khung giờ ban đêm hoặc cuối tuần.
2. **S3 Lifecycle Rules & Firehose Compression:** Cấu hình tự động nén log điểm danh thành định dạng Parquet qua Firehose và chuyển các log cũ hơn 90 ngày sang **S3 Glacier Flexible Retrieval** giúp giảm 85% chi phí lưu trữ dài hạn.
3. **Sử dụng SQS Long Polling:** Cấu hình `ReceiveMessageWaitTimeSeconds = 20` giúp giảm thiểu lượng request rỗng (Empty Receive Requests) tới SQS, tiết kiệm đáng kể chi phí gọi API.
4. **AWS Lambda Power Tuning:** Thực hiện dò tìm mức RAM tối ưu nhất để cân bằng giữa tốc độ phản hồi (Latency) và chi phí thực thi, đảm bảo Lambda không bị cấp dư thừa bộ nhớ gây lãng phí.

## 7. Đánh giá Rủi ro & Biện pháp giảm thiểu (Risks & Mitigations)

| STT | LOẠI RỦI RO | PHÂN TÍCH CHI TIẾT RỦI RO | MỨC ĐỘ | BIỆN PHÁP GIẢM THIỂU (MITIGATION STRATEGY) |
| :---: | :--- | :--- | :---: | :--- |
| 1 | **Hiệu Năng** (Performance) | **Nghẽn cổ chai API hoặc Cold Start Lambda:** Khi hàng trăm nhân viên ùa vào điểm danh cùng lúc lúc 8h00 sáng, độ trễ Lambda có thể tăng cao (Cold Start). | **HIGH** | - Thiết lập **Provisioned Concurrency** cho các hàm Lambda quan trọng vào khung giờ cao điểm.<br>- Sử dụng SQS làm vùng đệm (Buffer) để hấp thụ lượng traffic đột biến, xử lý bất đồng bộ. |
| 2 | **Bảo Mật** (Security) | **Tấn công Spam API / Gian lận:** Kẻ xấu liên tục gửi request rác làm cạn kiệt ngân sách AWS (Financial Exhaustion) hoặc dùng hình ảnh giả mạo. | **CRITICAL** | - Bật **AWS WAF** kết hợp Rate Limiting và chặn IP lạ.<br>- Yêu cầu xác thực JWT qua Cognito Authorizer trước khi xử lý.<br>- Phân quyền cực hạn (Least Privilege) cho từng Role Lambda. |
| 3 | **Vận Hành** (Operations) | **Mất mát dữ liệu (Data Loss):** Hệ thống đang xử lý điểm danh thì Lambda Worker bị timeout hoặc crash bất ngờ. | **MEDIUM** | - Cấu hình SQS `VisibilityTimeout` phù hợp.<br>- Bật **Dead-Letter Queue (DLQ)** để hứng các tin nhắn lỗi quá 3 lần, giúp kỹ sư kiểm tra lại mà không bị mất log điểm danh. |
| 4 | **Quản Lý Chi Phí** (Cost) | **Chi phí gia tăng đột biến (Spike Cost):** Lỗi vòng lặp vô tận trong code Lambda hoặc ghi log lỗi quá nhiều vào CloudWatch. | **MEDIUM** | - Thiết lập **AWS Budgets Alert** cảnh báo tự động qua Email/Slack khi chi phí vượt quá $40 USD/tháng.<br>- Cấu hình CloudWatch Log Retention tối đa 14 ngày thay vì để vĩnh viễn. |

## 8. Kết Quả Kỳ Vọng (Expected Outcomes)

Sau khi hoàn thành triển khai, hệ thống **Smart Campus** dự kiến đạt được các chỉ số kỹ thuật và mục tiêu kinh doanh sau:

**Chỉ Số Kỹ Thuật (Technical KPIs):**
- **Độ sẵn sàng (Availability SLA):** Đạt tối thiểu **99.9%** thời gian hoạt động ổn định nhờ hạ tầng Multi-AZ Serverless của AWS.
- **Thời gian phản hồi (API Latency):** **< 200ms** đối với các tác vụ đọc/ghi dữ liệu thông thường qua API Gateway & DynamoDB.
- **Thời gian nhận diện (AI Processing):** **< 2.0 giây** từ lúc gửi hình ảnh khuôn mặt đến khi nhận được kết quả điểm danh.
- **Khả năng chịu tải (Concurrent Capacity):** Xử lý mượt mà tối thiểu **500 request điểm danh đồng thời** mà không xảy ra hiện tượng drop request hay nghẽn hệ thống.

**Giá Trị Vận Hành & Kinh Doanh (Business Outcomes):**
- **Tối ưu chi phí:** Tiết kiệm hơn **80%** chi phí vận hành hạ tầng so với việc thuê máy chủ truyền thống (EC2/VPS), nhờ mô hình không dùng máy chủ (Pay-as-you-go).
- **Khả năng bảo trì cao:** Toàn bộ kiến trúc được module hóa thành các Microservices tách biệt (Event-Driven), giúp việc nâng cấp hay sửa lỗi một tính năng không làm gián đoạn toàn bộ hệ thống.
- **Trải nghiệm người dùng vượt trội:** Số hóa hoàn toàn thủ tục giấy tờ, cung cấp môi trường làm việc thông minh, hiện đại và minh bạch cho toàn bộ nhân sự.
