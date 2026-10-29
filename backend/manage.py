"""Explicit setup and admin bootstrap. Never runs during API startup."""

import argparse
from getpass import getpass
from pathlib import Path
from app.db.session import get_db_cursor, close_db_pool
from app.core.security import hash_password


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "command", choices=["setup", "create-admin", "promote-admin", "demote-admin"]
    )
    parser.add_argument("--email", help="Existing account email for promotion/demotion")
    args = parser.parse_args()
    try:
        if args.command == "setup":
            with get_db_cursor() as cur:
                cur.execute(
                    (Path(__file__).parent / "sql/001_admin_workflow.sql").read_text()
                )
            print(
                "Additive admin tables and columns applied. Existing records preserved."
            )
        elif args.command in ("promote-admin", "demote-admin"):
            if not args.email:
                parser.error("--email is required")
            with get_db_cursor() as cur:
                cur.execute("SELECT pg_advisory_xact_lock(617125)")
                cur.execute(
                    "SELECT user_id,user_type,is_active FROM users WHERE lower(email)=%s FOR UPDATE",
                    (args.email.strip().lower(),),
                )
                user = cur.fetchone()
                if not user or not user["is_active"]:
                    parser.error("Active existing account required")
                if args.command == "demote-admin":
                    cur.execute(
                        "SELECT COUNT(*) AS count FROM users WHERE user_type='admin' AND is_active"
                    )
                    if user["user_type"] == "admin" and cur.fetchone()["count"] <= 1:
                        parser.error("Cannot remove the last active administrator")
                role = "admin" if args.command == "promote-admin" else "applicant"
                cur.execute(
                    "UPDATE users SET user_type=%s,session_version=session_version+1 WHERE user_id=%s",
                    (role, user["user_id"]),
                )
                cur.execute(
                    "INSERT INTO admin_events(actor_user_id,action,target_id,details) VALUES(%s,%s,%s,%s)",
                    (
                        user["user_id"],
                        args.command,
                        user["user_id"],
                        "Trusted owner CLI operation",
                    ),
                )
            print("Role changed. Existing sessions revoked; password unchanged.")
        else:
            email = input("Administrator email: ").strip().lower()
            name = input("Full name: ").strip()
            password = getpass("Password (at least 12 characters): ")
            if len(password) < 12 or "@" not in email or not name:
                parser.error(
                    "Valid name, email and a password of at least 12 characters required."
                )
            if password != getpass("Confirm password: "):
                parser.error("Passwords do not match.")
            with get_db_cursor() as cur:
                cur.execute(
                    """INSERT INTO users(full_name,email,user_type,password_hash) VALUES(%s,%s,'admin',%s)
                    ON CONFLICT(email) DO NOTHING RETURNING user_id""",
                    (name, email, hash_password(password)),
                )
                if not cur.fetchone():
                    parser.error(
                        "Account already exists. No account was promoted or overwritten."
                    )
            print("Administrator created. Sign in at /admin/login.")
    finally:
        close_db_pool()


if __name__ == "__main__":
    main()
