"""Run alongside the API: python worker.py. Durable notifications are the outbox.
Email delivery is at-least-once: a crash after sending may cause a duplicate.
"""

import asyncio
import logging
from app.db.session import get_db_cursor, close_db_pool
from app.config import settings
from app.core.email import send_message
from app.core.cache import get_redis

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("venueflow.worker")


def reminders():
    with get_db_cursor() as cur:
        cur.execute("SELECT pg_try_advisory_xact_lock(617124) AS acquired")
        if not cur.fetchone()["acquired"]:
            return
        cur.execute(
            """INSERT INTO user_notifications(user_id,application_id,message)
            SELECT DISTINCT gm.user_id,a.application_id,'Reminder: booking #'||a.application_id||' is awaiting your review.'
            FROM applications a JOIN application_approvals aa USING(application_id)
            JOIN group_members gm ON gm.access_id=aa.access_id JOIN users u ON u.user_id=gm.user_id
            WHERE a.status='submitted' AND aa.status='pending' AND gm.can_approve AND gm.left_at IS NULL AND u.is_active
            AND a.applicant_user_id<>gm.user_id
            AND NOT EXISTS(SELECT 1 FROM approval_groups ag WHERE ag.access_id=gm.access_id AND ag.group_name='Faculty Advisors Committee'
                AND a.faculty_advisor_id IS NOT NULL AND a.faculty_advisor_id<>gm.user_id)
            AND a.submitted_at<NOW()-(%s * INTERVAL '1 hour')
            AND aa.approval_step=(SELECT MIN(x.approval_step) FROM application_approvals x WHERE x.application_id=a.application_id AND x.status='pending')
            AND EXISTS(SELECT 1 FROM booking_slots s WHERE s.application_id=a.application_id AND s.start_time>NOW())
            AND NOT EXISTS(SELECT 1 FROM user_notifications n WHERE n.user_id=gm.user_id AND n.application_id=a.application_id
                AND n.message LIKE 'Reminder:%%' AND n.created_at>NOW()-INTERVAL '24 hours')""",
            (settings.APPROVAL_REMINDER_HOURS,),
        )


async def deliver_batch():
    if not settings.SMTP_ENABLED:
        return
    with get_db_cursor() as cur:
        cur.execute(
            """SELECT n.notification_id,n.message,u.email FROM user_notifications n JOIN users u USING(user_id)
            WHERE n.email_sent_at IS NULL AND n.email_attempts<5 AND u.is_active
            AND (n.email_claimed_at IS NULL OR n.email_claimed_at<NOW()-INTERVAL '10 minutes')
            ORDER BY n.notification_id LIMIT 20 FOR UPDATE OF n SKIP LOCKED"""
        )
        messages = cur.fetchall()
        for row in messages:
            cur.execute(
                "UPDATE user_notifications SET email_claimed_at=NOW(),email_attempts=email_attempts+1 WHERE notification_id=%s",
                (row["notification_id"],),
            )
    for row in messages:
        sent = await send_message(row["email"], "VenueFlow update", row["message"])
        if sent:
            with get_db_cursor() as cur:
                cur.execute(
                    "UPDATE user_notifications SET email_sent_at=NOW() WHERE notification_id=%s",
                    (row["notification_id"],),
                )


async def main():
    try:
        while True:
            try:
                reminders()
                await deliver_batch()
                client = get_redis()
                if client:
                    client.set("venueflow:worker-heartbeat", "running", ex=180)
            except Exception:
                logger.exception("Notification cycle failed; retrying in 60 seconds")
            await asyncio.sleep(60)
    finally:
        close_db_pool()


if __name__ == "__main__":
    asyncio.run(main())
