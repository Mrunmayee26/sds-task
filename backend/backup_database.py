"""Create a private PostgreSQL archive; restore only into a separate test DB.
Requires PostgreSQL's pg_dump. Credentials never appear in command arguments.
"""

import argparse
import os
from pathlib import Path
import shutil
import subprocess
from urllib.parse import urlparse, unquote, parse_qs
from app.config import settings


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--pg-dump", default=shutil.which("pg_dump"))
    args = parser.parse_args()
    if not args.pg_dump:
        parser.error("Install PostgreSQL client tools or provide --pg-dump PATH")
    output = Path(args.output).resolve()
    if output.exists():
        parser.error("Output exists; choose a new backup filename")
    output.parent.mkdir(parents=True, exist_ok=True)
    url = urlparse(settings.DATABASE_URL)
    env = os.environ.copy()
    env.update(
        PGHOST=url.hostname or "",
        PGPORT=str(url.port or 5432),
        PGUSER=unquote(url.username or ""),
        PGPASSWORD=unquote(url.password or ""),
        PGDATABASE=url.path.lstrip("/"),
        PGSSLMODE=parse_qs(url.query).get("sslmode", ["require"])[0],
    )
    result = subprocess.run(
        [
            args.pg_dump,
            "--format=custom",
            "--no-owner",
            "--no-acl",
            "--file",
            str(output),
        ],
        env=env,
        capture_output=True,
        text=True,
    )
    if result.returncode:
        raise SystemExit(
            "Backup failed. Check connectivity and PostgreSQL client compatibility; the target database was not changed."
        )
    print(f"Backup saved to {output}")


if __name__ == "__main__":
    main()
