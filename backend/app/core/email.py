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


def create_status_update_html(
    user_name: str,
    application_id: int,
    venue_name: str,
    purpose: str,
    status: str,
    time_slot_str: str,
    remarks: str | None = None,
) -> str:
    """Generate clean HTML email template for booking application status updates."""
    name = escape(user_name.strip()) if user_name else "COEP Member"
    venue = escape(venue_name or "Campus Venue")
    event_purpose = escape(purpose or "Campus Event")
    timing = escape(time_slot_str or "To be scheduled")
    remarks_escaped = escape(remarks.strip()) if remarks else ""

    status_lower = status.lower()
    if status_lower == "approved":
        status_title = "Booking Request Approved"
        status_sub = "Great news! Your campus venue reservation has been approved and confirmed."
        badge_bg = "#ecfdf5"
        badge_border = "#a7f3d0"
        badge_color = "#065f46"
        badge_icon = "&#10003;"
    elif status_lower == "rejected":
        status_title = "Booking Request Not Approved"
        status_sub = "Your venue booking request was reviewed and could not be approved at this time."
        badge_bg = "#fef2f2"
        badge_border = "#fecaca"
        badge_color = "#991b1b"
        badge_icon = "&#10007;"
    elif status_lower == "cancelled":
        status_title = "Booking Request Cancelled"
        status_sub = "Your campus venue reservation request has been cancelled."
        badge_bg = "#f8fafc"
        badge_border = "#e2e8f0"
        badge_color = "#475569"
        badge_icon = "&#8212;"
    else:
        status_title = "Booking Request Received"
        status_sub = "Your request has been submitted and is currently in queue for review by approvers."
        badge_bg = "#eff6ff"
        badge_border = "#bfdbfe"
        badge_color = "#1e40af"
        badge_icon = "&#9679;"

    remarks_html = ""
    if remarks_escaped:
        remarks_html = f"""
        <div style="margin: 20px 0; background: #faf5ff; border-left: 4px solid #9333ea; border-radius: 6px; padding: 14px 16px;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #7e22ce; margin-bottom: 4px;">Reviewer Remarks / Feedback</div>
          <div style="font-size: 13.5px; color: #3b0764; font-style: italic; line-height: 1.5;">"{remarks_escaped}"</div>
        </div>
        """

    portal_url = settings.CORS_ORIGINS.split(",")[0].strip() if settings.CORS_ORIGINS else "http://localhost:5173"
    booking_url = f"{portal_url}/applicant/bookings/{application_id}"

    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
      margin: 0;
      padding: 24px 12px;
      line-height: 1.5;
    }}
    .email-container {{
      max-width: 520px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 14px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.05);
    }}
    .brand-header {{
      background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
      color: #ffffff;
      padding: 24px 28px;
    }}
    .brand-name {{
      font-size: 19px;
      font-weight: 800;
      letter-spacing: -0.3px;
      margin: 0;
    }}
    .brand-tag {{
      font-size: 11px;
      color: #c7d2fe;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-top: 4px;
    }}
    .email-body {{
      padding: 28px;
    }}
    .status-badge {{
      display: inline-block;
      padding: 8px 14px;
      border-radius: 8px;
      background: {badge_bg};
      border: 1px solid {badge_border};
      color: {badge_color};
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 12px;
    }}
    .greeting {{
      font-size: 15px;
      color: #334155;
      margin-top: 0;
      margin-bottom: 8px;
    }}
    .status-desc {{
      font-size: 14px;
      color: #64748b;
      margin-bottom: 22px;
    }}
    .details-box {{
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 18px;
      margin: 18px 0;
    }}
    .cta-button {{
      display: inline-block;
      width: 100%;
      box-sizing: border-box;
      text-align: center;
      background: #7047eb;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 20px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 13px;
      margin-top: 24px;
    }}
    .footer {{
      padding: 20px 28px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      font-size: 11.5px;
      color: #94a3b8;
      text-align: center;
    }}
  </style>
