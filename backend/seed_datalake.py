import boto3
import json
import uuid
from datetime import datetime

s3 = boto3.client('s3', region_name='ap-southeast-1')
bucket_name = 'smart-campus-datalake-811391287455-ap-southeast-1-an'

def seed_data():
    now = datetime.now()
    year, month, day = str(now.year), f"{now.month:02d}", f"{now.day:02d}"
    
    # 1. Attendance Data
    attendance_records = [
        {
            "event_type": "AttendanceRecorded",
            "attendance_id": str(uuid.uuid4()),
            "user_id": "STU-1234",
            "camera_id": "CAM-01",
            "room_id": "ROOM-101",
            "status": "PRESENT",
            "timestamp": now.isoformat() + "Z"
        },
        {
            "event_type": "AttendanceRecorded",
            "attendance_id": str(uuid.uuid4()),
            "user_id": "MAN-4561",
            "camera_id": "CAM-02",
            "room_id": "ROOM-102",
            "status": "LATE",
            "timestamp": now.isoformat() + "Z"
        }
    ]
    
    # 2. Tasks Data
    tasks_records = [
        {
            "task_id": str(uuid.uuid4()),
            "title": "Fix server bug",
            "assignee_id": "STU-1234",
            "department": "IT",
            "status": "DONE",
            "due_date": now.isoformat() + "Z",
            "created_at": now.isoformat() + "Z"
        },
        {
            "task_id": str(uuid.uuid4()),
            "title": "Prepare presentation",
            "assignee_id": "MAN-4561",
            "department": "HR",
            "status": "IN_PROGRESS",
            "due_date": now.isoformat() + "Z",
            "created_at": now.isoformat() + "Z"
        },
        {
            "task_id": str(uuid.uuid4()),
            "title": "System maintenance",
            "assignee_id": "STU-1234",
            "department": "IT",
            "status": "OVERDUE",
            "due_date": now.isoformat() + "Z",
            "created_at": now.isoformat() + "Z"
        }
    ]
    
    # 3. Users Data
    users_records = [
        {
            "user_id": "STU-1234",
            "name": "Nguyen Van A",
            "role": "STAFF",
            "department": "IT",
            "created_at": now.isoformat() + "Z"
        },
        {
            "user_id": "MAN-4561",
            "name": "Tran Thi B",
            "role": "MANAGER",
            "department": "HR",
            "created_at": now.isoformat() + "Z"
        }
    ]
    
    def upload_dataset(records, prefix):
        content = "\n".join([json.dumps(r) for r in records])
        key = f"{prefix}/year={year}/month={month}/day={day}/mock_data.json"
        print(f"Uploading mock data to s3://{bucket_name}/{key}")
        s3.put_object(
            Bucket=bucket_name,
            Key=key,
            Body=content,
            ContentType='application/json'
        )

    upload_dataset(attendance_records, "attendance")
    upload_dataset(tasks_records, "tasks")
    upload_dataset(users_records, "users")
    print("All uploads complete!")

if __name__ == "__main__":
    seed_data()
