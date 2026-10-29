"""
Data access repository for users and approval group memberships.
"""

from typing import Any, Dict, List, Optional
from app.db.session import get_db_cursor


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Retrieve user record along with department/unit name by email."""
    query = """
        SELECT 
            u.user_id,
            u.full_name,
            u.email,
            u.user_type,
            u.home_unit_id,
            ou.unit_name,
            u.password_hash,
            u.is_active,
            u.created_at
            , u.session_version
        FROM users u
        LEFT JOIN organizational_units ou ON u.home_unit_id = ou.unit_id
        WHERE LOWER(u.email) = LOWER(%s);
    """
    with get_db_cursor(commit=False) as cur:
        cur.execute(query, (email.strip(),))
        row = cur.fetchone()
        return dict(row) if row else None


def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    """Retrieve user record by user_id."""
    query = """
        SELECT 
            u.user_id,
            u.full_name,
            u.email,
            u.user_type,
            u.home_unit_id,
            ou.unit_name,
            u.password_hash,
            u.is_active,
            u.created_at
            , u.session_version
        FROM users u
        LEFT JOIN organizational_units ou ON u.home_unit_id = ou.unit_id
        WHERE u.user_id = %s;
    """
    with get_db_cursor(commit=False) as cur:
        cur.execute(query, (user_id,))
        row = cur.fetchone()
        return dict(row) if row else None


def get_user_approval_groups(user_id: int) -> List[Dict[str, Any]]:
    """Fetch all approval groups the user belongs to with review privileges."""
    query = """
        SELECT 
            ag.access_id,
            ag.group_name,
            gm.member_role,
            gm.can_approve
        FROM group_members gm
        JOIN approval_groups ag ON gm.access_id = ag.access_id
        WHERE gm.user_id = %s AND ag.is_active = true AND gm.left_at IS NULL;
    """
    with get_db_cursor(commit=False) as cur:
        cur.execute(query, (user_id,))
        return [dict(r) for r in cur.fetchall()]


def create_user(
    full_name: str,
    email: str,
    password_hash: str,
    user_type: str = "applicant",
    home_unit_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Insert a new user record into the database."""
    query = """
        INSERT INTO users (full_name, email, password_hash, user_type, home_unit_id, is_active)
        VALUES (%s, %s, %s, %s, %s, true)
        RETURNING user_id, full_name, email, user_type, home_unit_id, is_active, created_at;
    """
    with get_db_cursor(commit=True) as cur:
        cur.execute(
            query,
            (
                full_name.strip(),
                email.strip().lower(),
                password_hash,
                user_type,
                home_unit_id,
            ),
        )
        return dict(cur.fetchone())


def assign_user_to_group(
    user_id: int, access_id: int, member_role: str = "Member", can_approve: bool = True
) -> None:
    """Assign user to an approval group with approval privileges."""
    query = """
        INSERT INTO group_members (access_id, user_id, member_role, can_approve, joined_at)
        VALUES (%s, %s, %s, %s, NOW())
        ON CONFLICT (access_id, user_id) 
        DO UPDATE SET can_approve = EXCLUDED.can_approve, member_role = EXCLUDED.member_role;
    """
    with get_db_cursor(commit=True) as cur:
        cur.execute(query, (access_id, user_id, member_role, can_approve))
