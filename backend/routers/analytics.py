from fastapi import APIRouter
from backend.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

@router.get("/dashboard")
def get_dashboard_data(org_id: str = "org_inkloom"):
    return AnalyticsService.get_dashboard_metrics(org_id)

