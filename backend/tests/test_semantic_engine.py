import unittest
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch

from backend.services.analytics_service import AnalyticsService
from backend.services.evaluation_service import EvaluationService
from backend.services.semantic_engine import SemanticEngine


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

        self.assertEqual(report["total_test_samples"], 5)
        self.assertEqual(report["review_turnaround_improvement"], 50.0)


class SemanticEngineResponseTests(unittest.TestCase):
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
