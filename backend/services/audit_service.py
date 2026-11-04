import uuid
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from backend.database import get_db

class AuditService:
    """
    Immutable audit logging service for all scans, overrides, flag resolutions,
    and approval pipeline actions. (Section 6.2 Security and Privacy Measures)
    """

    @classmethod
    def log(
        cls,
        org_id: str,
        user_id: str,
        action: str,
        details: Dict[str, Any],
        draft_id: Optional[str] = None
    ) -> str:
        log_id = str(uuid.uuid4())
        timestamp = datetime.utcnow().isoformat() + "Z"
        details_json = json.dumps(details)

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO audit_logs (id, org_id, draft_id, user_id, action, details, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (log_id, org_id, draft_id, user_id, action, details_json, timestamp))

        return log_id

    @classmethod
    def get_logs_for_draft(cls, draft_id: str) -> List[Dict[str, Any]]:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT a.*, u.name as user_name, u.role as user_role
                FROM audit_logs a
                LEFT JOIN users u ON a.user_id = u.id
                WHERE a.draft_id = ?
                ORDER BY a.timestamp DESC
            """, (draft_id,))
            rows = cursor.fetchall()

        logs = []
        for r in rows:
            entry = dict(r)
            try:
                entry['details'] = json.loads(entry['details'])
            except Exception:
                pass
            logs.append(entry)
        return logs

    @classmethod
    def get_recent_logs(cls, org_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT a.*, u.name as user_name, u.role as user_role, d.title as draft_title
                FROM audit_logs a
                LEFT JOIN users u ON a.user_id = u.id
                LEFT JOIN drafts d ON a.draft_id = d.id
                WHERE a.org_id = ?
                ORDER BY a.timestamp DESC
                LIMIT ?
            """, (org_id, limit))
            rows = cursor.fetchall()

        logs = []
        for r in rows:
            entry = dict(r)
            try:
                entry['details'] = json.loads(entry['details'])
            except Exception:
                pass
            logs.append(entry)
        return logs
