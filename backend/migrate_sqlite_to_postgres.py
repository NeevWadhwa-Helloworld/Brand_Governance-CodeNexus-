"""Copy the local SQLite dataset into a PostgreSQL/pgvector database.

Run after setting DATABASE_URL to the destination PostgreSQL URL:
    python -m backend.migrate_sqlite_to_postgres
"""

import sqlite3
from backend.config import settings
from backend.database import get_db, init_db

TABLES = (
    "organizations", "users", "guideline_versions", "rules",
    "terminology_entries", "approved_facts", "brand_colors", "brand_logos",
    "drafts", "revisions", "flags", "comments", "audit_logs",
)

def migrate():
    if not settings.is_postgres:
        raise RuntimeError("Set DATABASE_URL to a PostgreSQL URL before running this command.")
    source = sqlite3.connect(str(settings.DB_PATH))
    source.row_factory = sqlite3.Row
    init_db()
    with get_db() as destination:
        cursor = destination.cursor()
        for table in TABLES:
            rows = source.execute(f"SELECT * FROM {table}").fetchall()
            if not rows:
                continue
            columns = rows[0].keys()
            placeholders = ", ".join("?" for _ in columns)
            column_sql = ", ".join(columns)
            for row in rows:
                values = [row[column] for column in columns]
                cursor.execute(
                    f"INSERT INTO {table} ({column_sql}) VALUES ({placeholders}) ON CONFLICT DO NOTHING",
                    values,
                )
            print(f"Migrated {len(rows)} rows from {table}")
    source.close()

if __name__ == "__main__":
    migrate()
