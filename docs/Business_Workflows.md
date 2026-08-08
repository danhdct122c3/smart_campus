# Báo Cáo Nghiệp Vụ - Smart Campus Platform

Tài liệu này ghi nhận lại toàn bộ các luồng nghiệp vụ kinh doanh (Business Workflows) hiện tại đang chạy trong hệ thống Smart Campus.

---

## 1. Nghiệp vụ Quản lý Nhân sự & Phân quyền (Users & Roles)
- **Tài khoản (Account):** Nhân sự được quản lý với thông tin chi tiết (Email, Tên, Mã nhân viên, Phòng ban, Vai trò).
- **Phòng ban (Department):** Gồm các phòng như `IT`, `TECHNICAL`, `SECURITY`, `HR`, `ADMIN`.
- **Vai trò (Roles - RBAC):** 
  - `ADMIN`: Quản trị viên tối cao, toàn quyền hệ thống.
  - `DIRECTOR`: Giám đốc. Có quyền xem toàn bộ báo cáo, quản lý nhân sự, cấu hình bảo mật mạng (WAF).
  - `MANAGER`: Quản lý bộ phận. Quản lý nhân sự và công việc trong phòng ban của mình.
  - `STAFF`: Nhân viên thường.
  - `TECHNICIAN`: Nhân viên kỹ thuật / bảo trì.
- **Bảo mật & Quản lý Tài khoản:** 
  - Sử dụng Cognito để quản lý JWT. 
  - **Chuẩn hóa Mã nhân viên:** Khi thêm mới nhân sự, hệ thống sẽ tự động sinh Mã nhân viên chuẩn hóa (VD: `ADMIN-1234`, `MAN-4561`) ngay trên giao diện dựa theo Vai trò (Role) được chọn.
  - **Cấp tài khoản tự động:** Khi Admin tạo tài khoản mới, hệ thống tự động sinh và gửi email chứa thông tin đăng nhập và mật khẩu tạm thời cho nhân viên.
  - **Xác thực Email (Amazon SES):** Người dùng bắt buộc phải đổi mật khẩu khi đăng nhập lần đầu. Ngay sau khi đổi mật khẩu thành công, hệ thống tự động kích hoạt gửi một email xác minh (Verify Email) qua Amazon SES.
  - **Khôi phục mật khẩu bằng Sinh trắc học:** Hỗ trợ tính năng đổi/khôi phục mật khẩu (Reset Password) hoàn toàn bằng khuôn mặt (FaceID) trực tiếp trên trình duyệt, không cần mã OTP rườm rà.
  - **Chống Đăng ký Khuôn mặt Trùng lặp:** Khi cập nhật khuôn mặt (Face Registration), hệ thống sử dụng AI đối chiếu với toàn bộ dữ liệu. Nếu phát hiện khuôn mặt đã đăng ký cho tài khoản khác, hệ thống sẽ từ chối ngay lập tức để chống gian lận (1 người tạo nhiều tài khoản hoặc đăng ký hộ).

## 2. Nghiệp vụ Chấm công & Điểm danh (Attendance)
- **Check-in / Check-out:** Hệ thống phân tách 2 loại điểm danh: `CHECK_IN` (bắt đầu ngày) và `CHECK_OUT` (kết thúc ngày).
- **Khung giờ quy định:** Khung giờ cho phép Check-in là `8h30-9h30`, Check-out là `17h30-18h30`. Ngoài khung giờ này, thao tác sẽ bị từ chối.
- **Trạng thái Điểm danh:** 
  - `PRESENT`: Đúng giờ.
  - `LATE`: Trễ giờ (cho Check-in).
  - `EARLY_LEAVE`: Về sớm (cho Check-out).
  - `ABSENT`: Vắng mặt.
- **Xác thực Sinh trắc học:** Sử dụng AWS Rekognition để nhận diện khuôn mặt.
- **Chính sách Mạng (WAF) & WFH:**
  - **Tại văn phòng:** Bắt buộc kết nối từ IP hợp lệ (WAF whitelist) để check-in/out.
  - **Làm việc từ xa (WFH):** Nhân sự có đơn WFH được duyệt có thể bỏ qua bước kiểm tra mạng (WAF) khi thao tác Check-out, tạo sự linh hoạt.
