# Báo Cáo: Các Khó Khăn Gặp Phải Trong Quá Trình Triển Khai (Deployment Troubleshooting)

## 1. Lỗi "Internal Server Error" khi chạy Serverless FastAPI trên AWS Lambda

**Mô tả lỗi:**
Sau khi đóng gói file `lambda_function.zip` (bao gồm source code và các thư viện dependencies) và tải lên AWS Lambda, khi gọi thử API thông qua đường dẫn API Gateway (ví dụ: `/docs`), hệ thống luôn trả về lỗi HTTP 500: `{"message": "Internal Server Error"}` thay vì hiển thị giao diện của ứng dụng.

**Phân tích nguyên nhân (Root Cause):**
Lỗi này bắt nguồn từ sự bất đồng bộ về hệ điều hành (Cross-platform Deployment Issue).
- Quá trình đóng gói file ZIP được thực hiện trên môi trường **Windows** (máy tính cá nhân). Khi chạy lệnh `pip install`, công cụ này sẽ tự động nhận diện hệ điều hành và tải về các gói thư viện được biên dịch sẵn cho Windows (các file `.whl` chứa C-extensions như `win_amd64` hoặc các file `.pyd`). Một ví dụ điển hình là thư viện `pydantic-core` của FastAPI.
- Tuy nhiên, môi trường thực thi (Runtime) của AWS Lambda lại sử dụng hệ điều hành **Amazon Linux**. Khi AWS Lambda thử import và chạy các file thư viện nhị phân của Windows, nó không hiểu được định dạng này, gây ra lỗi `ImportError` ở cấp độ hệ thống, làm sập ứng dụng và trả ra lỗi 500.

**Cách giải quyết (Solution):**
Thay vì sử dụng Docker để giả lập môi trường Linux, giải pháp nhanh chóng và hiệu quả hơn là sử dụng các cờ (flags) nâng cao của công cụ `pip` để ép nó tải về phiên bản thư viện của Linux (`manylinux`) ngay trên máy tính Windows.

**Script PowerShell để khắc phục:**
```powershell
# 1. Dọn dẹp thư mục build cũ
if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
if (Test-Path "lambda_function.zip") { Remove-Item -Force "lambda_function.zip" }
New-Item -ItemType Directory -Force -Path "dist"

# 2. Cài đặt thư viện bản Linux (Sử dụng --platform manylinux2014_x86_64)
pip install --platform manylinux2014_x86_64 -t ./dist --implementation cp --python-version 3.12 --only-binary=:all: --upgrade -r requirements.txt

# 3. Đóng gói lại code
Copy-Item -Path "app" -Destination "dist" -Recurse
Compress-Archive -Path "dist\*" -DestinationPath "lambda_function.zip" -CompressionLevel Optimal
```

*Kết quả:* File ZIP mới được tải lên chứa các tệp `.so` tương thích với Amazon Linux, giúp API hoạt động trơn tru trên AWS Lambda.

## 2. Lỗi CORS giả (Provisional headers are shown) do xung đột Event Loop giữa Mangum và Python 3.12

**Mô tả lỗi:**
Sau khi tích hợp AWS EventBridge để chạy ngầm tính năng kiểm tra task trễ hạn (Cronjob) chung với AWS Lambda (đang chạy FastAPI qua thư viện Mangum). 
Khi truy cập Frontend (được host trên AWS S3), toàn bộ các lời gọi API (ví dụ `/api/auth/login`) đều bị sập và trả về thông báo lỗi **"Lỗi kết nối máy chủ"** trên giao diện.
Kiểm tra tab Network của trình duyệt (F12), các request đều bị chặn ở trạng thái CORS Error (Cross-Origin Resource Sharing) với dòng chữ cảnh báo `Provisional headers are shown`.

