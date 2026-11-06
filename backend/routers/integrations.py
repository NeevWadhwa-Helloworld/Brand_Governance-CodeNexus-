import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

from backend.database import get_db
from backend.dependencies import get_current_user
from backend.config import settings
from backend.services.audit_service import AuditService
from backend.services.integration_adapters import LocalIntegrationAdapter
from backend.services.scanner import Scanner

router = APIRouter(prefix="/api/integrations", tags=["integrations"])


class TextImportRequest(BaseModel):
    source: str
    title: str
    content: str


@router.post("/text/import")
async def import_text(request: TextImportRequest, current_user: dict = Depends(get_current_user)):
    try:
        payload = LocalIntegrationAdapter.normalize_text_import(
            request.source, request.title, request.content
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    draft_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat() + "Z"
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO drafts
            (id, org_id, author_id, title, content_type, current_version, status, content_ref, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'text', 1, 'Submitted', ?, ?, ?)
            """,
            (draft_id, current_user["org_id"], current_user["id"], payload["title"], payload["content_text"], now, now),
        )
    AuditService.log(
        current_user["org_id"], current_user["id"], "integration_text_imported",
        {"source": payload["source"], "title": payload["title"]}, draft_id=draft_id
    )
    scan = await Scanner.scan_draft(
        draft_id, current_user["id"], content_text=payload["content_text"]
    )
    return {"draft_id": draft_id, "source": payload["source"], "scan": scan}


@router.post("/media/inspect")
async def inspect_media(
    media_type: str = Form(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    suffix = __import__("pathlib").Path(file.filename or "").suffix or ".bin"
    destination = settings.STATIC_UPLOAD_DIR / f"integration_{uuid.uuid4()}{suffix}"
    with destination.open("wb") as output:
        output.write(await file.read())
    try:
        metadata = LocalIntegrationAdapter.inspect_media(str(destination), media_type)
    except (FileNotFoundError, ValueError, OSError) as exc:
        destination.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    finally:
        destination.unlink(missing_ok=True)
    AuditService.log(
        current_user["org_id"], current_user["id"], "integration_media_inspected", metadata
    )
    return metadata
