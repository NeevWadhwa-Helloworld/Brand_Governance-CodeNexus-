from fastapi import APIRouter
from backend.services.evaluation_service import EvaluationService
from backend.schemas import BenchmarkReport

router = APIRouter(prefix="/api/evaluation", tags=["evaluation"])

# Cache latest run
_latest_report = None

@router.post("/run", response_model=BenchmarkReport)
def run_evaluation_benchmark(org_id: str = "org_inkloom"):
    global _latest_report
    _latest_report = EvaluationService.run_benchmark(org_id)
    return _latest_report

@router.get("/latest", response_model=BenchmarkReport)
def get_latest_evaluation_report(org_id: str = "org_inkloom"):
    global _latest_report
    if _latest_report is None:
        _latest_report = EvaluationService.run_benchmark(org_id)
    return _latest_report

