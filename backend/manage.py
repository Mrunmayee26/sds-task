"""Explicit database setup commands. Run from the backend directory."""
import argparse
from pathlib import Path
from urllib.parse import urlparse

from app.config import settings
from app.db.session import get_db_cursor, close_db_pool
from app.repositories.user_repo import ensure_default_accounts


def main():
    parser = argparse.ArgumentParser(description="Set up the VenueFlow database")
    parser.add_argument("command", choices=["init-local", "seed-local"])
    command = parser.parse_args().command
    sql_dir = Path(__file__).parent / "sql"

    # Remote Supabase data is never replaced or seeded by local demo commands.
    if urlparse(settings.DATABASE_URL).hostname not in ("localhost", "127.0.0.1", "::1"):
        parser.error("Local setup commands require a local DATABASE_URL.")

    try:
        if command == "init-local":
            files = [sql_dir / "schema.sql"]
        else:
            files = [sql_dir / "demo_catalog.sql"]
        for path in files:
            with get_db_cursor() as cur:
                cur.execute(path.read_text(encoding="utf-8"))
            print(f"Applied {path.name}")
        if command == "seed-local":
            ensure_default_accounts()
            print("Created local demo applicant and approver accounts (see README).")
    finally:
        close_db_pool()


if __name__ == "__main__":
    main()
