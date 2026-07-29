import sys
import os
import uuid
from datetime import datetime

# Add the current directory to python path so we can import app modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import boto3
from app.core.config import get_settings
from app.modules.users.repository import create_user, get_user_by_email

settings = get_settings()

demo_users = [
    {"email": "admin@smartcampus.edu", "name": "Super Admin", "role": "ADMIN"},
    {"email": "manager@smartcampus.edu", "name": "Project Manager", "role": "MANAGER"},
    {"email": "staff@smartcampus.edu", "name": "Regular Staff", "role": "STAFF"}
]

password = "Password@123"

def main():
    if not settings.cognito_user_pool_id:
        print("Missing COGNITO_USER_POOL_ID in .env")
        return

    cognito = boto3.client('cognito-idp', region_name=settings.aws_region)
    pool_id = settings.cognito_user_pool_id

    for u in demo_users:
        email = u["email"]
        print(f"\n--- Processing {email} ---")
        
        # 1. Ensure user exists in DynamoDB
        user_item = get_user_by_email(email)
        if not user_item:
            print(f"User {email} not found in DynamoDB. Creating...")
            create_user({
                "user_id": str(uuid.uuid4()),
                "email": email,
                "name": u["name"],
                "role": u["role"],
                "status": "ACTIVE",
                "created_at": datetime.utcnow().isoformat()
            })
        else:
            print(f"User {email} already exists in DynamoDB.")

        # 2. Ensure user exists in Cognito and password is correct
        try:
            # Try to force change password. This works if user exists.
            print(f"Attempting to set permanent password for {email} in Cognito...")
            cognito.admin_set_user_password(
                UserPoolId=pool_id,
                Username=email,
                Password=password,
                Permanent=True
            )
            print("Password updated successfully.")
        except cognito.exceptions.UserNotFoundException:
            print(f"User {email} not found in Cognito. Creating...")
            cognito.admin_create_user(
                UserPoolId=pool_id,
                Username=email,
                TemporaryPassword=password,
                MessageAction='SUPPRESS'
            )
            cognito.admin_set_user_password(
                UserPoolId=pool_id,
                Username=email,
                Password=password,
                Permanent=True
            )
            print("User created and password set successfully in Cognito.")
        except Exception as e:
            print(f"Error syncing {email} to Cognito: {e}")

if __name__ == "__main__":
    main()
