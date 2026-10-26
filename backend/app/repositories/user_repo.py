"""
Data access repository for users and approval group memberships.
"""
from typing import Any, Dict, List, Optional
from app.db.session import get_db_cursor
from app.core.security import hash_password

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
    home_unit_id: Optional[int] = None
) -> Dict[str, Any]:
    """Insert a new user record into the database."""
    query = """
        INSERT INTO users (full_name, email, password_hash, user_type, home_unit_id, is_active)
        VALUES (%s, %s, %s, %s, %s, true)
        RETURNING user_id, full_name, email, user_type, home_unit_id, is_active, created_at;
    """
    with get_db_cursor(commit=True) as cur:
        cur.execute(query, (full_name.strip(), email.strip().lower(), password_hash, user_type, home_unit_id))
        return dict(cur.fetchone())

def assign_user_to_group(
    user_id: int,
    access_id: int,
    member_role: str = "Member",
    can_approve: bool = True
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

def ensure_default_accounts() -> None:
    """Ensure baseline test accounts exist in the database with valid hashed passwords."""
    # 1. Default Applicant (Maya Kulkarni - Student Lead)
    applicant_email = "applicant@venueflow.test"
    existing_applicant = get_user_by_email(applicant_email)
    if not existing_applicant:
        create_user(
            full_name="Maya Kulkarni",
            email=applicant_email,
            password_hash=hash_password("ApplicantDemo!42"),
            user_type="applicant",
            home_unit_id=None
        )

    # 2. Default Approver (Dr. Sharma - Estate & Approvals)
    approver_email = "approver@venueflow.test"
    existing_approver = get_user_by_email(approver_email)
    if not existing_approver:
        approver = create_user(
            full_name="Dr. Sharma",
            email=approver_email,
            password_hash=hash_password("ApproverDemo!42"),
            user_type="approver",
            home_unit_id=None
        )
        approver_id = approver["user_id"]
    else:
        approver_id = existing_approver["user_id"]

    # Explicit local demo only: use configured groups, never assume fixed IDs.
    with get_db_cursor(commit=False) as cur:
        cur.execute("SELECT access_id FROM approval_groups WHERE is_active")
        group_ids = [row["access_id"] for row in cur.fetchall()]
    for access_id in group_ids:
        assign_user_to_group(approver_id, access_id=access_id, member_role="Demo Approver", can_approve=True)
