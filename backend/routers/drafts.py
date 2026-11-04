import uuid
import shutil
from pathlib import Path
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Header
from backend.database import get_db
from backend.config import settings
from backend.schemas import (
    DraftCreate, DraftUpdate, DraftDetail, RevisionItem, FlagItem,
    ScanResponse, ApprovalDecisionRequest, CommentCreate
)
from backend.services.scanner import Scanner
from backend.services.audit_service import AuditService

router = APIRouter(prefix="/api/drafts", tags=["drafts"])

@router.get("", response_model=List[DraftDetail])
def list_drafts(org_id: str = "org_inkloom", status: Optional[str] = None):
    with get_db() as conn:
        cursor = conn.cursor()
        query = """
            SELECT d.*, u.name as author_name
            FROM drafts d
            LEFT JOIN users u ON d.author_id = u.id
            WHERE d.org_id = ?
        """
        params = [org_id]
        if status:
            query += " AND d.status = ?"
            params.append(status)

        query += " ORDER BY d.updated_at DESC"
        cursor.execute(query, params)
        draft_rows = cursor.fetchall()

        results = []
        for d in draft_rows:
            d_dict = dict(d)
            # Fetch latest revision
            cursor.execute("""
                SELECT * FROM revisions
                WHERE draft_id = ?
                ORDER BY version_num DESC LIMIT 1
            """, (d['id'],))
            rev_row = cursor.fetchone()
            latest_rev = None
            if rev_row:
                cursor.execute("SELECT * FROM flags WHERE revision_id = ?", (rev_row['id'],))
                flags = cursor.fetchall()
                latest_rev = {**rev_row, "flags": flags}

            d_dict['latest_revision'] = latest_rev
            d_dict['history'] = []
            results.append(d_dict)

        return results

@router.post("", response_model=DraftDetail)
def create_draft(
    draft_in: DraftCreate,
    org_id: str = "org_inkloom",
    x_user_id: str = Header("user_riya")
):
    draft_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat() + "Z"
    content_text = draft_in.content_text or ""

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO drafts (id, org_id, author_id, title, content_type, current_version, status, content_ref, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'text', 1, 'Submitted', ?, ?, ?)
        """, (draft_id, org_id, x_user_id, draft_in.title, content_text, now, now))

    AuditService.log(org_id, x_user_id, "draft_created", {"title": draft_in.title, "type": "text"}, draft_id=draft_id)

    # Immediately run initial automated scan
    Scanner.scan_draft(draft_id, x_user_id, content_text=content_text)

    return get_draft(draft_id)

@router.post("/upload-image", response_model=DraftDetail)
async def upload_image_draft(
    title: str = Form(...),
    file: UploadFile = File(...),
    org_id: str = Form("org_inkloom"),
    x_user_id: str = Header("user_riya")
):
    draft_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat() + "Z"

    # Save image file
    file_ext = Path(file.filename).suffix or ".png"
    saved_filename = f"{draft_id}{file_ext}"
    dest_path = settings.STATIC_UPLOAD_DIR / saved_filename
    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    relative_url = f"/static/uploads/{saved_filename}"

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO drafts (id, org_id, author_id, title, content_type, current_version, status, content_ref, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'image', 1, 'Submitted', ?, ?, ?)
        """, (draft_id, org_id, x_user_id, title, relative_url, now, now))

    AuditService.log(org_id, x_user_id, "draft_image_uploaded", {"title": title, "filename": file.filename}, draft_id=draft_id)

    # Run scanner on image
    Scanner.scan_draft(draft_id, x_user_id, image_path=str(dest_path))

    return get_draft(draft_id)

