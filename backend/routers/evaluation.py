import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from backend.config import settings
from backend.database import get_db
from backend.services.evaluation_service import EvaluationService
from backend.services.audit_service import AuditService
from backend.services.integration_adapters import LocalIntegrationAdapter
from backend.schemas import BenchmarkReport
from backend.dependencies import get_current_user, organization_scope, require_role

router = APIRouter(prefix="/api/evaluation", tags=["evaluation"])

# Cache the latest run separately for each organization.
_latest_reports = {}


def _parse_rule_ids(raw: str, field_name: str) -> list[str]:
    try:
        values = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail=f"{field_name} must be a JSON array.") from exc
    if not isinstance(values, list) or any(not isinstance(value, str) for value in values):
        raise HTTPException(status_code=422, detail=f"{field_name} must be a JSON array of rule IDs.")
    normalized = [value.strip() for value in values]
    if any(not value or len(value) > 64 for value in normalized):
        raise HTTPException(status_code=422, detail=f"{field_name} contains an invalid rule ID.")
    if len(set(normalized)) != len(normalized):
        raise HTTPException(status_code=422, detail=f"{field_name} cannot contain duplicate rule IDs.")
    return normalized


@router.get("/samples")
def list_evaluation_samples(current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id FROM guideline_versions
            WHERE org_id = ? AND is_active = 1
            ORDER BY uploaded_at DESC, id DESC LIMIT 1
            """,
            (current_user["org_id"],),
        )
        active_version = cursor.fetchone()
        if not active_version:
            return {"samples": [], "active_rule_ids": []}
        cursor.execute(
            "SELECT rule_id FROM rules WHERE org_id = ? AND version_id = ? AND is_active = 1 ORDER BY rule_id",
            (current_user["org_id"], active_version["id"]),
        )
        active_rule_ids = [row["rule_id"] for row in cursor.fetchall()]
        cursor.execute(
            """
            SELECT s.id, s.title, s.content_type, s.expected_rules, s.applicable_rules,
                   s.label_notes, s.reviewed_at, u.name AS reviewer_name
            FROM evaluation_samples s
            JOIN users u ON u.id = s.reviewer_id
            WHERE s.org_id = ? AND s.guideline_version_id = ?
            ORDER BY s.reviewed_at DESC, s.id ASC
            """,
            (current_user["org_id"], active_version["id"]),
        )
        rows = cursor.fetchall()
    return {
        "samples": [
            {
                **dict(row),
                "expected_rules": json.loads(row["expected_rules"]),
                "applicable_rules": json.loads(row["applicable_rules"]),
            }
            for row in rows
        ],
        "active_rule_ids": active_rule_ids,
    }


@router.post("/samples", status_code=201)
async def create_evaluation_sample(
    title: str = Form(...),
    content_type: str = Form(...),
    content_text: str = Form(...),
    expected_rules: str = Form("[]"),
    applicable_rules: str = Form("[]"),
    label_notes: str = Form(""),
    media_file: UploadFile | None = File(None),
    current_user: dict = Depends(require_role("reviewer", "admin")),
):
    title = title.strip()
    content_text = content_text.strip()
    if not title or len(title) > 200:
        raise HTTPException(status_code=422, detail="title must contain 1 to 200 characters.")
    if not content_text or len(content_text) > 50000:
        raise HTTPException(status_code=422, detail="content_text must contain 1 to 50000 characters.")
    if content_type not in {"text", "audio", "video"}:
        raise HTTPException(status_code=422, detail="content_type must be text, audio, or video.")
    if content_type == "text" and media_file:
        raise HTTPException(status_code=422, detail="Text examples must not include a media file.")
    if content_type in {"audio", "video"} and not media_file:
        raise HTTPException(status_code=422, detail="Media examples require the original audio/video file.")

    expected = _parse_rule_ids(expected_rules, "expected_rules")
    applicable = _parse_rule_ids(applicable_rules, "applicable_rules")
    if not applicable:
        raise HTTPException(
            status_code=422,
            detail="Provide at least one applicable rule to measure rule-retrieval coverage.",
        )
    if not set(expected).issubset(applicable):
        raise HTTPException(
            status_code=422,
            detail="Every expected violation rule must also be listed as applicable.",
        )

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id FROM guideline_versions
            WHERE org_id = ? AND is_active = 1
            ORDER BY uploaded_at DESC, id DESC LIMIT 1
            """,
            (current_user["org_id"],),
        )
        active_version = cursor.fetchone()
        if not active_version:
            raise HTTPException(status_code=409, detail="No active guideline version is available.")
        cursor.execute(
            "SELECT rule_id FROM rules WHERE org_id = ? AND version_id = ? AND is_active = 1",
            (current_user["org_id"], active_version["id"]),
        )
        active_rules = {row["rule_id"] for row in cursor.fetchall()}
    unknown_rules = (set(expected) | set(applicable)) - active_rules
    if unknown_rules:
        raise HTTPException(
            status_code=422,
            detail=f"Rule IDs are not active in this guideline version: {', '.join(sorted(unknown_rules))}",
        )

    sample_id = str(uuid.uuid4())
    media_filename = None
    if media_file:
        suffix = Path(media_file.filename or "").suffix.lower() or ".bin"
        media_filename = f"{sample_id}{suffix}"
        destination = settings.EVALUATION_UPLOAD_DIR / media_filename
        total_size = 0
        try:
            with destination.open("wb") as buffer:
                while chunk := await media_file.read(1024 * 1024):
                    total_size += len(chunk)
                    if total_size > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
                        raise HTTPException(status_code=413, detail="Evaluation media file is too large.")
                    buffer.write(chunk)
            if not total_size:
                raise HTTPException(status_code=422, detail="Evaluation media file is empty.")
            LocalIntegrationAdapter.inspect_media(str(destination), content_type)
        except HTTPException:
            destination.unlink(missing_ok=True)
            raise
        except (FileNotFoundError, ValueError, OSError) as exc:
            destination.unlink(missing_ok=True)
            raise HTTPException(status_code=422, detail=f"Could not inspect media file: {exc}") from exc
        finally:
            await media_file.close()

    now = datetime.now(timezone.utc).isoformat()
    try:
        with get_db() as conn:
            conn.cursor().execute(
                """
                INSERT INTO evaluation_samples
                    (id, org_id, guideline_version_id, reviewer_id, title, content_type,
                     content_text, media_filename, expected_rules, applicable_rules,
                     label_notes, reviewed_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    sample_id,
                    current_user["org_id"],
                    active_version["id"],
                    current_user["id"],
                    title,
                    content_type,
                    content_text,
                    media_filename,
                    json.dumps(expected),
                    json.dumps(applicable),
                    label_notes.strip()[:2000] or None,
                    now,
                    now,
                ),
            )
    except Exception:
        if media_filename:
            (settings.EVALUATION_UPLOAD_DIR / media_filename).unlink(missing_ok=True)
        raise

    AuditService.log(
        current_user["org_id"],
        current_user["id"],
        "evaluation_sample_labeled",
        {
            "sample_id": sample_id,
            "content_type": content_type,
            "expected_rule_count": len(expected),
            "applicable_rule_count": len(applicable),
        },
    )
    _latest_reports.pop(current_user["org_id"], None)
    return {"id": sample_id, "reviewed_at": now, "status": "human_reviewed"}


@router.post("/run", response_model=BenchmarkReport)
def run_evaluation_benchmark(org_id: str | None = None, current_user: dict = Depends(get_current_user)):
    org_id = organization_scope(current_user, org_id)
    report = EvaluationService.run_benchmark(org_id)
    _latest_reports[org_id] = report
    return report

@router.get("/latest", response_model=BenchmarkReport)
def get_latest_evaluation_report(org_id: str | None = None, current_user: dict = Depends(get_current_user)):
    org_id = organization_scope(current_user, org_id)
    if org_id not in _latest_reports:
        _latest_reports[org_id] = EvaluationService.run_benchmark(org_id)
    return _latest_reports[org_id]