- **Ngày lễ (Holidays):** Tự động bỏ qua các quy tắc điểm danh khắt khe vào các ngày lễ được cấu hình trên hệ thống.

## 3. Nghiệp vụ Quản lý Công việc & Sự cố (Task Management)
- **Loại Công việc (Task Types):**
  - `GENERAL`: Công việc hành chính thông thường.
  - `INCIDENT`: Báo cáo sự cố hoặc yêu cầu hỗ trợ kỹ thuật (VD: hỏng mạng, máy lạnh hư).
- **Luồng Sự cố (Incident Workflow):**
  - Khi nhân sự báo cáo sự cố (INCIDENT), trường **Người thực hiện (Assignee)** sẽ được hệ thống để trống (Blank).
  - Quản lý bộ phận sau khi nhận thông báo sẽ thực hiện thao tác **Phân công** để giao việc cụ thể cho Kỹ thuật viên (`TECHNICIAN`) đi xử lý.
- **Vòng đời Công việc (Lifecycle):** `TODO` -> `IN_PROGRESS` -> `IN_REVIEW` (chờ nghiệm thu) -> `DONE` (Hoàn thành) hoặc `CANCELLED` (Hủy).
- **Công việc con (Subtasks):** Cho phép chia nhỏ công việc. Ràng buộc hệ thống quy định: Chỉ khi toàn bộ các công việc con (Subtasks) đã được hoàn thành hoặc nghiệm thu, thì Công việc cha (Parent Task) mới được phép gửi lên trên để xét duyệt.
- **Quản lý Tài liệu Đính kèm (File Management):**
  - Giao diện hỗ trợ kéo-thả (Drag & Drop) trực quan để đính kèm hình ảnh hiện trường, file PDF báo cáo, v.v.
  - **Tự động Kế thừa:** Khi chia nhỏ sự cố thành các công việc con, hệ thống tự động chép link tài liệu từ Công việc cha sang, giúp nhân viên cấp dưới nắm bắt đầy đủ bối cảnh mà không cần phải upload lại thủ công.
  - **Bảo mật File mức cao (S3 Pre-signed URL):** File được lưu hoàn toàn kín (Block Public Access) trên Amazon S3. Hệ thống chỉ tự động sinh mã khóa tạm thời (Pre-signed URL) khi người dùng có quyền truy cập vào xem công việc, chặn hoàn toàn nguy cơ rò rỉ tài liệu nội bộ ra ngoài mạng internet.
- **Cảnh báo hạn chót:** Hệ thống theo dõi `deadline` sát từng phút để tự động đánh dấu quá hạn (`OVERDUE`).

## 4. Nghiệp vụ Nghỉ phép (Leave Management)
- **Loại nghỉ phép:** `ANNUAL_LEAVE` (Phép năm), `SICK_LEAVE` (Ốm), `WFH` (Làm việc từ xa), `BUSINESS_TRIP` (Công tác).
- **Quy trình & Thông báo Tự động (Push/Email):**
  - **Tạo đơn:** Nhân sự nộp đơn trên hệ thống. Ngay lập tức, hệ thống tự động đẩy thông báo (Push Notification / Email) cho Quản lý trực tiếp để yêu cầu xét duyệt. (Hệ thống sẽ chủ động chặn chặn đơn nếu trùng lặp thời gian hoặc dính ngày lễ).
  - **Xét duyệt:** Khi Quản lý hoặc Giám đốc bấm Duyệt (`APPROVED`) hoặc Từ chối (`REJECTED`), hệ thống sẽ bắn thông báo Push/Email trả kết quả ngay về điện thoại/trình duyệt của nhân viên nộp đơn.
  - **Hủy đơn:** Nhân sự được phép tự hủy đơn nếu ngày nghỉ chưa bắt đầu.
- **Tích hợp Điểm danh:** Đơn WFH được duyệt sẽ tự động cấp quyền cho nhân sự Check-in / Check-out tại nhà mà không bị chặn bởi tường lửa mạng công ty.

## 5. Nghiệp vụ Thông báo & Cảnh báo (Notifications)
- **Kênh thông báo:** Tích hợp đa kênh qua SNS và gửi PUSH notifications trực tiếp trên ứng dụng.
- **Luồng gửi tự động:** 
  - Khi có Báo cáo sự cố mới, Quản lý được thông báo ngay lập tức.
  - Khi Task được giao, người thực hiện nhận thông báo.
  - Khi Task đổi trạng thái, hoàn thành hoặc gửi báo cáo, người liên quan đều nhận được tín hiệu tức thời.