**Phân tích nguyên nhân (Root Cause):**
Lỗi CORS này thực chất là "kết quả giả" của một lỗi Internal Server Error (500) bị ẩn ở tầng AWS Lambda. 
1. **Bản chất của HTTP API Gateway:** Khi Backend Lambda gặp lỗi sập (Crash) ngay từ lúc khởi động, nó không kịp tạo ra đối tượng HTTP Response nào, dẫn đến việc không có các Header cấu hình CORS (`Access-Control-Allow-Origin: *`) gửi về trình duyệt. Trình duyệt tưởng lầm là API chặn truy cập chéo nên báo lỗi CORS.
2. **Lỗi `asyncio` trên Python 3.12:** Lỗi sập Lambda bắt nguồn từ việc môi trường thực thi của Lambda trên Python 3.12 mặc định không khởi tạo `Event Loop` ở Thread chính khi chạy trực tiếp. Thư viện `Mangum` (adapter nối FastAPI với Lambda) mặc định có bật tính năng `lifespan` (vòng đời ứng dụng), nó cố gắng gọi `asyncio.get_event_loop()` và gây ra ngoại lệ hệ thống: `RuntimeError: There is no current event loop in thread 'MainThread'`.
3. **Lỗi gọi hàm bất đồng bộ sai cách:** Cronjob handler vô tình dùng `asyncio.run()` lên một hàm được định nghĩa là hàm đồng bộ (`def` bình thường, không phải `async def`), gây ra lỗi `ValueError: a coroutine was expected`.

**Cách giải quyết (Solution):**
Điều chỉnh lại logic khởi tạo Mangum và cấu trúc gọi hàm trong file `main.py` của Backend:
1. Vô hiệu hóa tính năng Lifespan của Mangum bằng cờ `lifespan="off"` để tránh việc thư viện này tự ý khởi tạo/tìm kiếm Event Loop trên Python 3.12.
2. Sửa lại luồng gọi hàm kiểm tra trễ hạn thành lời gọi hàm đồng bộ thông thường.

**Code khắc phục (`main.py`):**
```python
# Tắt lifespan để tránh lỗi asyncio event loop trên Python 3.12
mangum_handler = Mangum(app, lifespan="off")

def handler(event, context):
    # Kiểm tra xem có phải sự kiện hẹn giờ từ EventBridge không
    if event.get("source") == "aws.events" or event.get("source") == "smart_campus.scheduler":
        # Gọi trực tiếp vì hàm này là hàm đồng bộ
        check_and_notify_task_deadlines()
        return {"statusCode": 200, "body": "Cronjob completed successfully."}
    
    # Nếu là Web Request bình thường thì giao cho FastAPI xử lý
    return mangum_handler(event, context)
```

*Kết quả:* Khắc phục triệt để lỗi sập Lambda (500), giúp API Gateway nhận được đúng response của FastAPI và trả về đầy đủ các Header CORS. Giao diện Frontend truy cập Backend thành công.

## 3. Lỗi "Access Denied" khi chạy CI/CD Pipeline (AWS CodeBuild)

**Mô tả lỗi:**
Trong quá trình thiết lập tự động hóa CI/CD bằng AWS CodePipeline, ở bước "Build" (do dịch vụ AWS CodeBuild đảm nhiệm), tiến trình bị thất bại (Failed) và xuất hiện thông báo lỗi liên quan đến quyền truy cập (ví dụ: `AccessDeniedException` khi gọi lệnh `aws lambda update-function-code` hoặc `aws s3 sync`).

**Phân tích nguyên nhân (Root Cause):**
Kiến trúc bảo mật của AWS tuân theo nguyên tắc "Zero Trust" và "Đặc quyền tối thiểu" (Least Privilege). 
Mặc định, khi CodeBuild được tạo ra, AWS cấp cho nó một IAM Service Role (vai trò dịch vụ) cơ bản. Role này chỉ có duy nhất quyền ghi Log lên CloudWatch và lấy mã nguồn từ S3 Artifact. Nó **hoàn toàn không có quyền** can thiệp vào các dịch vụ khác như AWS Lambda (để cập nhật Backend) hay Amazon S3 (để upload Frontend).

**Cách giải quyết (Solution):**
Sử dụng dịch vụ IAM (Identity and Access Management) để cấp thêm các chính sách (Policies) cần thiết cho Service Role của CodeBuild.
1. Xác định tên Role của CodeBuild (ví dụ: `codebuild-smart-campus-backend-build-service-role`).
2. Truy cập vào AWS IAM -> Roles -> Tìm tên Role đó.
3. Trong tab Permissions, chọn Add permissions -> Attach policies.
4. Bổ sung các quyền sau:
   - `AWSLambda_FullAccess`: Để CodeBuild có quyền tải file ZIP và cập nhật code cho hàm Lambda.
   - `AmazonS3FullAccess`: Để CodeBuild có quyền đọc/ghi và đồng bộ mã nguồn tĩnh (HTML/JS/CSS) lên bucket S3 của Frontend.

