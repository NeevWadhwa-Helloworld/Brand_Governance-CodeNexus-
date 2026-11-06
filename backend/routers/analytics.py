from fastapi import APIRouter, Depends
from backend.services.analytics_service import AnalyticsService
from backend.dependencies import get_current_user, organization_scope

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

@router.get("/dashboard")
def get_dashboard_data(org_id: str | None = None, current_user: dict = Depends(get_current_user)):
    org_id = organization_scope(current_user, org_id)
    return AnalyticsService.get_dashboard_metrics(org_id)

@router.get("/trends")
def get_trends(org_id: str | None = None, current_user: dict = Depends(get_current_user)):
    org_id = organization_scope(current_user, org_id)
    return AnalyticsService.get_trends(org_id)
