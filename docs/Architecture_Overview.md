# Kiến trúc Hệ thống Smart Campus Platform

**Phiên bản:** 2.0  
**Nền tảng:** 100% Serverless trên AWS  
**Mô hình:** Event-Driven Microservices Architecture  

---

## 1. Tổng quan Kiến trúc

Smart Campus Platform được xây dựng theo mô hình **Serverless + Event-Driven** trên AWS, cho phép tự động mở rộng quy mô (auto-scale), không cần quản lý máy chủ vật lý và tối ưu chi phí vận hành.

### Triết lý Thiết kế

| Nguyên tắc | Mô tả |
|---|---|
| **Serverless First** | Ưu tiên dịch vụ managed, không quản lý OS/Server |
| **Event-Driven** | Các module giao tiếp qua EventBridge + SQS, giảm coupling |
| **Defense in Depth** | Bảo mật đa lớp: WAF → Cognito JWT → RBAC trong code |
| **Hybrid Analytics** | OLTP (DynamoDB) tách biệt OLAP (Athena + S3 Data Lake) |
| **AI-Powered Security** | Nhận diện khuôn mặt + Liveness Detection chống gian lận |
| **Reliable Messaging** | SQS đảm bảo không mất dữ liệu, retry tự động + Dead Letter Queue |

---

## 2. Sơ đồ Kiến trúc Tổng thể

```mermaid
graph TB
    subgraph Client["👤 Client Layer"]
        Browser["Web Browser\n(React + Vite)"]
        Camera["Camera\n(Attendance Device)"]
    end

    subgraph CDN["🌐 Content Delivery"]
        CF["Amazon CloudFront\nCDN + HTTPS"]
        S3_FE["Amazon S3\nStatic Frontend Hosting"]
    end

    subgraph Security["🛡️ Security Layer"]
        WAF["AWS WAF\nIP Whitelist\n(Company Network Only)"]
        Cognito["Amazon Cognito\nJWT Authentication\n+ Force Change Password"]
    end

    subgraph API["⚡ API Layer"]
        APIGW["Amazon API Gateway\nHTTP API"]
        Lambda["AWS Lambda\nFastAPI + Mangum\nPython 3.12"]
    end

    subgraph AI["🤖 AI / ML Services"]
        Liveness["Rekognition\nFace Liveness Detection\n(Anti-Spoofing)"]
        Rekognition["Rekognition\nSearchFacesByImage\n(Face Recognition)"]
        Bedrock["Amazon Bedrock\nClaude 3 Sonnet\n(AI Assistant)"]
    end

    subgraph Storage["🗄️ Data Layer"]
        DynamoDB["Amazon DynamoDB\n8 Tables\nOLTP Database"]
        S3_Images["Amazon S3\nRaw Images Bucket"]
        S3_Lake["Amazon S3\nData Lake Bucket"]
    end

    subgraph Analytics["📊 Analytics Pipeline"]
        Glue["AWS Glue\nCrawler + Data Catalog\n3 Tables"]
        Athena["Amazon Athena\nSQL Query Engine\nOLAP Analytics"]
    end

    subgraph Events["📨 Event & Messaging"]
        EB["Amazon EventBridge\nEvent Bus\n(Smart Campus Events)"]
        SQS_A["Amazon SQS\nAnalytics Queue\n(Guaranteed Delivery)"]
        SQS_N["Amazon SQS\nNotification Queue\n(Dead Letter Queue)"]
        SNS["Amazon SNS\nMulti-channel Notification\nEmail / SMS / Push"]
    end

    subgraph CICD["🔄 CI/CD Pipeline"]
        CC["AWS CodeCommit\nSource Repository"]
        CB["AWS CodeBuild\nBuild + Test"]
        CP["AWS CodePipeline\nAutomated Deployment"]
    end

    subgraph Monitoring["📈 Observability"]
        CW["Amazon CloudWatch\nLogs + Metrics + Alarms"]
    end

    Browser -->|"HTTPS"| CF
    CF --> S3_FE
    Browser -->|"API Calls"| WAF
    Camera -->|"Attendance Check-in"| WAF
    WAF -->|"Valid IP"| APIGW
    APIGW -->|"JWT Verify"| Cognito
    Cognito -->|"Authorized"| Lambda
    Lambda -->|"1. Liveness Check"| Liveness
    Lambda -->|"2. Face Search"| Rekognition
    Lambda -->|"NL2SQL"| Bedrock
    Lambda <-->|"Read/Write"| DynamoDB
    Lambda -->|"Upload Image"| S3_Images
    Lambda -->|"Publish Events"| EB
    EB -->|"Enqueue - Analytics"| SQS_A
    EB -->|"Enqueue - Notify"| SQS_N
    SQS_A -->|"Trigger Lambda (retry auto)"| S3_Lake
    SQS_N -->|"Trigger"| SNS
    S3_Lake -->|"Crawl Schema"| Glue
    Glue -->|"Data Catalog"| Athena
    Lambda -->|"SQL Analytics Query"| Athena
    CC --> CB --> CP
    CP -->|"Deploy Lambda zip"| Lambda
    CP -->|"Sync dist/"| S3_FE
    Lambda -->|"Logs"| CW
    APIGW -->|"Metrics"| CW
```