</head>
<body>
  <div class="email-container">
    <div class="brand-header">
      <div class="brand-name">COEP VenueFlow</div>
      <div class="brand-tag">Campus Space Reservation System</div>
    </div>
    <div class="email-body">
      <div class="status-badge">
        <span>{badge_icon}</span> {status_title}
      </div>
      <p class="greeting">Hello {name},</p>
      <p class="status-desc">{status_sub}</p>

      <div class="details-box">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="padding: 7px 0; color: #64748b; border-bottom: 1px solid #f1f5f9;">Application ID</td>
            <td style="padding: 7px 0; color: #0f172a; font-weight: 700; text-align: right; border-bottom: 1px solid #f1f5f9;">#{application_id}</td>
          </tr>
          <tr>
            <td style="padding: 7px 0; color: #64748b; border-bottom: 1px solid #f1f5f9;">Venue</td>
            <td style="padding: 7px 0; color: #0f172a; font-weight: 600; text-align: right; border-bottom: 1px solid #f1f5f9;">{venue}</td>
          </tr>
          <tr>
            <td style="padding: 7px 0; color: #64748b; border-bottom: 1px solid #f1f5f9;">Event Title</td>
            <td style="padding: 7px 0; color: #0f172a; font-weight: 600; text-align: right; border-bottom: 1px solid #f1f5f9;">{event_purpose}</td>
          </tr>
          <tr>
            <td style="padding: 7px 0; color: #64748b; border-bottom: 1px solid #f1f5f9;">Scheduled Time</td>
            <td style="padding: 7px 0; color: #0f172a; font-weight: 600; text-align: right; border-bottom: 1px solid #f1f5f9;">{timing}</td>
          </tr>
          <tr>
            <td style="padding: 7px 0; color: #64748b;">Decision / Status</td>
            <td style="padding: 7px 0; color: {badge_color}; font-weight: 700; text-align: right;">{status.upper()}</td>
          </tr>
        </table>
      </div>

      {remarks_html}

      <div style="margin-top: 24px; text-align: center;">
        <a href="{booking_url}" class="cta-button" style="color: #ffffff !important;">Open Booking Details &rarr;</a>
      </div>
    </div>
    <div class="footer">
      COEP Technological University &bull; VenueFlow Campus Operations<br>
      This is an automated notification. Please do not reply directly to this email.
    </div>
  </div>
</body>
</html>"""


async def send_status_update_email(
    to_email: str,
    user_name: str,
    application_id: int,
    venue_name: str,
    purpose: str,
    status: str,
    time_slot_str: str,
    remarks: str | None = None,
) -> bool:
    """
    Send an email notification to the applicant when their booking application status changes.
    Delivers via SMTP if SMTP_ENABLED is True, or logs cleanly in development if False.
    """
    if not to_email:
        logger.warning(f"No recipient email for application #{application_id}; skipping notification.")
        return False

    status_titles = {
        "approved": "Booking Approved",
        "rejected": "Booking Not Approved",
        "submitted": "Booking Request Received",
        "cancelled": "Booking Cancelled",
    }
    action = status_titles.get(status.lower(), f"Booking {status.capitalize()}")
    subject = f"{action}: #{application_id} - {purpose} ({venue_name})"

    if not settings.SMTP_ENABLED:
        logger.info(
            f"[SIMULATED EMAIL] To: {to_email} | Subject: {subject} | "
            f"Status: {status.upper()} | Remarks: {remarks or 'None'}"
        )
        return False

    try:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = to_email

        plain_text = (
            f"COEP VenueFlow - Booking #{application_id}\n\n"
            f"Hello {user_name or 'COEP Member'},\n\n"
            f"Status: {status.upper()}\n"
            f"Venue: {venue_name}\n"
            f"Event: {purpose}\n"
            f"Time: {time_slot_str}\n"
        )
        if remarks:
            plain_text += f"Reviewer Remarks: {remarks}\n"

        html_content = create_status_update_html(
            user_name=user_name,
            application_id=application_id,
            venue_name=venue_name,
            purpose=purpose,
            status=status,
            time_slot_str=time_slot_str,
            remarks=remarks,
        )

        msg.set_content(plain_text)
        msg.add_alternative(html_content, subtype="html")

        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=settings.SMTP_USE_TLS,
            timeout=15,
        )
        logger.info(f"Status update email ({status}) delivered to {to_email} for booking #{application_id}")
        return True
    except Exception as err:
        logger.error(f"Failed to deliver status update email to {to_email}: {err}")
        return False
