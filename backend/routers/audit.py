from fastapi import APIRouter
from backend.services.audit_service import AuditService

router = APIRouter(prefix="/api/audit", tags=["audit"])

@router.get("/logs")
def get_audit_logs(org_id: str = "org_inkloom", limit: int = 50):
    return AuditService.get_recent_logs(org_id, limit=limit)

@router.get("/draft/{draft_id}")
def get_draft_audit_logs(draft_id: str):
    return AuditService.get_logs_for_draft(draft_id)
