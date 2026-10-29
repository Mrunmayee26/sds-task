"""Run an isolated API for manual browser testing. Never uses Supabase."""

import os
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

import pgserver
import psycopg2
import uvicorn

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))


def main():
    with TemporaryDirectory(prefix="venueflow-browser-") as folder:
        server = pgserver.get_server(folder, cleanup_mode="stop")
        os.environ["DATABASE_URL"] = server.get_uri()
        os.environ["JWT_SECRET_KEY"] = "local-browser-test-secret-only-0123456789"
        os.environ["SMTP_ENABLED"] = "false"
        os.environ["CORS_ORIGINS"] = "http://127.0.0.1:5174"
        os.environ["REDIS_URL"] = "redis://isolated-browser-test/15"
        from app.core import cache
        import fakeredis

        test_cache = fakeredis.FakeRedis(decode_responses=True)
        cache.client_for_url = lambda url: test_cache
        from app.core.security import hash_password

        with psycopg2.connect(server.get_uri()) as conn:
            with conn.cursor() as cur:
                cur.execute((BACKEND / "tests/fixtures/schema.sql").read_text())
                cur.execute((BACKEND / "sql/001_admin_workflow.sql").read_text())
                cur.execute((BACKEND / "tests/fixtures/catalog.sql").read_text())
                for name, role in [
                    ("Test Applicant", "applicant"),
                    ("Test Reviewer", "faculty"),
                ]:
                    cur.execute(
                        "INSERT INTO users (full_name, email, user_type, password_hash) VALUES (%s, %s, %s, %s)",
                        (
                            name,
                            (
                                "applicant@coep.ac.in"
                                if role == "applicant"
                                else "reviewer@coep.ac.in"
                            ),
                            role,
                            hash_password("BrowserTest42"),
                        ),
                    )
                cur.execute(
                    "INSERT INTO group_members (access_id, user_id, member_role, can_approve) VALUES (1, 2, 'Reviewer', TRUE)"
                )
                cur.execute(
                    "INSERT INTO users(full_name,email,user_type,password_hash) VALUES('Test Administrator','admin@coep.ac.in','admin',%s)",
                    (hash_password("BrowserTest42"),),
                )
        try:
            uvicorn.run("app.main:app", host="127.0.0.1", port=8001)
        finally:
            server.cleanup()


if __name__ == "__main__":
    main()
