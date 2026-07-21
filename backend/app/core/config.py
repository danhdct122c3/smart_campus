from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Smart Campus API"
    app_version: str = "0.1.0"
    environment: str = "local"

    aws_region: str = "ap-southeast-1"

    # DynamoDB tables
    users_table: str = "smart-campus-users"
    faces_table: str = "smart-campus-faces"
    attendance_table: str = "smart-campus-attendance"
    security_table: str = "smart-campus-security"
    notifications_table: str = "smart-campus-notifications"
    tasks_table: str = "smart-campus-tasks"


    # Rekognition
    face_collection_id: str = "smart-campus-faces"

    # S3
    image_bucket: str = "smart-campus-images"
    data_lake_bucket: str = "smart-campus-datalake"

    # EventBridge
    event_bus_name: str = "smart-campus-events"

    # Amazon Cognito
    cognito_user_pool_id: str = ""
    cognito_client_id: str = ""
    cognito_region: str = "ap-southeast-1"

    # SNS
    security_alert_topic_arn: str = ""
    notification_topic_arn: str = ""

    # Amazon SES (Workflow 4 – Personal Email Notification)
    ses_sender_email: str = ""  # Email đã verify trên SES Console, VD: noreply@yourdomain.com

    # Amazon Bedrock (AI Assistant – Workflow 6)
    bedrock_model_id: str = "anthropic.claude-3-sonnet-20240229-v1:0"

    # Athena (Analytics – Workflow 5)
    athena_database: str = "smart_campus_db"
    athena_output_location: str = ""    # s3://bucket/athena-results/

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()