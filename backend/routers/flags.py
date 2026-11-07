from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from backend.database import get_db
from backend.schemas import FlagResolveRequest
from backend.services.audit_service import AuditService
from backend.dependencies import require_role

router = APIRouter(prefix="/api/flags", tags=["flags"])

@router.post("/{flag_id}/resolve")
def resolve_flag(
    flag_id: str,
    req: FlagResolveRequest,
    current_user: dict = Depends(require_role("creator", "admin"))
):
    x_user_id = current_user["id"]
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT f.*, r.draft_id, r.version_num, r.content_text,
                   d.org_id, d.content_type
            FROM flags f
            JOIN revisions r ON f.revision_id = r.id
            JOIN drafts d ON r.draft_id = d.id
            WHERE f.id = ? AND d.org_id = ?
        """, (flag_id, current_user["org_id"]))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Flag not found")

        draft_id = row['draft_id']
        org_id = row['org_id']
        content_type = row['content_type']
        current_text = row['content_text'] or ""
        span = row['span']
        updated_text = None

        if content_type == "text" and req.resolution in {"accepted", "edited"}:
            replacement_text = (
                req.edited_fix
                if req.resolution == "edited" and req.edited_fix is not None
                else row["fix"]
            )
            if not replacement_text or not replacement_text.strip():
                raise HTTPException(status_code=409, detail="No replacement text is available for this finding.")
            if replacement_text == span:
                raise HTTPException(status_code=409, detail="The replacement is identical to the flagged text.")
            start_idx = row.get("start_idx", -1)
            end_idx = row.get("end_idx", -1)
            has_valid_span_range = (
                isinstance(start_idx, int)
                and isinstance(end_idx, int)
                and 0 <= start_idx < end_idx <= len(current_text)
                and current_text[start_idx:end_idx] == span
            )
            if has_valid_span_range:
                span_start = start_idx
            elif span:
                span_start = current_text.find(span)
                if span_start >= 0 and current_text.find(span, span_start + len(span)) >= 0:
                    raise HTTPException(
                        status_code=409,
                        detail="This finding matches multiple text locations. Re-scan the latest revision before resolving it.",
                    )
            else:
                span_start = -1
            if span_start < 0:
                raise HTTPException(
                    status_code=409,
                    detail="This finding no longer matches the draft text. Re-scan the latest revision before resolving it.",
                )
            span_end = span_start + len(span)
            updated_text = current_text[:span_start] + replacement_text + current_text[span_end:]
            if updated_text != current_text:
                cursor.execute(
                    "UPDATE drafts SET content_ref = ?, updated_at = ? WHERE id = ?",
                    (updated_text, now, draft_id),
                )
        elif content_type != "text" and req.resolution == "edited":
            raise HTTPException(
                status_code=409,
                detail="Text replacements cannot edit uploaded media. Update the source asset and upload a new revision.",
            )

        # Update flag record
        cursor.execute("""
            UPDATE flags
            SET resolution = ?, resolution_comment = ?, resolved_by = ?, resolved_at = ?
            WHERE id = ?
        """, (req.resolution, req.comment, x_user_id, now, flag_id))

    AuditService.log(
        org_id, x_user_id, f"flag_{req.resolution}",
        {
            "flag_id": flag_id,
            "rule_id": row['rule_id'],
            "span": span,
            "resolution": req.resolution,
            "content_type": content_type,
            "suggestion_applied_to_text": updated_text is not None and updated_text != current_text,
            "comment": req.comment
        },
        draft_id=draft_id
    )

    return {
        "status": "success",
        "flag_id": flag_id,
        "resolution": req.resolution,
        "updated_text": updated_text,
        "rescan_required": updated_text is not None and updated_text != current_text,
        "asset_update_required": content_type != "text" and req.resolution == "accepted"
    }
