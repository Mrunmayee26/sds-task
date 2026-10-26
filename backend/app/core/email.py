"""
Email service using aiosmtplib for sending verification OTPs and transactional notifications.
"""
import logging
from html import escape
from email.message import EmailMessage
import aiosmtplib
from app.config import settings

logger = logging.getLogger("venueflow.email")

def create_otp_html(user_name: str, otp_code: str) -> str:
    """Generate clean HTML email template for verification OTP."""
    name = escape(user_name.strip()) if user_name else "COEP Member"
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; padding: 20px; }}
        .card {{ max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }}
        .header {{ font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 8px; }}
        .subtitle {{ font-size: 14px; color: #64748b; margin-bottom: 24px; }}
        .otp-box {{ background: #f1f5f9; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0; }}
        .otp-code {{ font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #1e40af; }}
        .note {{ font-size: 13px; color: #64748b; line-height: 1.5; }}
        .footer {{ font-size: 12px; color: #94a3b8; text-align: center; margin-top: 24px; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">COEP VenueFlow</div>
        <div class="subtitle">Account Email Verification</div>
        <p>Hello {name},</p>
        <p>Use the verification code below to complete your registration for the COEP VenueFlow campus portal:</p>
        <div class="otp-box">
          <div class="otp-code">{otp_code}</div>
        </div>
        <p class="note">This code is valid for <strong>10 minutes</strong>. If you did not request this verification, you can safely ignore this email.</p>
        <div class="footer">COEP Technological University &bull; VenueFlow Management System</div>
      </div>
    </body>
    </html>
    """

async def send_otp_email(to_email: str, otp_code: str, user_name: str = "") -> bool:
    """
    Send OTP verification email via SMTP.
    Returns false when delivery is unavailable. Verification codes are not logged.
    """
    if not settings.SMTP_ENABLED:
        return False

    try:
        msg = EmailMessage()
        msg["Subject"] = f"{otp_code} is your COEP VenueFlow verification code"
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = to_email

        html_content = create_otp_html(user_name, otp_code)
        msg.set_content(f"Your COEP VenueFlow verification code is: {otp_code}\nValid for 10 minutes.")
        msg.add_alternative(html_content, subtype="html")

        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=settings.SMTP_USE_TLS,
            timeout=10,
        )
        logger.info(f"Verification email sent to {to_email}")
        return True
    except Exception as err:
        logger.error(f"Failed to deliver email via SMTP: {err}")
        return False
