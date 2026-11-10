import uuid
import shutil
import json
import logging
import mimetypes
import tempfile
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Header, Depends
from fastapi.responses import JSONResponse
from backend.database import get_db
from backend.config import settings
from backend.schemas import (
    DraftCreate, DraftUpdate, DraftDetail, RevisionItem, FlagItem,
    ScanResponse, ApprovalDecisionRequest, CommentCreate, TranscriptUpdate
)
from backend.services.scanner import Scanner
from backend.services.audit_service import AuditService
from backend.services.media_storage import MediaStorage
from backend.dependencies import require_role, get_current_user, organization_scope
from backend.services.integration_adapters import LocalIntegrationAdapter

router = APIRouter(prefix="/api/drafts", tags=["drafts"])
logger = logging.getLogger(__name__)

def _with_media_metadata(draft: dict) -> dict:
    value = draft.get("media_metadata")
    if isinstance(value, str):
        try:
            draft["media_metadata"] = json.loads(value)
        except json.JSONDecodeError:
            draft["media_metadata"] = None
    return draft

def _with_media_url(draft: dict) -> dict:
    ref = draft.get("content_ref")
    if ref and MediaStorage.is_storage_ref(ref):
        try:
            draft["media_url"] = MediaStorage.create_signed_url(ref)
        except Exception as exc:
            logger.exception("Could not sign draft media URL")
            raise HTTPException(
                status_code=503,
                detail="Draft media is temporarily unavailable.",
            ) from exc
    return draft

def _store_upload(path: Path, org_id: str, draft_id: str, original_name: str, content_type: str | None) -> str:
    if settings.MEDIA_STORAGE_BACKEND == "supabase":
        resolved_type = content_type or mimetypes.guess_type(original_name)[0] or "application/octet-stream"
        return MediaStorage.upload_file(path, org_id, draft_id, original_name, resolved_type)
    return f"/static/uploads/{path.name}"

def _media_workspace_path(workspace, fallback_path: Path) -> Path:
    return Path(workspace) / fallback_path.name if workspace else fallback_path

def _with_media_analysis(revision: dict) -> dict:
    value = revision.get("media_analysis")
    if isinstance(value, str):
        try:
            revision["media_analysis"] = json.loads(value)
        except json.JSONDecodeError:
            revision["media_analysis"] = None
    return revision

