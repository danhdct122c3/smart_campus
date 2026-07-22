# Business Logic: Task Management (Sửa / Xóa)

Tài liệu này mô tả chi tiết nghiệp vụ áp dụng cho hệ thống Quản lý công việc (Smart Campus - Tasks).

## 1. Nghiệp vụ Sửa Công việc (Edit Task)

Tính năng cập nhật các thông tin cốt lõi của một công việc (ngoài việc chuyển trạng thái).

### Phân quyền (Authorization)
- **ADMIN / MANAGER**: Có toàn quyền sửa bất kỳ công việc nào trong hệ thống, không bị ràng buộc bởi trạng thái.
- **Người giao việc (Reporter)**: Được quyền sửa các công việc do chính mình tạo ra.
- **Người nhận việc (Assignee)**: KHÔNG CÓ QUYỀN sửa nội dung công việc (chỉ được phép cập nhật trạng thái thông qua API Update Status riêng).

### Logic Thời điểm & Trạng thái (State Logic)
- Trạng thái **OPEN**: Được phép chỉnh sửa toàn bộ các trường thông tin.
- Trạng thái **IN_PROGRESS / IN_REVIEW**: Reporter vẫn được phép sửa thông tin (Tiêu đề, mô tả, hạn chót), bản chất là cập nhật yêu cầu. (Trong tương lai có thể bổ sung chức năng thông báo/notification cho Assignee).
- Trạng thái **DONE / CANCELLED**: Công việc đã đóng. KHÔNG ĐƯỢC PHÉP sửa (Ngoại trừ ADMIN).

### Các trường được phép cập nhật (Allowed Fields)
- `title`, `description`, `priority`, `due_date`, `assignee_id`, `department`, `task_type`.
- *Lưu ý: Nếu thay đổi `assignee_id`, bản chất là hành động ủy quyền/chuyển giao công việc cho người khác.*

---

## 2. Nghiệp vụ Xóa Công việc (Delete Task)

Trong hệ thống doanh nghiệp, ưu tiên sử dụng cơ chế **Hủy (Cancel / Soft Delete)** thay vì xóa cứng khỏi cơ sở dữ liệu để phục vụ đối soát (Audit).

### Phân quyền & Hành vi (Behavior)
- **ADMIN**: Có đặc quyền thực hiện **Xóa cứng (Hard Delete)** - xóa vĩnh viễn record khỏi DynamoDB. Thường dùng để dọn dẹp rác hệ thống.
- **Người giao việc (Reporter)**:
  - Chỉ được thực hiện xóa (đối với hệ thống là Hủy - chuyển trạng thái sang `CANCELLED`) nếu công việc đang ở trạng thái **OPEN** (chưa ai thực hiện).
  - Nếu công việc đã bắt đầu (`IN_PROGRESS`, `DONE`), Reporter không có quyền xóa ngang, mà chỉ có thể thực hiện thao tác cập nhật trạng thái (Update Status).
- **Người nhận việc (Assignee)**: Tuyệt đối KHÔNG CÓ QUYỀN xóa công việc được giao.

### Xử lý Công việc con (Sub-tasks cascade)
- Nếu một công việc cha (Parent Task) bị xóa cứng (bởi Admin), tất cả các công việc con (Sub-tasks) thuộc về nó cũng phải bị xóa cứng theo (Cascade Delete).
- Nếu công việc cha bị Hủy (chuyển trạng thái `CANCELLED`), các công việc con (nếu đang OPEN) cũng nên được tự động chuyển sang `CANCELLED` để đồng bộ.

---

## 3. Tóm tắt API Endpoints

1. **`PUT /api/tasks/{task_id}`**
   - Payload: `TaskUpdate`
   - Logic: Lấy task hiện tại -> Kiểm tra role (Admin) hoặc role(Reporter) -> Áp dụng điều kiện trạng thái -> Thực hiện lưu DynamoDB.

2. **`DELETE /api/tasks/{task_id}`**
   - Logic: 
     - Lấy task hiện tại.
     - Nếu User = Admin -> Call `dynamodb.delete_item` cho task và toàn bộ subtasks.
     - Nếu User = Reporter -> Kiểm tra `status == 'OPEN'` -> Update `status = 'CANCELLED'`.
     - Các trường hợp khác: Throw 403 Forbidden.
