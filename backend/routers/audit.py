import io
import csv
from fastapi import APIRouter, Depends, HTTPException, Response
from backend.database import get_db
from backend.services.audit_service import AuditService
from backend.dependencies import require_role, organization_scope

router = APIRouter(prefix="/api/audit", tags=["audit"])

@router.get("/logs")
def get_audit_logs(
    org_id: str | None = None,
    limit: int = 50,
    current_user: dict = Depends(require_role("admin", "reviewer"))
):
    org_id = organization_scope(current_user, org_id)
    return AuditService.get_recent_logs(org_id, limit=limit)

@router.get("/export")
def export_audit_logs_csv(
    org_id: str | None = None,
    format: str = "csv",
    current_user: dict = Depends(require_role("admin", "reviewer"))
):
    if format.lower() != "csv":
        raise HTTPException(status_code=400, detail="Only CSV export is supported")
    org_id = organization_scope(current_user, org_id)
    logs = AuditService.get_recent_logs(org_id, limit=500)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Timestamp_UTC", "User_Name", "User_Role", "Action", "Draft_Entity", "Details"])
    for l in logs:
        writer.writerow([
            l.get("timestamp", ""),
            l.get("user_name", "System"),
            l.get("user_role", ""),
            l.get("action", ""),
            l.get("draft_title") or l.get("draft_id") or "Global",
            str(l.get("details", ""))
        ])
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=brand_governance_audit_{org_id}.csv"}
    )

@router.get("/draft/{draft_id}")
def get_draft_audit_logs(draft_id: str, current_user: dict = Depends(require_role("admin", "reviewer", "creator"))):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id FROM drafts WHERE id = ? AND org_id = ?",
            (draft_id, current_user["org_id"]),
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Draft not found")
    return AuditService.get_logs_for_draft(draft_id, current_user["org_id"])

@router.get("/verify")
def verify_audit_chain(current_user: dict = Depends(require_role("admin", "reviewer"))):
    return AuditService.verify_chain(current_user["org_id"])
