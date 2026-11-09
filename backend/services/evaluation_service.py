import json
import logging
import math
import statistics
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from backend.config import settings
from backend.database import get_db
from backend.services.deterministic_engine import DeterministicEngine
from backend.services.media_analyzer import MediaAnalyzer
from backend.services.rag_service import RAGService
from backend.services.semantic_engine import SemanticEngine

logger = logging.getLogger(__name__)


class EvaluationService:
    """Evaluate scans only against reviewer-labeled, version-matched examples."""

    DATASET_VERSION = "human-reviewed-v1"
    LIMITATIONS = [
        "Only examples explicitly labeled by an authenticated reviewer or admin are included.",
        "Results are scoped to this organization and its active guideline version.",
        "Metrics are rule-level; they do not measure exact span localization.",
        "Media detector metrics use reviewer-verified transcript/caption evidence. "
        "Media extraction readiness is reported separately and is not a transcription-accuracy score.",
        "Small or unbalanced datasets are not representative of production content.",
    ]

    @staticmethod
    def _parse_timestamp(value: Any) -> datetime:
        if isinstance(value, datetime):
            parsed = value
        elif isinstance(value, str):
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        else:
            raise ValueError("Unsupported audit timestamp type")
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)

    @staticmethod
    def _json_list(value: Any) -> list[str]:
        parsed = json.loads(value or "[]") if isinstance(value, str) else value or []
        return [str(item) for item in parsed]

    @staticmethod
    def _percentile(values: list[float], percentile: float) -> float | None:
        if not values:
            return None
        ordered = sorted(values)
        index = max(0, math.ceil(percentile * len(ordered)) - 1)
        return round(ordered[index], 3)

    @classmethod
    def _classification_counts(
        cls, predicted: set[str], expected: set[str], rule_catalog: set[str]
    ) -> dict[str, int]:
        return {
            "tp": len(predicted & expected),
            "fp": len(predicted - expected),
            "fn": len(expected - predicted),
            "tn": len(rule_catalog - (predicted | expected)),
        }

    @staticmethod
    def _metrics(counts: dict[str, int]) -> dict[str, float | None]:
        tp, fp, fn, tn = (counts[key] for key in ("tp", "fp", "fn", "tn"))
        return {
            "precision": round(tp / (tp + fp) * 100, 1) if tp + fp else None,
            "recall": round(tp / (tp + fn) * 100, 1) if tp + fn else None,
            "false_positive_rate": (
                round(fp / (fp + tn) * 100, 1) if fp + tn else None
            ),
        }

    @classmethod
    def _run_sample(
        cls, org_id: str, sample: dict[str, Any], rule_catalog: set[str]
    ) -> dict[str, Any]:
        expected = set(cls._json_list(sample["expected_rules"]))
        applicable = set(cls._json_list(sample["applicable_rules"]))
        text = sample["content_text"]
        media_status = None
        media_missing: list[str] = []
        if sample["content_type"] in {"audio", "video"}:
            filename = sample.get("media_filename")
            asset = (
                settings.EVALUATION_UPLOAD_DIR / Path(filename).name
                if filename and Path(filename).name == filename
                else None
            )
            if not asset or not asset.is_file():
                media_status = "asset_missing"
                media_missing = ["uploaded media asset is unavailable"]
            else:
                analysis = MediaAnalyzer.analyze(str(asset), sample["content_type"])
                media_status = analysis["extraction_status"]
                media_missing = analysis.get("missing_capabilities", [])

        started = time.perf_counter()
        deterministic_flags = DeterministicEngine.run_all(org_id, text=text)
        semantic_flags = SemanticEngine.run(org_id, text=text)
        retrieved = {
            str(rule["rule_id"])
            for rule in RAGService.retrieve_relevant_rules(org_id, text, top_k=8)
        }
        latency = time.perf_counter() - started
        predicted = {
            str(flag["rule_id"])
            for flag in deterministic_flags + semantic_flags
        }
        counts = cls._classification_counts(predicted, expected, rule_catalog)
        applicable_retrieved = len(applicable & retrieved)
        expected_retrieval = len(applicable)
        return {
            "sample_id": sample["id"],
            "title": sample["title"],
            "content_type": sample["content_type"],
            "content_preview": text[:100] + ("..." if len(text) > 100 else ""),
            "expected_rules": sorted(expected),
            "applicable_rules": sorted(applicable),
            "detected_rules": sorted(predicted),
            "retrieved_rules": sorted(retrieved),
            "true_positives": counts["tp"],
            "false_positives": counts["fp"],
            "false_negatives": counts["fn"],
            "true_negatives": counts["tn"],
            "retrieval_covered_rules": applicable_retrieved,
            "retrieval_expected_rules": expected_retrieval,
            "retrieval_coverage": (
                round(applicable_retrieved / expected_retrieval * 100, 1)
                if expected_retrieval else None
            ),
            "latency_seconds": round(latency, 3),
            "media_extraction_status": media_status,
            "media_missing_capabilities": media_missing,
            "exact_rule_match": predicted == expected,
            "passed": predicted == expected,
        }

    @classmethod
    def _group_metrics(cls, rows: list[dict[str, Any]]) -> dict[str, Any]:
        tp = sum(row["true_positives"] for row in rows)
        fp = sum(row["false_positives"] for row in rows)
        fn = sum(row["false_negatives"] for row in rows)
        tn = sum(row["true_negatives"] for row in rows)
        retrieval_expected = sum(row["retrieval_expected_rules"] for row in rows)
        retrieval_covered = sum(row["retrieval_covered_rules"] for row in rows)
        latencies = [float(row["latency_seconds"]) for row in rows]
        confusion = {"tp": tp, "fp": fp, "fn": fn, "tn": tn}
        return {
            "sample_count": len(rows),
            **confusion,
            **cls._metrics(confusion),
            "false_positive_count": fp,
            "retrieval_covered_rules": retrieval_covered,
            "retrieval_applicable_rules": retrieval_expected,
            "rule_retrieval_coverage": (
                round(retrieval_covered / retrieval_expected * 100, 1)
                if retrieval_expected else None
            ),
            "mean_latency_seconds": (
                round(statistics.mean(latencies), 3) if latencies else None
            ),
            "median_latency_seconds": cls._percentile(latencies, 0.5),
            "p95_latency_seconds": cls._percentile(latencies, 0.95),
            "media_extraction_complete": sum(
                row["media_extraction_status"] == "complete"
                for row in rows
                if row["media_extraction_status"] is not None
            ),
            "media_sample_count": sum(
                row["media_extraction_status"] is not None for row in rows
            ),
        }

    @classmethod
    def run_benchmark(cls, org_id: str) -> dict[str, Any]:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, version FROM guideline_versions
                WHERE org_id = ? AND is_active = 1
                ORDER BY uploaded_at DESC, id DESC LIMIT 1
                """,
                (org_id,),
            )
            active_version = cursor.fetchone()
            if active_version:
                cursor.execute(
                    "SELECT rule_id FROM rules WHERE org_id = ? AND version_id = ? AND is_active = 1",
                    (org_id, active_version["id"]),
                )
                rule_catalog = {
                    str(row["rule_id"]) for row in cursor.fetchall()
                }
                cursor.execute(
                    """
                    SELECT id, title, content_type, content_text, media_filename,
                           expected_rules, applicable_rules, reviewed_at
                    FROM evaluation_samples
                    WHERE org_id = ? AND guideline_version_id = ? AND is_demo = FALSE
                    ORDER BY reviewed_at ASC, id ASC
                    """,
                    (org_id, active_version["id"]),
                )
                samples = cursor.fetchall()
            else:
                rule_catalog = set()
                samples = []

            cursor.execute(
                """
                SELECT draft_id,
                       MIN(CASE WHEN action = 'submitted_for_approval' THEN timestamp END) AS submitted_at,
                       MIN(CASE WHEN action = 'draft_approved' THEN timestamp END) AS approved_at
                FROM audit_logs WHERE org_id = ? GROUP BY draft_id
                """,
                (org_id,),
            )
            approval_rows = cursor.fetchall()

        results = [
            cls._run_sample(org_id, dict(sample), rule_catalog)
            for sample in samples
        ]
        aggregate = cls._group_metrics(results)
        by_content_type = {
            content_type: cls._group_metrics(
                [row for row in results if row["content_type"] == content_type]
            )
            for content_type in ("text", "audio", "video")
        }
        sample_pass_rate = (
            round(sum(row["exact_rule_match"] for row in results) / len(results) * 100, 1)
            if results else None
        )

        measured_turnarounds = []
        for row in approval_rows:
            if row["submitted_at"] and row["approved_at"]:
                try:
                    start = cls._parse_timestamp(row["submitted_at"])
                    end = cls._parse_timestamp(row["approved_at"])
                    if end >= start:
                        measured_turnarounds.append((end - start).total_seconds())
                except (TypeError, ValueError):
                    logger.warning(
                        "Skipping approval cycle with invalid timestamps for draft %s",
                        row["draft_id"],
                    )

        precision = aggregate["precision"]
        recall = aggregate["recall"]
        fpr = aggregate["false_positive_rate"]
        retrieval_coverage = aggregate["rule_retrieval_coverage"]
        average_latency = aggregate["mean_latency_seconds"]
        metrics = [
            {
                "metric": "Rule-level precision",
                "target": "Not set",
                "measured": f"{precision}%" if precision is not None else "Not measured",
                "passed": None,
                "details": f'{aggregate["tp"]} TP / ({aggregate["tp"]} TP + {aggregate["fp"]} FP)',
            },
            {
                "metric": "Rule-level recall",
                "target": "Not set",
                "measured": f"{recall}%" if recall is not None else "Not measured",
                "passed": None,
                "details": f'{aggregate["tp"]} TP / ({aggregate["tp"]} TP + {aggregate["fn"]} FN)',
            },
            {
                "metric": "False-positive rate",
                "target": "Not set",
                "measured": f"{fpr}%" if fpr is not None else "Not measured",
                "passed": None,
                "details": f'{aggregate["fp"]} FP / ({aggregate["fp"]} FP + {aggregate["tn"]} TN)',
            },
            {
                "metric": "Applicable rule retrieval coverage",
                "target": "Not set",
                "measured": (
                    f"{retrieval_coverage}%"
                    if retrieval_coverage is not None else "Not measured"
                ),
                "passed": None,
                "details": (
                    f'{aggregate["retrieval_covered_rules"]}/'
                    f'{aggregate["retrieval_applicable_rules"]} labeled applicable rules retrieved'
                ),
            },
            {
                "metric": "Mean scan latency",
                "target": "Not set",
                "measured": (
                    f"{average_latency} s" if average_latency is not None else "Not measured"
                ),
                "passed": None,
                "details": (
                    f'{aggregate["sample_count"]} reviewed samples; median '
                    f'{aggregate["median_latency_seconds"]} s; p95 '
                    f'{aggregate["p95_latency_seconds"]} s'
                    if results else "No reviewer-labeled samples are available."
                ),
            },
        ]
        if not results:
            limitations = [
                "No human-reviewed examples are available for the active guideline version.",
                "All detection, retrieval, and latency quality metrics are not measured.",
                *cls.LIMITATIONS,
            ]
        else:
            limitations = list(cls.LIMITATIONS)

        return {
            "run_timestamp": datetime.now(timezone.utc).isoformat(),
            "total_test_samples": len(results),
            "dataset_version": (
                f'{cls.DATASET_VERSION} / guidelines {active_version["version"]}'
                if active_version else cls.DATASET_VERSION
            ),
            "dataset_provenance": (
                "Human-reviewed examples only"
                if results else "No human-reviewed examples available"
            ),
            "dataset_limitations": limitations,
            "metrics_by_content_type": by_content_type,
            "flag_precision": precision,
            "flag_precision_target": 0.0,
            "flag_recall": recall,
            "false_positive_count": aggregate["fp"],
            "false_positive_rate": fpr,
            "rule_retrieval_coverage": retrieval_coverage,
            "true_positive_count": aggregate["tp"],
            "false_negative_count": aggregate["fn"],
            "true_negative_count": aggregate["tn"],
            "avg_approval_turnaround_seconds": (
                round(statistics.mean(measured_turnarounds), 1)
                if measured_turnarounds else None
            ),
            "labelled_sample_pass_rate": sample_pass_rate,
            "avg_benchmark_scan_seconds": average_latency,
            "avg_benchmark_scan_target_seconds": None,
            "metrics_summary": metrics,
            "sample_results": results,
        }
