"""Amazon SES wrapper – gửi transactional email cá nhân.

Dùng cho WF4: Sau khi checkin thành công, gửi email thông báo thời gian
checkin đến email cá nhân của người dùng.

Lưu ý: Ở chế độ SES Sandbox, cả sender và recipient đều phải được verify
trên AWS Console. Để gửi tới bất kỳ email nào, cần request production access.
"""

import boto3
from functools import lru_cache
from botocore.exceptions import ClientError

from app.core.config import settings


@lru_cache
def get_ses_client():
    return boto3.client("ses", region_name=settings.aws_region)


def send_email(
    to_email: str,
    subject: str,
    body_html: str,
    body_text: str | None = None,
) -> str | None:
    """
    Gửi email cá nhân qua Amazon SES.

    Args:
        to_email: Địa chỉ email người nhận.
        subject: Tiêu đề email.
        body_html: Nội dung email dạng HTML.
        body_text: Nội dung email dạng text thuần (fallback cho client không đọc HTML).

    Returns:
        MessageId nếu thành công, None nếu thất bại.

    Raises:
        RuntimeError nếu SES trả về lỗi.
    """
    if not settings.ses_sender_email:
        return None  # SES chưa được cấu hình, bỏ qua

    client = get_ses_client()
    try:
        response = client.send_email(
            Source=settings.ses_sender_email,
            Destination={"ToAddresses": [to_email]},
            Message={
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {
                    "Html": {"Data": body_html, "Charset": "UTF-8"},
                    **({"Text": {"Data": body_text, "Charset": "UTF-8"}} if body_text else {}),
                },
            },
        )
        return response["MessageId"]
    except ClientError as exc:
        error_code = exc.response["Error"]["Code"]
        if error_code == "MessageRejected":
            # Email chưa được verify trong SES Sandbox — bỏ qua thay vì crash
            return None
        raise RuntimeError(f"SES send_email failed: {exc}") from exc


def send_attendance_email(
    to_email: str,
    user_name: str,
    timestamp: str,
    room_id: str,
    status: str,
    session_type: str,
) -> str | None:
    """
    Gửi email thông báo điểm danh thành công đến người dùng cá nhân.
    """
    status_label = {
        "PRESENT": "✅ Đúng giờ",
        "LATE": "⚠️ Đi muộn",
        "ABSENT": "❌ Vắng mặt",
    }.get(status, status)

    session_label = {
        "MORNING": "Buổi sáng",
        "AFTERNOON": "Buổi chiều",
        "EVENING": "Buổi tối",
    }.get(session_type, session_type)

    subject = f"[Smart Campus] Điểm danh thành công – {timestamp[:10]}"

    body_html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
      <div style="max-width: 560px; margin: auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #06b6d4, #3b82f6); padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 22px;">🎓 Smart Campus</h1>
          <p style="color: rgba(255,255,255,0.85); margin: 4px 0 0;">Thông báo điểm danh</p>
        </div>
        <div style="padding: 32px;">
          <p style="color: #374151; font-size: 16px;">Xin chào <strong>{user_name}</strong>,</p>
          <p style="color: #6b7280;">Hệ thống đã ghi nhận thông tin điểm danh của bạn:</p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #f9fafb;">
              <td style="padding: 12px 16px; color: #6b7280; font-size: 14px; border-bottom: 1px solid #e5e7eb;">📅 Thời gian</td>
              <td style="padding: 12px 16px; color: #111827; font-weight: 600; border-bottom: 1px solid #e5e7eb;">{timestamp}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; color: #6b7280; font-size: 14px; border-bottom: 1px solid #e5e7eb;">🏫 Phòng học</td>
              <td style="padding: 12px 16px; color: #111827; font-weight: 600; border-bottom: 1px solid #e5e7eb;">{room_id or "N/A"}</td>
            </tr>
            <tr style="background: #f9fafb;">
              <td style="padding: 12px 16px; color: #6b7280; font-size: 14px; border-bottom: 1px solid #e5e7eb;">📚 Ca học</td>
              <td style="padding: 12px 16px; color: #111827; font-weight: 600; border-bottom: 1px solid #e5e7eb;">{session_label}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; color: #6b7280; font-size: 14px;">📊 Trạng thái</td>
              <td style="padding: 12px 16px; font-weight: 700; font-size: 15px;">{status_label}</td>
            </tr>
          </table>

          <p style="color: #9ca3af; font-size: 13px; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
            Email này được gửi tự động từ hệ thống Smart Campus. Vui lòng không trả lời email này.
          </p>
        </div>
      </div>
    </body>
    </html>
    """

    body_text = (
        f"Smart Campus - Thông báo điểm danh\n"
        f"Xin chào {user_name},\n"
        f"Thời gian: {timestamp}\n"
        f"Phòng học: {room_id or 'N/A'}\n"
        f"Ca học: {session_label}\n"
        f"Trạng thái: {status}\n"
    )

    return send_email(to_email, subject, body_html, body_text)
