import unittest
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch

from backend.services.analytics_service import AnalyticsService
from backend.services.evaluation_service import EvaluationService
from backend.services.semantic_engine import SemanticEngine
from backend.services.rag_service import RAGService
from backend.schemas import BenchmarkReport


class EvaluationTimestampTests(unittest.TestCase):
    def test_parses_postgres_datetime_and_iso_text_consistently(self):
        expected = datetime(2026, 11, 7, 8, 0, tzinfo=timezone.utc)

        self.assertEqual(
            EvaluationService._parse_timestamp(datetime(2026, 11, 7, 8, 0)),
            expected,
        )
        self.assertEqual(
            EvaluationService._parse_timestamp("2026-11-07T08:00:00Z"),
            expected,
        )

    def test_rejects_unsupported_audit_timestamp_value(self):
        with self.assertRaises(ValueError):
            EvaluationService._parse_timestamp(None)

    def test_analytics_timestamp_parser_handles_datetime_values(self):
        value = datetime(2026, 11, 7, 8, 0)

        self.assertEqual(
            AnalyticsService._parse_timestamp(value),
            datetime(2026, 11, 7, 8, 0, tzinfo=timezone.utc),
        )

    def test_benchmark_handles_native_database_datetime_values(self):
        submitted_at = datetime(2026, 11, 6, 8, 0)
        approved_at = submitted_at + timedelta(hours=24)

        class Cursor:
            def execute(self, *_args, **_kwargs):
                return None

            def fetchone(self):
                return None

            def fetchall(self):
                return [{
                    "draft_id": "draft-test",
                    "submitted_at": submitted_at,
                    "approved_at": approved_at,
                }]

        class Connection:
            def cursor(self):
                return Cursor()

        @contextmanager
        def fake_db():
            yield Connection()

        with (
            patch("backend.services.evaluation_service.get_db", fake_db),
            patch("backend.services.evaluation_service.DeterministicEngine.run_all", return_value=[]),
            patch("backend.services.evaluation_service.SemanticEngine.run", return_value=[]),
        ):
            report = EvaluationService.run_benchmark("org-test")

        self.assertEqual(report["total_test_samples"], 0)
        self.assertEqual(report["avg_approval_turnaround_seconds"], 86400.0)
        self.assertIsNone(report["labelled_sample_pass_rate"])
        self.assertIsNone(report["flag_precision"])
        self.assertEqual(report["metrics_summary"][0]["measured"], "Not measured")
        self.assertIsNone(report["metrics_summary"][1]["passed"])
        self.assertIn("No human-reviewed examples", report["dataset_provenance"])
        BenchmarkReport.model_validate(report)

    def test_benchmark_reports_missing_operational_data_as_unmeasured(self):
        class Cursor:
            def execute(self, *_args, **_kwargs):
                return None

            def fetchone(self):
                return None

            def fetchall(self):
                return []

        class Connection:
            def cursor(self):
                return Cursor()

        @contextmanager
        def fake_db():
            yield Connection()

        with (
            patch("backend.services.evaluation_service.get_db", fake_db),
            patch("backend.services.evaluation_service.DeterministicEngine.run_all", return_value=[]),
            patch("backend.services.evaluation_service.SemanticEngine.run", return_value=[]),
        ):
            report = EvaluationService.run_benchmark("org-test")

        self.assertIsNone(report["avg_approval_turnaround_seconds"])
        self.assertEqual(report["metrics_summary"][1]["measured"], "Not measured")
        self.assertIsNone(report["metrics_summary"][1]["passed"])


