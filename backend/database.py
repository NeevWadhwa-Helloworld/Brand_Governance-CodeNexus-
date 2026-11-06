import os
import sqlite3
import json
import hashlib
from contextlib import contextmanager
from datetime import datetime
from backend.config import settings

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:  # SQLite-only local installs remain supported.
    psycopg = None
    dict_row = None

def dict_factory(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d

class PostgresCursor:
    def __init__(self, cursor):
        self._cursor = cursor

    @staticmethod
    def _sql(statement: str) -> str:
        return statement.replace("?", "%s")

    def execute(self, statement, params=None):
        self._cursor.execute(self._sql(statement), params or ())
        return self

    def fetchone(self):
        return self._cursor.fetchone()

    def fetchall(self):
        return self._cursor.fetchall()

class PostgresConnection:
    def __init__(self, connection):
        self._connection = connection

    def cursor(self):
        return PostgresCursor(self._connection.cursor())

    def commit(self):
        self._connection.commit()

    def rollback(self):
        self._connection.rollback()

    def close(self):
        self._connection.close()

@contextmanager
def get_db():
    if settings.is_postgres:
        if psycopg is None:
            raise RuntimeError("PostgreSQL requires psycopg[binary]. Install project requirements.")
        conn = psycopg.connect(settings.DATABASE_URL, row_factory=dict_row)
        db = PostgresConnection(conn)
    else:
        conn = sqlite3.connect(str(settings.DB_PATH), timeout=20.0)
        conn.row_factory = dict_factory
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.execute("PRAGMA journal_mode = WAL;")
        db = conn
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        conn.close()

def init_db():
    if settings.is_postgres:
        _init_postgres_db()
        return
    _init_sqlite_db()

def _init_postgres_db():
    if psycopg is None:
        raise RuntimeError("PostgreSQL requires psycopg[binary]. Install project requirements.")
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("CREATE EXTENSION IF NOT EXISTS vector")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS organizations (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('creator', 'reviewer', 'admin')),
            avatar TEXT, created_at TEXT NOT NULL, password_hash TEXT
        );
        CREATE TABLE IF NOT EXISTS guideline_versions (
            id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            version TEXT NOT NULL, title TEXT NOT NULL, raw_content TEXT,
            is_active INTEGER DEFAULT 1, uploaded_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS rules (
            id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES guideline_versions(id) ON DELETE CASCADE,
            org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            rule_id TEXT NOT NULL, category TEXT NOT NULL CHECK(category IN
            ('tone', 'terminology', 'facts', 'claims', 'color', 'logo', 'accessibility')),
            title TEXT NOT NULL, text TEXT NOT NULL, details TEXT, embedding_json TEXT,
            embedding vector(768), is_active INTEGER DEFAULT 1, created_at TEXT NOT NULL,
            UNIQUE(version_id, rule_id)
        );
        CREATE TABLE IF NOT EXISTS terminology_entries (
            id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            version_id TEXT NOT NULL REFERENCES guideline_versions(id) ON DELETE CASCADE,
            banned_term TEXT NOT NULL, preferred_term TEXT NOT NULL, context TEXT,
            severity TEXT DEFAULT 'warning'
        );
        CREATE TABLE IF NOT EXISTS approved_facts (
            id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            version_id TEXT NOT NULL REFERENCES guideline_versions(id) ON DELETE CASCADE,
            fact_key TEXT NOT NULL, claim_text TEXT NOT NULL, approved_metric TEXT NOT NULL,
            citation TEXT NOT NULL, last_updated TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS brand_colors (
            id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            version_id TEXT NOT NULL REFERENCES guideline_versions(id) ON DELETE CASCADE,
            name TEXT NOT NULL, hex_code TEXT NOT NULL, role TEXT NOT NULL,
            min_contrast REAL DEFAULT 4.5
        );
        CREATE TABLE IF NOT EXISTS brand_logos (
            id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            version_id TEXT NOT NULL REFERENCES guideline_versions(id) ON DELETE CASCADE,
            name TEXT NOT NULL, file_path TEXT NOT NULL, file_hash TEXT NOT NULL,
            aspect_ratio REAL, min_clearance_pct REAL DEFAULT 10.0
        );
        CREATE TABLE IF NOT EXISTS drafts (
            id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL,
            content_type TEXT NOT NULL CHECK(content_type IN ('text', 'image', 'audio', 'video')),
            current_version INTEGER DEFAULT 1, status TEXT NOT NULL, content_ref TEXT,
            media_metadata TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS revisions (
            id TEXT PRIMARY KEY, draft_id TEXT NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
            version_num INTEGER NOT NULL, content_text TEXT, image_path TEXT,
            compliance_score REAL DEFAULT 0.0, policy_coverage_status TEXT DEFAULT 'covered',
            policy_coverage_reason TEXT, media_analysis TEXT, created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS flags (
            id TEXT PRIMARY KEY, revision_id TEXT NOT NULL REFERENCES revisions(id) ON DELETE CASCADE,
            rule_id TEXT NOT NULL, category TEXT NOT NULL, span TEXT NOT NULL,
            start_idx INTEGER DEFAULT -1, end_idx INTEGER DEFAULT -1, start_time REAL,
            end_time REAL, frame_number INTEGER, explanation TEXT NOT NULL, fix TEXT NOT NULL,
            confidence REAL NOT NULL, resolution TEXT DEFAULT 'pending',
            resolution_comment TEXT, resolved_by TEXT, resolved_at TEXT, layer TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS comments (
            id TEXT PRIMARY KEY, draft_id TEXT NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, text TEXT NOT NULL,
            decision TEXT, timestamp TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY, org_id TEXT NOT NULL, draft_id TEXT, user_id TEXT NOT NULL,
            action TEXT NOT NULL, details TEXT NOT NULL, timestamp TEXT NOT NULL,
            previous_hash TEXT, entry_hash TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_rules_version ON rules(version_id);
        CREATE INDEX IF NOT EXISTS idx_flags_revision ON flags(revision_id);
        CREATE INDEX IF NOT EXISTS idx_drafts_org ON drafts(org_id);
        CREATE INDEX IF NOT EXISTS idx_audit_draft ON audit_logs(draft_id);
        """)
        cursor.execute("ALTER TABLE rules ADD COLUMN IF NOT EXISTS embedding_json TEXT")
        cursor.execute(
            "ALTER TABLE rules ADD COLUMN IF NOT EXISTS embedding vector(768)"
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_rules_embedding ON rules "
            "USING hnsw (embedding vector_cosine_ops) WHERE embedding IS NOT NULL"
        )

def _init_sqlite_db():
    with get_db() as conn:
        cursor = conn.cursor()

        # 1. Organizations
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS organizations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            created_at TEXT NOT NULL
        );
        """)

        # 2. Users
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            role TEXT CHECK(role IN ('creator', 'reviewer', 'admin')) NOT NULL,
            avatar TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
        );
        """)
        cursor.execute("PRAGMA table_info(users)")
        user_columns = {row["name"] for row in cursor.fetchall()}
        if "password_hash" not in user_columns:
            cursor.execute("ALTER TABLE users ADD COLUMN password_hash TEXT")
        default_password_hash = hashlib.pbkdf2_hmac(
            "sha256", b"inkloom-demo", settings.SECRET_KEY.encode(), 120_000
        ).hex()
        cursor.execute(
            "UPDATE users SET password_hash = ? WHERE password_hash IS NULL",
            (default_password_hash,)
        )

        # 3. Guideline Versions
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS guideline_versions (
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL,
            version TEXT NOT NULL,
            title TEXT NOT NULL,
            raw_content TEXT,
            is_active INTEGER DEFAULT 1,
            uploaded_at TEXT NOT NULL,
            FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
        );
        """)

        # 4. Rules
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS rules (
            id TEXT PRIMARY KEY,
            version_id TEXT NOT NULL,
            org_id TEXT NOT NULL,
            rule_id TEXT NOT NULL,
            category TEXT CHECK(category IN ('tone', 'terminology', 'facts', 'claims', 'color', 'logo', 'accessibility')) NOT NULL,
            title TEXT NOT NULL,
            text TEXT NOT NULL,
            details TEXT,
            embedding_json TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT NOT NULL,
            FOREIGN KEY (version_id) REFERENCES guideline_versions(id) ON DELETE CASCADE,
            FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
            UNIQUE(version_id, rule_id)
        );
        """)

        # 5. Terminology Entries
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS terminology_entries (
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL,
            version_id TEXT NOT NULL,
            banned_term TEXT NOT NULL,
            preferred_term TEXT NOT NULL,
            context TEXT,
            severity TEXT DEFAULT 'warning',
            FOREIGN KEY (version_id) REFERENCES guideline_versions(id) ON DELETE CASCADE,
            FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
        );
        """)

        # 6. Approved Facts
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS approved_facts (
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL,
            version_id TEXT NOT NULL,
            fact_key TEXT NOT NULL,
            claim_text TEXT NOT NULL,
            approved_metric TEXT NOT NULL,
            citation TEXT NOT NULL,
            last_updated TEXT NOT NULL,
            FOREIGN KEY (version_id) REFERENCES guideline_versions(id) ON DELETE CASCADE,
            FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
        );
        """)

        # 7. Brand Colors
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS brand_colors (
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL,
            version_id TEXT NOT NULL,
            name TEXT NOT NULL,
            hex_code TEXT NOT NULL,
            role TEXT CHECK(role IN ('primary', 'secondary', 'accent', 'neutral', 'background')) NOT NULL,
            min_contrast REAL DEFAULT 4.5,
            FOREIGN KEY (version_id) REFERENCES guideline_versions(id) ON DELETE CASCADE,
            FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
        );
        """)

        # 8. Brand Logos
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS brand_logos (
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL,
            version_id TEXT NOT NULL,
            name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_hash TEXT NOT NULL,
            aspect_ratio REAL,
            min_clearance_pct REAL DEFAULT 10.0,
            FOREIGN KEY (version_id) REFERENCES guideline_versions(id) ON DELETE CASCADE,
            FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
        );
        """)

        # 9. Drafts
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS drafts (
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL,
            author_id TEXT NOT NULL,
            title TEXT NOT NULL,
            content_type TEXT CHECK(content_type IN ('text', 'image', 'audio', 'video')) NOT NULL,
            current_version INTEGER DEFAULT 1,
            status TEXT CHECK(status IN ('Submitted', 'Scanned', 'In Revision', 'Pending Approval', 'Approved', 'Changes Requested')) NOT NULL,
            content_ref TEXT,
            media_metadata TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
        );
        """)
        draft_table_sql = cursor.execute(
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'drafts'"
        ).fetchone()["sql"]
        if draft_table_sql and "'audio'" not in draft_table_sql:
            cursor.execute("PRAGMA foreign_keys = OFF")
            cursor.execute("ALTER TABLE drafts RENAME TO drafts_legacy")
            cursor.execute("""
            CREATE TABLE drafts (
                id TEXT PRIMARY KEY,
                org_id TEXT NOT NULL,
                author_id TEXT NOT NULL,
                title TEXT NOT NULL,
                content_type TEXT CHECK(content_type IN ('text', 'image', 'audio', 'video')) NOT NULL,
                current_version INTEGER DEFAULT 1,
                status TEXT CHECK(status IN ('Submitted', 'Scanned', 'In Revision', 'Pending Approval', 'Approved', 'Changes Requested')) NOT NULL,
                content_ref TEXT,
                media_metadata TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
                FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """)
            cursor.execute("""
                INSERT INTO drafts
                SELECT id, org_id, author_id, title, content_type, current_version, status,
                       content_ref, NULL, created_at, updated_at
                FROM drafts_legacy
            """)
            cursor.execute("DROP TABLE drafts_legacy")
            cursor.execute("PRAGMA foreign_keys = ON")

        # Older SQLite versions rewrite foreign-key references to the temporary
        # renamed table during the table rebuild. Keep a synchronized compatibility
        # table until those legacy references are rebuilt by a future migration.
        legacy_refs = cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type = 'table' AND sql LIKE '%drafts_legacy%'
        """).fetchall()
        if legacy_refs:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS drafts_legacy (
                    id TEXT PRIMARY KEY
                )
            """)
            cursor.execute("""
                INSERT OR IGNORE INTO drafts_legacy (id)
                SELECT id FROM drafts
            """)
            cursor.execute("""
                CREATE TRIGGER IF NOT EXISTS drafts_sync_legacy_insert
                AFTER INSERT ON drafts
                BEGIN
                    INSERT OR IGNORE INTO drafts_legacy (id) VALUES (NEW.id);
                END
            """)

        draft_columns = {row["name"] for row in cursor.execute("PRAGMA table_info(drafts)").fetchall()}
        if "media_metadata" not in draft_columns:
            cursor.execute("ALTER TABLE drafts ADD COLUMN media_metadata TEXT")
        if legacy_refs:
            cursor.execute("""
                CREATE TRIGGER IF NOT EXISTS drafts_sync_legacy_delete
                AFTER DELETE ON drafts
                BEGIN
                    DELETE FROM drafts_legacy WHERE id = OLD.id;
                END
            """)

        # 10. Revisions
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS revisions (
            id TEXT PRIMARY KEY,
            draft_id TEXT NOT NULL,
            version_num INTEGER NOT NULL,
            content_text TEXT,
            image_path TEXT,
            compliance_score REAL DEFAULT 0.0,
            policy_coverage_status TEXT DEFAULT 'covered',
            policy_coverage_reason TEXT,
            media_analysis TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (draft_id) REFERENCES drafts(id) ON DELETE CASCADE
        );
        """)
        revision_columns = {row["name"] for row in cursor.execute("PRAGMA table_info(revisions)").fetchall()}
        if "policy_coverage_status" not in revision_columns:
            cursor.execute("ALTER TABLE revisions ADD COLUMN policy_coverage_status TEXT DEFAULT 'covered'")
        if "policy_coverage_reason" not in revision_columns:
            cursor.execute("ALTER TABLE revisions ADD COLUMN policy_coverage_reason TEXT")
        if "media_analysis" not in revision_columns:
            cursor.execute("ALTER TABLE revisions ADD COLUMN media_analysis TEXT")

        # 11. Flags
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS flags (
            id TEXT PRIMARY KEY,
            revision_id TEXT NOT NULL,
            rule_id TEXT NOT NULL,
            category TEXT NOT NULL,
            span TEXT NOT NULL,
            start_idx INTEGER DEFAULT -1,
            end_idx INTEGER DEFAULT -1,
            start_time REAL,
            end_time REAL,
            frame_number INTEGER,
            explanation TEXT NOT NULL,
            fix TEXT NOT NULL,
            confidence REAL NOT NULL,
            resolution TEXT CHECK(resolution IN ('pending', 'accepted', 'edited', 'dismissed')) DEFAULT 'pending',
            resolution_comment TEXT,
            resolved_by TEXT,
            resolved_at TEXT,
            layer TEXT CHECK(layer IN ('layer1_deterministic', 'layer2_semantic')) NOT NULL,
            FOREIGN KEY (revision_id) REFERENCES revisions(id) ON DELETE CASCADE
        );
        """)
        flag_columns = {row["name"] for row in cursor.execute("PRAGMA table_info(flags)").fetchall()}
        for column, definition in (
            ("start_time", "REAL"),
            ("end_time", "REAL"),
            ("frame_number", "INTEGER"),
        ):
            if column not in flag_columns:
                cursor.execute(f"ALTER TABLE flags ADD COLUMN {column} {definition}")

        # 12. Comments / Approvals
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS comments (
            id TEXT PRIMARY KEY,
            draft_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            text TEXT NOT NULL,
            decision TEXT CHECK(decision IN ('comment', 'approved', 'changes_requested', 'resubmitted')),
            timestamp TEXT NOT NULL,
            FOREIGN KEY (draft_id) REFERENCES drafts(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        """)

        # 13. Immutable Audit Logs
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL,
            draft_id TEXT,
            user_id TEXT NOT NULL,
            action TEXT NOT NULL,
            details TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            previous_hash TEXT,
            entry_hash TEXT
        );
        """)
        cursor.execute("PRAGMA table_info(audit_logs)")
        audit_columns = {row["name"] for row in cursor.fetchall()}
        if "previous_hash" not in audit_columns:
            cursor.execute("ALTER TABLE audit_logs ADD COLUMN previous_hash TEXT")
        if "entry_hash" not in audit_columns:
            cursor.execute("ALTER TABLE audit_logs ADD COLUMN entry_hash TEXT")
        cursor.execute(
            "SELECT id, org_id, draft_id, user_id, action, details, timestamp, previous_hash, entry_hash "
            "FROM audit_logs ORDER BY org_id, timestamp ASC, id ASC"
        )
        previous_by_org = {}
        for audit_row in cursor.fetchall():
            previous = previous_by_org.get(audit_row["org_id"])
            canonical = "|".join([
                audit_row["id"], audit_row["org_id"], audit_row["draft_id"] or "",
                audit_row["user_id"], audit_row["action"], audit_row["details"],
                audit_row["timestamp"], previous or ""
            ])
            entry_hash = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
            cursor.execute(
                "UPDATE audit_logs SET previous_hash = ?, entry_hash = ? WHERE id = ?",
                (previous, entry_hash, audit_row["id"])
            )
            previous_by_org[audit_row["org_id"]] = entry_hash

        # Create helpful indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_rules_version ON rules(version_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_flags_revision ON flags(revision_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_drafts_org ON drafts(org_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_draft ON audit_logs(draft_id);")