- **Trải nghiệm UX:** Chuông báo thời gian thực trên thanh Header, thông báo thả xuống (Dropdown) và hệ thống danh sách thông báo tra cứu dễ dàng.

## 6. Phân tích & Báo cáo (Analytics)
- **Báo cáo Cá nhân hóa (RBAC Analytics):** Giao diện tự động thích ứng với từng phân quyền:
  - `DIRECTOR / ADMIN`: Xem biểu đồ thống kê chuyên cần, tình hình công việc toàn công ty. Có chức năng đánh giá hiệu suất chéo giữa các phòng ban (Department Comparison Matrix).
  - `MANAGER`: Bị khóa bộ lọc, chỉ được phép giám sát dữ liệu và biểu đồ trong phạm vi phòng ban của mình.
  - `STAFF / TECHNICIAN`: Giao diện tự động chuyển thành "Báo cáo cá nhân", chỉ hiển thị khối lượng công việc, KPI chuyên cần và lịch sử check-in của chính nhân sự đó.
- **Các Chỉ số Thống kê Cốt lõi (Dashboard):**
  - **Chuyên cần (Attendance):** KPI Tỉ lệ đi làm đúng giờ (Circular Ring), Biểu đồ xu hướng điểm danh theo ngày (Area Chart) phân biệt người đi làm / đi muộn, Danh sách Cảnh báo Top nhân sự vắng mặt nhiều nhất tích hợp thanh tiến trình động.
  - **Công việc (Tasks):** Thống kê tổng khối lượng công việc, biểu đồ tròn (Donut Chart) phân bổ trạng thái (Đang xử lý, Chờ duyệt, Quá hạn, Hoàn thành). 
- **Kiến trúc Dữ liệu (Data Pipeline):**
  - Hỗ trợ cơ chế Hybrid thông minh: Chạy truy vấn siêu tốc trực tiếp trên DynamoDB cho các báo cáo nhanh theo ngày/kỳ nhỏ.
  - Tự động chuyển hướng (Fallback) qua Amazon Athena quét dữ liệu trên S3 Data Lake khi cần phân tích Big Data dài hạn hoặc xuất báo cáo quy mô lớn.

## 7. Nghiệp vụ Giám sát & Vận hành Hệ thống (Monitoring & Observability)
Hệ thống được thiết kế với cơ chế giám sát thời gian thực chuẩn Serverless của AWS để đảm bảo độ tin cậy và dễ bảo trì:
- **Truy vết Phân tán (AWS X-Ray):** Tích hợp AWS X-Ray SDK để "chụp x-quang" (Trace) toàn bộ luồng dữ liệu. Giúp Kỹ sư hệ thống đo lường chính xác một Request đi từ API Gateway -> Lambda -> DynamoDB -> SQS mất bao nhiêu mili-giây, hoặc phát hiện ngay nút thắt cổ chai (bottleneck) đang nằm ở dịch vụ nào.
- **Nhật ký Tập trung (Amazon CloudWatch):** Toàn bộ nhật ký hoạt động (Logs) và lỗi hệ thống (Exceptions) từ Backend FastAPI đều được tự động thu gom về CloudWatch Logs. Backend được cấu hình xử lý lỗi thông minh (Catch-all): Ẩn lỗi hệ thống (Stack Trace) đối với người dùng cuối để bảo mật, nhưng ghi chép cực kỳ chi tiết trên CloudWatch để Developer dễ dàng debug.
- **Bảo hiểm Dữ liệu (Dead Letter Queue - DLQ):** Hoạt động song song với SQS. Nếu luồng gửi thông báo hoặc lưu dữ liệu thống kê ngầm bị thất bại quá 3 lần (do mất mạng hoặc đứt kết nối Database), sự kiện đó tự động bị đẩy vào "Vùng cách ly" (DLQ) và kích hoạt Báo động (CloudWatch Alarms) cho Admin, đảm bảo không một luồng điểm danh hay thông báo nào bị bốc hơi khỏi hệ thống.