class SemanticEngineResponseTests(unittest.TestCase):
    def test_self_deprecating_text_gets_grounded_voice_finding(self):
        rules = [{
            "rule_id": "VOICE-01",
            "category": "tone",
            "title": "Empowering & Confident Tone",
            "text": "Maintain a confident, empowering, and helpful tone.",
            "details": "",
        }]

        flags = SemanticEngine._local_semantic_rules_eval(
            "we are very bad at our work", rules
        )

        self.assertEqual(len(flags), 1)
        self.assertEqual(flags[0]["rule_id"], "VOICE-01")
        self.assertEqual(flags[0]["quoted_span"], "we are very bad at our work")
        self.assertTrue(flags[0]["suggested_fix"])

    def test_local_voice_finding_survives_empty_gemini_response(self):
        rules = [{
            "rule_id": "VOICE-01",
            "category": "tone",
            "title": "Empowering & Confident Tone",
            "text": "Maintain a confident, empowering, and helpful tone.",
            "details": "",
        }]

        with (
            patch("backend.services.semantic_engine.RAGService.retrieve_relevant_rules", return_value=rules),
            patch("backend.services.semantic_engine.settings.GEMINI_API_KEY", "configured"),
            patch.object(SemanticEngine, "_call_gemini_rag", return_value=[]),
        ):
            flags = SemanticEngine.run("org-test", "we are very bad at our work")

        self.assertEqual(len(flags), 1)
        self.assertEqual(flags[0]["rule_id"], "VOICE-01")
        self.assertEqual(flags[0]["span"], "we are very bad at our work")
        self.assertIn("committed to delivering", flags[0]["fix"])

    def test_vector_retrieval_also_includes_lexical_voice_rules(self):
        rules = [{
            "rule_id": "VOICE-01",
            "category": "tone",
            "title": "Empowering tone",
            "text": "Maintain a confident and helpful tone.",
            "details": "",
        }, {
            "rule_id": "COLOR-01",
            "category": "color",
            "title": "Palette",
            "text": "Use approved colors.",
            "details": "",
        }]

        class Cursor:
            def execute(self, *_args, **_kwargs):
                return None

            def fetchall(self):
                return [rules[1]]

        class Connection:
            def cursor(self):
                return Cursor()

        @contextmanager
        def fake_db():
            yield Connection()

        with (
            patch.object(RAGService, "get_active_rules", return_value=rules),
            patch("backend.services.rag_service.EmbeddingService.embed", return_value=[1.0]),
            patch("backend.services.rag_service.EmbeddingService.to_vector_literal", return_value="[1]"),
            patch("backend.services.rag_service.settings", SimpleNamespace(is_postgres=True)),
            patch("backend.services.rag_service.get_db", fake_db),
        ):
            retrieved = RAGService.retrieve_relevant_rules(
                "org-test", "we are very bad at our work", top_k=1
            )

        self.assertEqual(
            {rule["rule_id"] for rule in retrieved},
            {"VOICE-01", "COLOR-01"},
        )

    def test_parses_valid_structured_gemini_response(self):
        response = SimpleNamespace(parsed={
            "flags": [{
                "rule_id": "VOICE-01",
                "quoted_span": "very best",
                "explanation": "This claim is unsupported by the cited rule.",
                "suggested_fix": "a strong option",
                "confidence": 0.91,
            }]
        })

        flags = SemanticEngine._parse_gemini_response(response)

        self.assertEqual(len(flags), 1)
        self.assertEqual(flags[0]["rule_id"], "VOICE-01")
        self.assertEqual(flags[0]["confidence"], 0.91)

    def test_parses_response_text_when_sdk_has_no_parsed_value(self):
        response = SimpleNamespace(text='{"flags":[]}')

        self.assertEqual(SemanticEngine._parse_gemini_response(response), [])

    def test_rejects_missing_or_invalid_structured_output(self):
        for response in (
            SimpleNamespace(parsed=None, text=None),
            SimpleNamespace(parsed={"flags": [{"rule_id": "VOICE-01"}]}),
        ):
            with self.subTest(response=response), self.assertRaises((ValueError, TypeError)):
                SemanticEngine._parse_gemini_response(response)

    def test_rejects_confidence_outside_valid_range(self):
        response = SimpleNamespace(parsed={
            "flags": [{
                "rule_id": "VOICE-01",
                "quoted_span": "very best",
                "explanation": "Unsupported claim.",
                "suggested_fix": "a strong option",
                "confidence": 1.2,
            }]
        })

        with self.assertRaises(ValueError):
            SemanticEngine._parse_gemini_response(response)


if __name__ == "__main__":
    unittest.main()
