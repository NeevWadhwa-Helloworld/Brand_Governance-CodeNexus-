from unittest.mock import patch

from backend.services.evaluation_service import EvaluationService


def test_rule_level_metrics_include_benign_near_miss_false_positives():
    sample = {
        "id": "sample-1",
        "title": "Near-miss",
        "content_type": "text",
        "content_text": "A statement with a benign mention.",
        "expected_rules": ["CLAIM-1"],
        "applicable_rules": ["CLAIM-1", "CLAIM-2"],
    }

    with (
        patch(
            "backend.services.evaluation_service.DeterministicEngine.run_all",
            return_value=[{"rule_id": "CLAIM-1"}, {"rule_id": "CLAIM-3"}],
        ),
        patch(
            "backend.services.evaluation_service.SemanticEngine.run",
            return_value=[],
        ),
        patch(
            "backend.services.evaluation_service.RAGService.retrieve_relevant_rules",
            return_value=[{"rule_id": "CLAIM-1"}],
        ),
    ):
        result = EvaluationService._run_sample(
            "org-1", sample, {"CLAIM-1", "CLAIM-2", "CLAIM-3"}
        )

    assert result["true_positives"] == 1
    assert result["false_positives"] == 1
    assert result["false_negatives"] == 0
    assert result["true_negatives"] == 1
    assert result["retrieval_coverage"] == 50.0
    assert result["exact_rule_match"] is False


def test_empty_group_reports_metrics_as_unmeasured():
    result = EvaluationService._group_metrics([])

    assert result["sample_count"] == 0
    assert result["precision"] is None
    assert result["recall"] is None
    assert result["false_positive_rate"] is None
    assert result["rule_retrieval_coverage"] is None
    assert result["mean_latency_seconds"] is None
    assert result["p95_latency_seconds"] is None
