from fastapi import APIRouter, Depends
from backend.services.evaluation_service import EvaluationService
from backend.schemas import BenchmarkReport
from backend.dependencies import get_current_user, organization_scope

router = APIRouter(prefix="/api/evaluation", tags=["evaluation"])

# Cache the latest run separately for each organization.
_latest_reports = {}

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