@router.get("", response_model=List[DraftDetail])
def list_drafts(org_id: Optional[str] = None, status: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    org_id = organization_scope(current_user, org_id)
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
            d_dict = _with_media_url(_with_media_metadata(dict(d)))
            # Fetch latest revision
            cursor.execute("""
                SELECT * FROM revisions
                WHERE draft_id = ?
                ORDER BY version_num DESC, created_at DESC, id DESC LIMIT 1
            """, (d['id'],))
            rev_row = cursor.fetchone()
            latest_rev = None
            if rev_row:
                cursor.execute("SELECT * FROM flags WHERE revision_id = ?", (rev_row['id'],))
                flags = cursor.fetchall()
                latest_rev = {**_with_media_analysis(dict(rev_row)), "flags": flags}

            d_dict['latest_revision'] = latest_rev
            d_dict['history'] = []
            results.append(d_dict)

        return results

@router.post("", response_model=DraftDetail)
async def create_draft(
    draft_in: DraftCreate,
    org_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    x_user_id = current_user["id"]
    org_id = organization_scope(current_user, org_id)
    draft_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat() + "Z"
    content_text = draft_in.content_text or ""

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO drafts (id, org_id, author_id, title, content_type, current_version, status, content_ref, media_metadata, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'text', 1, 'Submitted', ?, NULL, ?, ?)
        """, (draft_id, org_id, x_user_id, draft_in.title, content_text, now, now))

    AuditService.log(org_id, x_user_id, "draft_created", {"title": draft_in.title, "type": "text"}, draft_id=draft_id)

    # Immediately run initial automated scan
    try:
        await Scanner.scan_draft(draft_id, x_user_id, content_text=content_text)
    except Exception:
        logger.exception("Initial scan failed for saved draft %s", draft_id)
        return JSONResponse(
            status_code=503,
            content={
                "detail": (
                    "The draft was saved, but its initial scan failed. "
                    "Open it in Draft Studio and select Re-scan."
                ),
                "draft_id": draft_id,
            },
        )

    return get_draft(draft_id, current_user)

@router.post("/upload-image", response_model=DraftDetail)
async def upload_image_draft(
    title: str = Form(...),
    file: UploadFile = File(...),
    org_id: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    x_user_id = current_user["id"]
    org_id = organization_scope(current_user, org_id)
    draft_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat() + "Z"

    file_ext = Path(file.filename).suffix or ".png"
    saved_filename = f"{draft_id}{file_ext}"
    with tempfile.TemporaryDirectory(prefix="draft-upload-") as temp_dir:
        dest_path = _media_workspace_path(
            temp_dir if settings.MEDIA_STORAGE_BACKEND == "supabase" else None,
            settings.STATIC_UPLOAD_DIR / saved_filename,
        )
        try:
            with dest_path.open("wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            metadata = LocalIntegrationAdapter.inspect_media(str(dest_path), "image")
            media_ref = _store_upload(
                dest_path, org_id, draft_id, file.filename or saved_filename, file.content_type
            )
        except (FileNotFoundError, ValueError, OSError) as exc:
            if settings.MEDIA_STORAGE_BACKEND != "supabase":
                dest_path.unlink(missing_ok=True)
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except Exception as exc:
            logger.exception("Image upload to media storage failed")
            raise HTTPException(status_code=503, detail="Media storage is unavailable.") from exc

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO drafts (id, org_id, author_id, title, content_type, current_version, status, content_ref, media_metadata, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'image', 1, 'Submitted', ?, ?, ?, ?)
            """, (draft_id, org_id, x_user_id, title, media_ref, json.dumps(metadata), now, now))

        AuditService.log(org_id, x_user_id, "draft_image_uploaded", {"title": title, "filename": file.filename}, draft_id=draft_id)
        await Scanner.scan_draft(draft_id, x_user_id, image_path=str(dest_path))

    return get_draft(draft_id, current_user)

@router.post("/upload-media", response_model=DraftDetail)
async def upload_media_draft(
    title: str = Form(...),
    media_type: str = Form(...),
    transcript: str = Form(""),
    transcript_confirmed: bool = Form(False),
    file: UploadFile = File(...),
    org_id: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
):
    if media_type not in {"audio", "video"}:
        raise HTTPException(status_code=422, detail="media_type must be audio or video")
    suffix = Path(file.filename or "").suffix or ".bin"
    draft_id = str(uuid.uuid4())
    x_user_id = current_user["id"]
    org_id = organization_scope(current_user, org_id)
    now = datetime.utcnow().isoformat() + "Z"
    saved_filename = f"{draft_id}{suffix}"
    with tempfile.TemporaryDirectory(prefix="draft-upload-") as temp_dir:
        destination = _media_workspace_path(
            temp_dir if settings.MEDIA_STORAGE_BACKEND == "supabase" else None,
            settings.STATIC_UPLOAD_DIR / saved_filename,
        )
        try:
            with destination.open("wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            metadata = LocalIntegrationAdapter.inspect_media(str(destination), media_type)
            media_ref = _store_upload(
                destination, org_id, draft_id, file.filename or saved_filename, file.content_type
            )
        except (FileNotFoundError, ValueError, OSError) as exc:
            if settings.MEDIA_STORAGE_BACKEND != "supabase":
                destination.unlink(missing_ok=True)
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except Exception as exc:
            logger.exception("Media upload to storage failed")
            raise HTTPException(status_code=503, detail="Media storage is unavailable.") from exc

        with get_db() as conn:
            conn.execute("""
                INSERT INTO drafts
                (id, org_id, author_id, title, content_type, current_version, status, content_ref, media_metadata, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 1, 'Submitted', ?, ?, ?, ?)
            """, (draft_id, org_id, x_user_id, title, media_type, media_ref, json.dumps(metadata), now, now))

        AuditService.log(
            org_id, x_user_id, "draft_media_uploaded",
            {
                "title": title,
                "media_type": media_type,
                "metadata": metadata,
                "has_transcript": bool(transcript.strip()),
                "transcript_confirmed": transcript_confirmed,
            },
            draft_id=draft_id,
        )
        try:
            await Scanner.scan_draft(
                draft_id,
                x_user_id,
                content_text=transcript.strip() or None,
                image_path=str(destination),
                transcript_confirmed=transcript_confirmed,
                transcript_source="creator" if transcript.strip() else None,
            )
        except Exception:
            logger.exception("Initial media scan failed for saved draft %s", draft_id)
            raise HTTPException(
                status_code=503,
                detail={
                    "message": (
                        "The media draft was saved, but its initial scan failed. "
                        "Open it in Draft Studio and select Re-scan."
                    ),
                    "draft_id": draft_id,
                },
            )
    return get_draft(draft_id, current_user)

@router.post("/{draft_id}/replace-media", response_model=DraftDetail)
async def replace_draft_media(
    draft_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM drafts WHERE id = ? AND org_id = ?",
            (draft_id, current_user["org_id"]),
        )
        draft = cursor.fetchone()
        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")
        if current_user["role"] != "admin" and draft["author_id"] != current_user["id"]:
            raise HTTPException(
                status_code=403,
                detail="Only the draft creator or an administrator can replace its media.",
            )
        if draft["content_type"] not in {"image", "audio", "video"}:
            raise HTTPException(status_code=409, detail="This draft does not contain a media asset.")
        new_version = draft["current_version"] + 1

    suffix = Path(file.filename or "").suffix or ".bin"
    saved_filename = f"{uuid.uuid4()}{suffix}"
    with tempfile.TemporaryDirectory(prefix="draft-upload-") as temp_dir:
        destination = _media_workspace_path(
            temp_dir if settings.MEDIA_STORAGE_BACKEND == "supabase" else None,
            settings.STATIC_UPLOAD_DIR / saved_filename,
        )
        try:
            with destination.open("wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            metadata = LocalIntegrationAdapter.inspect_media(str(destination), draft["content_type"])
            media_ref = _store_upload(
                destination,
                draft["org_id"],
                draft_id,
                file.filename or saved_filename,
                file.content_type,
            )
        except (FileNotFoundError, ValueError, OSError) as exc:
            if settings.MEDIA_STORAGE_BACKEND != "supabase":
                destination.unlink(missing_ok=True)
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except Exception as exc:
            logger.exception("Replacement media upload failed for draft %s", draft_id)
            raise HTTPException(status_code=503, detail="Media storage is unavailable.") from exc

        now = datetime.utcnow().isoformat() + "Z"
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE drafts
                SET content_ref = ?, media_metadata = ?, current_version = ?,
                    status = 'In Revision', updated_at = ?
                WHERE id = ? AND org_id = ?
            """, (
                media_ref, json.dumps(metadata), new_version, now,
                draft_id, current_user["org_id"],
            ))

        AuditService.log(
            draft["org_id"],
            current_user["id"],
            "draft_media_replaced",
            {"media_type": draft["content_type"], "filename": file.filename},
            draft_id=draft_id,
        )
        await Scanner.scan_draft(
            draft_id,
            current_user["id"],
            image_path=str(destination),
            reset_transcript=True,
        )
    try:
        MediaStorage.delete_reference(draft.get("content_ref"))
    except Exception:
        logger.exception("Could not remove replaced media for draft %s", draft_id)
    return get_draft(draft_id, current_user)

@router.get("/{draft_id}", response_model=DraftDetail)
def get_draft(draft_id: str, current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT d.*, u.name as author_name
            FROM drafts d
            LEFT JOIN users u ON d.author_id = u.id
            WHERE d.id = ? AND d.org_id = ?
        """, (draft_id, current_user["org_id"]))
        draft = cursor.fetchone()
        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")

        cursor.execute("""
            SELECT * FROM revisions
            WHERE draft_id = ?
            ORDER BY version_num DESC, created_at DESC, id DESC
        """, (draft_id,))
        rev_rows = cursor.fetchall()

        history = []
        for r in rev_rows:
            cursor.execute("SELECT * FROM flags WHERE revision_id = ? ORDER BY confidence DESC", (r['id'],))
            flags = cursor.fetchall()
            history.append({**_with_media_analysis(dict(r)), "flags": flags})

        latest_revision = history[0] if history else None

        return {
            **_with_media_url(_with_media_metadata(dict(draft))),
            "latest_revision": latest_revision,
            "history": history
        }

@router.put("/{draft_id}/transcript", response_model=DraftDetail)
async def update_media_transcript(
    draft_id: str,
    transcript_in: TranscriptUpdate,
    current_user: dict = Depends(get_current_user),
):
    transcript = transcript_in.transcript.strip()
    if transcript_in.confirmed and not transcript:
        raise HTTPException(
            status_code=422,
            detail="A transcript must contain text before it can be confirmed.",
        )
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM drafts WHERE id = ? AND org_id = ?",
            (draft_id, current_user["org_id"]),
        )
        draft = cursor.fetchone()
        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")
        if draft["content_type"] not in {"audio", "video"}:
            raise HTTPException(
                status_code=409,
                detail="Transcripts can only be edited for audio and video drafts.",
            )
        if current_user["role"] != "admin" and draft["author_id"] != current_user["id"]:
            raise HTTPException(
                status_code=403,
                detail="Only the draft creator or an administrator can edit its transcript.",
            )
        version = draft["current_version"] + 1
        previous_status = draft["status"]
        now = datetime.now(timezone.utc).isoformat()
        cursor.execute(
            """
            UPDATE drafts SET current_version = ?, status = 'In Revision', updated_at = ?
            WHERE id = ? AND org_id = ?
            """,
            (version, now, draft_id, current_user["org_id"]),
        )

    try:
        await Scanner.scan_draft(
            draft_id,
            current_user["id"],
            content_text=transcript,
            transcript_confirmed=transcript_in.confirmed,
            transcript_source="creator",
        )
    except Exception as exc:
        logger.exception("Transcript scan failed for draft %s", draft_id)
        with get_db() as conn:
            conn.execute(
                """
                UPDATE drafts SET current_version = ?, status = ?, updated_at = ?
                WHERE id = ? AND org_id = ?
                """,
                (
                    version - 1,
                    previous_status,
                    datetime.now(timezone.utc).isoformat(),
                    draft_id,
                    current_user["org_id"],
                ),
            )
        raise HTTPException(
            status_code=503,
            detail={
                "message": "The transcript could not be scanned; the previous draft revision is unchanged. Please retry.",
                "draft_id": draft_id,
            },
        ) from exc
    AuditService.log(
        draft["org_id"],
        current_user["id"],
        "media_transcript_updated",
        {
            "version": version,
            "character_count": len(transcript),
            "confirmed": transcript_in.confirmed,
        },
        draft_id=draft_id,
    )
    return get_draft(draft_id, current_user)

@router.put("/{draft_id}")
async def update_draft(
    draft_id: str,
    update_in: DraftUpdate,
    current_user: dict = Depends(get_current_user)
):
    x_user_id = current_user["id"]
    now = datetime.utcnow().isoformat() + "Z"
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM drafts WHERE id = ? AND org_id = ?", (draft_id, current_user["org_id"]))
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
    scan_result = await Scanner.scan_draft(draft_id, x_user_id, content_text=content_text)

    return {
        "status": "success",
        "draft": get_draft(draft_id, current_user),
        "scan": scan_result
    }

@router.post("/{draft_id}/scan", response_model=ScanResponse)
async def scan_draft_endpoint(draft_id: str, current_user: dict = Depends(get_current_user)):
    x_user_id = current_user["id"]
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id FROM drafts WHERE id = ? AND org_id = ?",
            (draft_id, current_user["org_id"]),
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Draft not found")
    try:
        return await Scanner.scan_draft(draft_id, x_user_id)
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=409,
            detail=(
                "The uploaded media file is no longer available on the server. "
                "The draft creator must upload a replacement asset before it can be scanned."
            ),
        ) from e
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{draft_id}/submit")
def submit_for_approval(draft_id: str, current_user: dict = Depends(get_current_user)):
    x_user_id = current_user["id"]
    now = datetime.utcnow().isoformat() + "Z"
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM drafts WHERE id = ? AND org_id = ?", (draft_id, current_user["org_id"]))
        draft = cursor.fetchone()
        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")
        cursor.execute("""
            SELECT policy_coverage_status, policy_coverage_reason
            FROM revisions
            WHERE draft_id = ?
            ORDER BY version_num DESC, created_at DESC
            LIMIT 1
        """, (draft_id,))
        latest_revision = cursor.fetchone()
        if latest_revision and latest_revision["policy_coverage_status"] == "needs_review":
            raise HTTPException(
                status_code=409,
                detail=latest_revision["policy_coverage_reason"]
                or "Policy coverage is incomplete; reviewer confirmation is required before submission."
            )

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
    current_user: dict = Depends(require_role("reviewer", "admin"))
):
    """
    Managerial Sign-Off & Approval Action (Section 5 Step 6 & Section 5.1):
    Decisions: 'Approved' or 'Changes Requested'
    """
    x_user_id = current_user['id']
    now = datetime.utcnow().isoformat() + "Z"
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM drafts WHERE id = ? AND org_id = ?", (draft_id, current_user["org_id"]))
        draft = cursor.fetchone()
        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")
        if draft["status"] != "Pending Approval":
            raise HTTPException(
                status_code=409,
                detail="Only drafts pending approval can receive a decision."
            )

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
def get_draft_comments(draft_id: str, current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT c.*, u.name as user_name, u.role as user_role, u.avatar as user_avatar
            FROM comments c
            JOIN users u ON c.user_id = u.id
            JOIN drafts d ON d.id = c.draft_id
            WHERE c.draft_id = ? AND d.org_id = ?
            ORDER BY c.timestamp ASC
        """, (draft_id, current_user["org_id"]))
        return cursor.fetchall()

@router.post("/{draft_id}/comments")
def post_draft_comment(draft_id: str, comment_in: CommentCreate, current_user: dict = Depends(get_current_user)):
    x_user_id = current_user["id"]
    now = datetime.utcnow().isoformat() + "Z"
    cid = str(uuid.uuid4())
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM drafts WHERE id = ? AND org_id = ?", (draft_id, current_user["org_id"]))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Draft not found")
        cursor.execute("""
            INSERT INTO comments (id, draft_id, user_id, text, decision, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (cid, draft_id, x_user_id, comment_in.text, comment_in.decision or 'comment', now))

    return {"id": cid, "status": "success"}
