from fastapi import APIRouter, Depends, Query, HTTPException
from app.core.dependencies import get_current_user
from app.db.session import get_db_cursor

router = APIRouter()


@router.get("/notifications")
def notifications(
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user=Depends(get_current_user),
):
    with get_db_cursor(commit=False) as cur:
        cur.execute(
            "SELECT * FROM user_notifications WHERE user_id=%s ORDER BY created_at DESC LIMIT %s OFFSET %s",
            (user.user_id, limit, offset),
        )
        return cur.fetchall()


@router.post("/notifications/{notification_id}/read")
def mark_read(notification_id: int, user=Depends(get_current_user)):
    with get_db_cursor() as cur:
        cur.execute(
            "UPDATE user_notifications SET read_at=NOW() WHERE notification_id=%s AND user_id=%s RETURNING notification_id",
            (notification_id, user.user_id),
        )
        if not cur.fetchone():
            raise HTTPException(404, "Notification not found")
    return {"read": True}
