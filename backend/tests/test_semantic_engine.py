import unittest
from types import SimpleNamespace

from backend.services.semantic_engine import SemanticEngine


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
