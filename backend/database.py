import sqlite3
import json
from contextlib import contextmanager
from datetime import datetime
from backend.config import settings

def dict_factory(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d

@contextmanager
def get_db():
    conn = sqlite3.connect(str(settings.DB_PATH), timeout=20.0)
    conn.row_factory = dict_factory
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
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
            content_type TEXT CHECK(content_type IN ('text', 'image')) NOT NULL,
            current_version INTEGER DEFAULT 1,
            status TEXT CHECK(status IN ('Submitted', 'Scanned', 'In Revision', 'Pending Approval', 'Approved', 'Changes Requested')) NOT NULL,
            content_ref TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
        );
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
            created_at TEXT NOT NULL,
            FOREIGN KEY (draft_id) REFERENCES drafts(id) ON DELETE CASCADE
        );
        """)

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
            timestamp TEXT NOT NULL
        );
        """)

        # Create helpful indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_rules_version ON rules(version_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_flags_revision ON flags(revision_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_drafts_org ON drafts(org_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_draft ON audit_logs(draft_id);")