---

## 3. Sơ đồ Luồng Bảo mật Điểm danh (Anti-Fraud)

```mermaid
sequenceDiagram
    participant E as Nhân viên
    participant FE as Frontend (Camera)
    participant WAF as AWS WAF
    participant L as Lambda
    participant FL as Rekognition Face Liveness
    participant FR as Rekognition SearchFaces
    participant DB as DynamoDB
    participant EB as EventBridge

    E->>FE: Bấm Check-in
    FE->>WAF: POST /attendance/check-in

    alt IP không hợp lệ (ngoài mạng công ty)
        WAF-->>FE: 403 Forbidden
    else IP hợp lệ (mạng công ty)
        WAF->>L: Forward request

        Note over L,FL: Bước 1 - Liveness Detection
        L->>FL: CreateFaceLivenessSession
        FL-->>FE: session_id
        FE->>FL: Stream video frames (SDK)
        L->>FL: GetFaceLivenessSessionResults

        alt Confidence < 80% (anh gia / video replay)
            FL-->>L: Liveness FAILED
            L-->>FE: 400 - Phat hien gian lan!
        else Confidence >= 80% (nguoi that)
            FL-->>L: Liveness PASSED

            Note over L,FR: Buoc 2 - Face Recognition
            L->>FR: SearchFacesByImage

            alt Khong nhan dien duoc
                FR-->>L: Unknown Face
                L-->>FE: 404 - Chua dang ky khuon mat
            else Nhan dien thanh cong
                FR-->>L: user_id + confidence
                L->>DB: Ghi ban ghi diem danh
                L->>EB: Publish AttendanceRecorded
                L-->>FE: 200 - Diem danh thanh cong!
            end
        end
    end
```

---

## 4. So do Analytics Pipeline (Data Lake)

```mermaid
graph LR
    subgraph "Application Layer (OLTP)"
        Lambda["Lambda (FastAPI)"] --> DynDB["DynamoDB\nReal-time Data"]
    end

    subgraph "Data Ingestion - Reliable"
        Lambda -->|"Publish AttendanceRecorded"| EB["EventBridge"]
        EB -->|"Enqueue"| SQS["Amazon SQS\nAnalytics Queue\n- Guaranteed Delivery\n- Auto Retry x3\n- Dead Letter Queue"]
        SQS -->|"Trigger (with retry)"| Worker["Lambda\nAnalytics Worker"]
        Worker -->|"Write partitioned data"| S3["S3 Data Lake\n/attendance/year=.../\n/tasks/year=.../\n/users/year=../."]
    end

    subgraph "Analytics Layer (OLAP)"
        S3 -->|"Auto Crawl Schema"| Glue["AWS Glue\nCrawler + Catalog"]
        Glue -->|"Table Metadata"| Athena["Amazon Athena\nSQL Engine"]
        Athena -->|"Query Results"| Results["S3 athena-results/"]
    end

    subgraph "Presentation"
        Lambda -->|"SQL Query"| Athena
        Athena -->|"Aggregated Data"| Dashboard["Analytics Dashboard\n(React Frontend)"]
    end
```

---

## 5. Danh sach Dich vu AWS Su dung

### 5.1 Core Services

| Dich vu | Vai tro | Workflow |
|---|---|---|
| **Amazon Cognito** | Xac thuc nguoi dung, phat hanh JWT, Force Change Password | WF1 |
| **AWS Lambda** | Chay FastAPI Backend (Python 3.12) qua Mangum | Tat ca |
| **Amazon API Gateway** | HTTP API endpoint, JWT Authorizer | Tat ca |
| **Amazon DynamoDB** | Database NoSQL chinh, 8 bang, da GSI | Tat ca |
| **Amazon S3** | Luu anh (Images Bucket) + Frontend tinh + Data Lake | WF2, WF5 |
| **Amazon CloudFront** | CDN phuc vu Frontend React, HTTPS tu dong | WF1 |

### 5.2 AI / ML Services

| Dich vu | Vai tro | Workflow |
|---|---|---|
| **Amazon Rekognition – IndexFaces** | Lap chi muc khuon mat khi dang ky | WF2 |
| **Amazon Rekognition – SearchFacesByImage** | Nhan dien khuon mat khi diem danh | WF3 |
| **Amazon Rekognition – Face Liveness** | Phat hien gian lan (anh gia / video replay) | WF3 |
| **Amazon Bedrock (Claude 3)** | AI Assistant – NL2SQL tieng Viet to Athena | WF6 |

### 5.3 Analytics Services

| Dich vu | Vai tro | Workflow |
|---|---|---|
| **AWS Glue Crawler** | Tu dong quet va hoc schema tu S3 Data Lake | WF5 |
| **AWS Glue Data Catalog** | Metadata catalog (smart_campus_db) – 3 tables | WF5 |
| **Amazon Athena** | SQL query engine – phan tich du lieu lon tren S3 | WF5, WF6 |

### 5.4 Event & Notification Services