@router.get("/{draft_id}", response_model=DraftDetail)
def get_draft(draft_id: str):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT d.*, u.name as author_name
            FROM drafts d
            LEFT JOIN users u ON d.author_id = u.id
            WHERE d.id = ?
        """, (draft_id,))
        draft = cursor.fetchone()
        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")

        cursor.execute("""
            SELECT * FROM revisions
            WHERE draft_id = ?
            ORDER BY version_num DESC
        """, (draft_id,))
        rev_rows = cursor.fetchall()

        history = []
        for r in rev_rows:
            cursor.execute("SELECT * FROM flags WHERE revision_id = ? ORDER BY confidence DESC", (r['id'],))
            flags = cursor.fetchall()
            history.append({**r, "flags": flags})

        latest_revision = history[0] if history else None

        return {
            **draft,
            "latest_revision": latest_revision,
            "history": history
        }

@router.put("/{draft_id}")
def update_draft(
    draft_id: str,
    update_in: DraftUpdate,
    x_user_id: str = Header("user_riya")
):
    now = datetime.utcnow().isoformat() + "Z"
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM drafts WHERE id = ?", (draft_id,))
        draft = cursor.fetchone()
        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")

        title = update_in.title or draft['title']
        content_text = update_in.content_text if update_in.content_text is not None else draft['content_ref']

        # Bump version number
        new_version = draft['current_version'] + 1
        cursor.execute("""
            UPDATE drafts
            SET title = ?, content_ref = ?, current_version = ?, status = 'In Revision', updated_at = ?
            WHERE id = ?
        """, (title, content_text, new_version, now, draft_id))

    AuditService.log(
        draft['org_id'], x_user_id, "draft_updated",
        {"new_version": new_version}, draft_id=draft_id
    )

    # Re-scan automatically after edits (Section 5, Step 5)
    scan_result = Scanner.scan_draft(draft_id, x_user_id, content_text=content_text)

    return {
        "status": "success",
        "draft": get_draft(draft_id),
        "scan": scan_result
    }

@router.post("/{draft_id}/scan", response_model=ScanResponse)
def scan_draft_endpoint(draft_id: str, x_user_id: str = Header("user_riya")):
    try:
        return Scanner.scan_draft(draft_id, x_user_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{draft_id}/submit")
def submit_for_approval(draft_id: str, x_user_id: str = Header("user_riya")):
    now = datetime.utcnow().isoformat() + "Z"
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM drafts WHERE id = ?", (draft_id,))
        draft = cursor.fetchone()
        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")

        cursor.execute("""
            UPDATE drafts
            SET status = 'Pending Approval', updated_at = ?
            WHERE id = ?
        """, (now, draft_id))

        cursor.execute("""
            INSERT INTO comments (id, draft_id, user_id, text, decision, timestamp)
            VALUES (?, ?, ?, 'Submitted draft for managerial sign-off and approval.', 'resubmitted', ?)
        """, (str(uuid.uuid4()), draft_id, x_user_id, now))

    AuditService.log(draft['org_id'], x_user_id, "submitted_for_approval", {}, draft_id=draft_id)
    return {"status": "success", "new_status": "Pending Approval"}

@router.post("/{draft_id}/decision")
def make_approval_decision(
    draft_id: str,
    req: ApprovalDecisionRequest,
    x_user_id: str = Header("user_alex")
):
    """
    Managerial Sign-Off & Approval Action (Section 5 Step 6 & Section 5.1):
    Decisions: 'Approved' or 'Changes Requested'
    """
    now = datetime.utcnow().isoformat() + "Z"
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM drafts WHERE id = ?", (draft_id,))
        draft = cursor.fetchone()
        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")

        decision_status = 'Approved' if req.decision == 'Approved' else 'Changes Requested'

        cursor.execute("""
            UPDATE drafts
            SET status = ?, updated_at = ?
            WHERE id = ?
        """, (decision_status, now, draft_id))

        cursor.execute("""
            INSERT INTO comments (id, draft_id, user_id, text, decision, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (str(uuid.uuid4()), draft_id, x_user_id, req.comment, 'approved' if req.decision == 'Approved' else 'changes_requested', now))

    AuditService.log(
        draft['org_id'], x_user_id, f"draft_{decision_status.lower().replace(' ', '_')}",
        {"decision": decision_status, "comment": req.comment},
        draft_id=draft_id
    )

    return {"status": "success", "decision": decision_status}

@router.get("/{draft_id}/comments")
def get_draft_comments(draft_id: str):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT c.*, u.name as user_name, u.role as user_role, u.avatar as user_avatar
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.draft_id = ?
            ORDER BY c.timestamp ASC
        """, (draft_id,))
        return cursor.fetchall()

@router.post("/{draft_id}/comments")
def post_draft_comment(draft_id: str, comment_in: CommentCreate, x_user_id: str = Header("user_riya")):
    now = datetime.utcnow().isoformat() + "Z"
    cid = str(uuid.uuid4())
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO comments (id, draft_id, user_id, text, decision, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (cid, draft_id, x_user_id, comment_in.text, comment_in.decision or 'comment', now))

    return {"id": cid, "status": "success"}
