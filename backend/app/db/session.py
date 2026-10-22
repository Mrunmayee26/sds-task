import logging
from contextlib import contextmanager
from typing import Generator
import psycopg2
from psycopg2.pool import ThreadedConnectionPool
from psycopg2.extras import RealDictCursor
from app.config import settings

logger = logging.getLogger("venueflow.db")

_pool: ThreadedConnectionPool | None = None

def init_db_pool() -> ThreadedConnectionPool:
    """Initialize the ThreadedConnectionPool for psycopg2."""
    global _pool
    if _pool is None or _pool.closed:
        try:
            logger.info("Initializing Supabase PostgreSQL connection pool...")
            _pool = ThreadedConnectionPool(
                minconn=settings.DB_MIN_CONNECTIONS,
                maxconn=settings.DB_MAX_CONNECTIONS,
                dsn=settings.DATABASE_URL
            )
            logger.info("PostgreSQL connection pool established successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize connection pool: {e}")
            raise
    return _pool

def close_db_pool() -> None:
    """Closes all connections in the pool on server shutdown."""
    global _pool
    if _pool and not _pool.closed:
        logger.info("Closing PostgreSQL connection pool...")
        _pool.closeall()
        _pool = None

@contextmanager
def get_db_connection() -> Generator[psycopg2.extensions.connection, None, None]:
    """
    Context manager that leases a connection from the pool and returns it upon completion.
    """
    pool = init_db_pool()
    conn = pool.getconn()
    try:
        yield conn
    finally:
        pool.putconn(conn)

@contextmanager
def get_db_cursor(commit: bool = True) -> Generator[RealDictCursor, None, None]:
    """
    Context manager yielding a RealDictCursor (returns query results as dicts).
    Automatically commits on success or rolls back on exception.
    """
    with get_db_connection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        try:
            yield cursor
            if commit:
                conn.commit()
        except Exception as e:
            conn.rollback()
            logger.error(f"Database error during transaction: {e}")
            raise
        finally:
            cursor.close()

def test_db_connection() -> dict:
    """
    Test helper to verify database connection and retrieve PostgreSQL version.
    """
    with get_db_cursor(commit=False) as cur:
        cur.execute("SELECT version();")
        res = cur.fetchone()
        return {
            "status": "connected",
            "version": res.get("version") if res else "Unknown"
        }
