from datetime import datetime
from fastapi import APIRouter, HTTPException, Header
from backend.database import get_db
from backend.schemas import FlagResolveRequest
from backend.services.audit_service import AuditService

router = APIRouter(prefix="/api/flags", tags=["flags"])

@router.post("/{flag_id}/resolve")
def resolve_flag(
    flag_id: str,
    req: FlagResolveRequest,
    x_user_id: str = Header("user_riya")
):
    """
    Human-in-the-Loop Collaboration on AI Flags:
    - Accept: Replaces off-brand span with suggested fix
    - Edit: Replaces off-brand span with user's customized fix
    - Dismiss: Retains span and logs creator's reason/comment
    """
    now = datetime.utcnow().isoformat() + "Z"

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT f.*, r.draft_id, r.version_num, r.content_text, d.org_id
            FROM flags f
            JOIN revisions r ON f.revision_id = r.id
            JOIN drafts d ON r.draft_id = d.id
            WHERE f.id = ?
        """, (flag_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Flag not found")

        draft_id = row['draft_id']
        org_id = row['org_id']
        current_text = row['content_text'] or ""
        span = row['span']
        replacement_text = None

        if req.resolution == 'accepted':
            replacement_text = row['fix']
        elif req.resolution == 'edited':
            replacement_text = req.edited_fix or row['fix']
        elif req.resolution == 'dismissed':
            replacement_text = None

        updated_text = current_text
        if replacement_text and span in current_text:
            # Replace offending span with fix
            updated_text = current_text.replace(span, replacement_text, 1)

            # Update revision text and draft content_ref
            cursor.execute("""
                UPDATE revisions SET content_text = ? WHERE id = ?
            """, (updated_text, row['revision_id']))

            cursor.execute("""
                UPDATE drafts SET content_ref = ?, updated_at = ? WHERE id = ?
            """, (updated_text, now, draft_id))

        # Update flag record
        cursor.execute("""
            UPDATE flags
            SET resolution = ?, resolution_comment = ?, resolved_by = ?, resolved_at = ?
            WHERE id = ?
        """, (req.resolution, req.comment, x_user_id, now, flag_id))

        # Re-evaluate compliance score on revision
        cursor.execute("""
            SELECT COUNT(*) as pending_cnt FROM flags
            WHERE revision_id = ? AND resolution = 'pending'
        """, (row['revision_id'],))
        remaining_pending = cursor.fetchone()['pending_cnt']

        new_compliance = max(20.0, round(100.0 - (remaining_pending * 14.0), 1))
        cursor.execute("UPDATE revisions SET compliance_score = ? WHERE id = ?", (new_compliance, row['revision_id']))

    AuditService.log(
        org_id, x_user_id, f"flag_{req.resolution}",
        {
            "flag_id": flag_id,
            "rule_id": row['rule_id'],
            "span": span,
            "resolution": req.resolution,
            "comment": req.comment
        },
        draft_id=draft_id
    )

    return {
        "status": "success",
        "flag_id": flag_id,
        "resolution": req.resolution,
        "updated_text": updated_text,
        "new_compliance_score": new_compliance
    }