*Kết quả:* CodePipeline chạy lại thành công (Xanh 100%), luồng triển khai hoàn toàn tự động từ lúc Push code lên GitHub cho tới khi Code lên môi trường thực tế.

## 4. Lỗi "Cannot read properties of undefined (reading 'getUserMedia')" và Lỗi 404 Not Found trên Frontend S3

**Mô tả lỗi:**
Sau khi deploy thành công Frontend lên AWS S3 (dạng Static Website Hosting), người dùng gặp 2 vấn đề lớn:
1. Khi vào chức năng Điểm danh khuôn mặt, ứng dụng báo lỗi `Cannot read properties of undefined (reading 'getUserMedia')` và không thể bật Camera.
2. Khi đang ở một trang con (ví dụ: `/attendance`), nếu nhấn F5 tải lại trang, trình duyệt lập tức báo lỗi `404 Not Found`.

**Phân tích nguyên nhân (Root Cause):**
- **Vấn đề 1 (Lỗi Camera):** Các trình duyệt hiện đại (Chrome, Edge, Safari, Firefox) có cơ chế bảo mật rất nghiêm ngặt. API `navigator.mediaDevices.getUserMedia` để truy cập thiết bị phần cứng (Camera, Micro) **chỉ được phép hoạt động trên kết nối mã hóa HTTPS** hoặc `localhost`. Đường dẫn mặc định của S3 Website endpoint là `http://...s3-website...` (chưa được mã hóa HTTPs), do đó trình duyệt thẳng tay chặn API này, khiến biến `mediaDevices` bị `undefined`.
- **Vấn đề 2 (Lỗi 404 React Router):** React.js là một Single Page Application (SPA). Nghĩa là toàn bộ ứng dụng chỉ có duy nhất một file `index.html`. Việc chuyển trang (như `/attendance`) là do Javascript giả lập (Client-side routing). S3 là một File Server thuần túy, khi truy cập `s3.../attendance`, nó sẽ cố gắng tìm kiếm thư mục `attendance` và file `index.html` bên trong thư mục đó, vì không có nên trả về 404.

**Cách giải quyết (Solution):**

*Khắc phục Lỗi 404 (S3 Static Website)*
Truy cập vào Bucket S3 -> tab **Properties** -> Cuộn xuống dưới cùng mục **Static website hosting** -> Edit:
- Đảm bảo cả `Index document` và `Error document` đều được điền là: `index.html`. 
- (S3 sẽ trả về file index.html mỗi khi không tìm thấy đường dẫn, từ đó React Router sẽ có cơ hội tiếp quản và hiển thị đúng component).

*Khắc phục Lỗi Camera (AWS CloudFront)*
Để có HTTPS cho S3, ta cần đưa trang web ra phía sau mạng phân phối nội dung AWS CloudFront.
1. Truy cập dịch vụ **CloudFront** -> **Create Distribution**.
2. **Origin domain:** Chọn mục S3 Website Endpoint (Chú ý: phải nhập đường dẫn dạng website của S3, KHÔNG chọn S3 dạng REST API mặc định).
3. **Viewer protocol policy:** Chọn `Redirect HTTP to HTTPS` (Bắt buộc dùng HTTPS).
4. **Web Application Firewall (WAF):** Do not enable (để tiết kiệm chi phí/đỡ phức tạp).
5. (Đối với SPA, ở tab Error Pages của CloudFront, cấu hình Custom Error Response: HTTP error code 404 -> Trả về `/index.html` với status 200 OK).
6. Nhấn **Create**.

*Kết quả:* CloudFront cấp phát một tên miền dạng `https://xxx.cloudfront.net`. Khi truy cập qua tên miền này, kết nối được bảo mật 100%, Camera hoạt động mượt mà và các trang con F5 không còn bị 404.