| Dich vu | Vai tro | Workflow |
|---|---|---|
| **Amazon EventBridge** | Event Bus trung tam, dieu phoi toan bo su kien | WF3, WF4, WF5, WF8 |
| **Amazon SQS – Analytics Queue** | Hang doi bao dam ghi du lieu vao S3 Data Lake, retry tu dong, Dead Letter Queue | WF5 |
| **Amazon SQS – Notification Queue** | Hang doi bao dam gui thong bao, khong mat notification khi SNS loi | WF4 |
| **Amazon SNS** | Gui thong bao da kenh (Email, SMS, Push) | WF4 |
| **Amazon SES** | Gui email thong bao ca nhan | WF4 |

### 5.5 Security Services

| Dich vu | Vai tro |
|---|---|
| **AWS WAF** | Firewall lop mang – IP whitelist (chi mang cong ty) |
| **Amazon Cognito** | Xac thuc JWT, quan ly phien dang nhap |
| **IAM Roles** | Phan quyen toi thieu cho tung Lambda function |

### 5.6 DevOps / Observability

| Dich vu | Vai tro |
|---|---|
| **AWS CodeCommit** | Luu tru source code |
| **AWS CodeBuild** | Build Lambda zip + React dist, chay tests |
| **AWS CodePipeline** | Orchestrate tu dong deploy khi push code |
| **Amazon CloudWatch** | Thu thap logs, metrics, canh bao tu dong |

---

## 6. Cau truc Database (DynamoDB – 8 Bang)

| Bang | PK | GSI | Module |
|---|---|---|---|
| `smart-campus-users` | `user_id` | `email-index` | WF1, WF2 |
| `smart-campus-faces` | `face_id` | `user_id-index` | WF2, WF3 |
| `smart-campus-attendance` | `record_id` | `user_id-index`, `date-index` | WF3 |
| `smart-campus-notifications` | `notification_id` | `user_id-index` | WF4 |
| `smart-campus-security` | `incident_id` | `status-index` | WF7 |
| `smart-campus-tasks` | `task_id` | `assignee_id-status-index`, `status-createdAt-index` | WF8 |
| `smart-campus-leaves` | `request_id` | `user_id-index`, `status-index` | WF8 |
| `smart-campus-holidays` | `date` | — | WF8 |

---

## 7. Cau truc S3 Data Lake

```
smart-campus-datalake-{account}-ap-southeast-1/
├── attendance/
│   └── year=2026/month=08/day=04/
│       └── data.json          <- Glue Table: attendance
├── tasks/
│   └── year=2026/month=08/day=04/
│       └── data.json          <- Glue Table: tasks
├── users/
│   └── year=2026/month=08/day=04/
│       └── data.json          <- Glue Table: users
└── athena-results/            <- Ket qua truy van SQL
```

---

## 8. Tong hop 8 Workflows

| # | Workflow | Trigger | Dich vu chinh | Trang thai |
|---|---|---|---|---|
| **WF1** | User Authentication | HTTP Request | Cognito, API Gateway | Hoan thanh |
| **WF2** | Face Registration | HTTP Request | Rekognition IndexFaces, S3 | Hoan thanh |
| **WF3** | Attendance Check-in | HTTP Request | WAF, Rekognition Liveness, Rekognition Search | Hoan thanh |
| **WF4** | Notification | Event | EventBridge, SNS, SES | Hoan thanh |
| **WF5** | Analytics & Reporting | HTTP Request | Glue, Athena, S3 Data Lake | Hoan thanh |
| **WF6** | AI Assistant | HTTP Request | Bedrock Claude 3, Athena | Tam hoan (cho quota) |
| **WF7** | Security & Incident | Event | EventBridge, DynamoDB | Tam hoan (phu thuoc hardware) |
| **WF8** | Task & Leave Mgmt | HTTP Request + Event | DynamoDB, EventBridge, SNS | Hoan thanh |

---

## 9. Lo trinh Phat trien (Development Phases)

```
Phase 1 — Core Platform (Hoan thanh)
├── WF1: Authentication (Cognito)
├── WF2: Face Registration (Rekognition)
├── WF3: Attendance (SearchFacesByImage + Rule Engine)
├── WF4: Notifications (EventBridge + SNS)
├── WF5: Analytics (DynamoDB + Athena + Data Lake)
└── WF8: Task & Leave Management

Phase 2 — Security & Reliability Enhancement (Dang trien khai)
├── Rekognition Face Liveness (chong gian lan anh)
├── AWS WAF IP Restriction (chi mang cong ty)
├── Amazon SQS Analytics Queue (dam bao du lieu Data Lake)
├── Amazon SQS Notification Queue (dam bao gui thong bao)
├── CloudFront + S3 (Frontend CDN)
└── CloudWatch Logs & Alarms

Phase 3 — Enterprise Grade (Ke hoach)
├── CI/CD: CodeCommit + CodeBuild + CodePipeline
├── WF6: AI Assistant (Bedrock – cho quota)
├── Parameter Store (thay the .env)
└── AWS WAF Advanced Rules
```

---

*Tai lieu duoc cap nhat lan cuoi: 2026-08-04*  
*Tac gia: Smart Campus Development Team*
