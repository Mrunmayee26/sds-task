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


def get_all_organizational_units() -> List[Dict[str, Any]]:
    """Retrieve all campus departments and administrative units."""
    query = """
        SELECT unit_id, unit_name, unit_code, unit_type
        FROM organizational_units
        ORDER BY unit_name ASC;
    """
    with get_db_cursor(commit=False) as cur:
        cur.execute(query)
        return [dict(r) for r in cur.fetchall()]


def get_approval_group_for_unit(unit_id: int) -> Optional[int]:
    """Find the primary approval group mapped to an organizational unit."""
    query = """
        SELECT access_id
        FROM approval_groups
        WHERE unit_id = %s AND is_active = true
        ORDER BY access_id ASC
        LIMIT 1;
    """
    with get_db_cursor(commit=False) as cur:
        cur.execute(query, (unit_id,))
        row = cur.fetchone()
        return row["access_id"] if row else None


def update_user_profile(
    user_id: int, full_name: str, home_unit_id: Optional[int] = None
) -> Optional[Dict[str, Any]]:
    """Update user's display name and home organizational unit."""
    query = """
        UPDATE users
        SET full_name = %s, home_unit_id = %s
        WHERE user_id = %s
        RETURNING user_id, full_name, email, user_type, home_unit_id, is_active;
    """
    with get_db_cursor(commit=True) as cur:
        cur.execute(query, (full_name.strip(), home_unit_id, user_id))
        row = cur.fetchone()
        return dict(row) if row else None


def get_all_faculty_advisors() -> List[Dict[str, Any]]:
    """Retrieve all active faculty advisors."""
    query = """
        SELECT u.user_id, u.full_name, u.email, u.home_unit_id, ou.unit_name, gm.member_role
        FROM users u
        JOIN group_members gm ON gm.user_id = u.user_id
        JOIN approval_groups ag ON ag.access_id = gm.access_id
        LEFT JOIN organizational_units ou ON ou.unit_id = u.home_unit_id
        WHERE ag.group_name = 'Faculty Advisors Committee' AND u.is_active = true AND gm.can_approve = true AND gm.left_at IS NULL AND ag.is_active
        ORDER BY u.full_name ASC;
    """
    with get_db_cursor(commit=False) as cur:
        cur.execute(query)
        return [dict(r) for r in cur.fetchall()]
