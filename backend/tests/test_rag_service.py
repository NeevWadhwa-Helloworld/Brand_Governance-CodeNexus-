import unittest
from unittest.mock import patch

from backend.services.rag_service import RAGService


class RAGServiceTests(unittest.TestCase):
    def test_embedding_provider_failure_falls_back_to_lexical_rules(self):
        rules = [{
            "rule_id": "VOICE-01",
            "category": "tone",
            "title": "Use a helpful tone",
            "text": "Avoid aggressive language.",
            "details": "",
        }]

        with self.assertLogs("backend.services.rag_service", level="ERROR"):
            with (
                patch.object(RAGService, "get_active_rules", return_value=rules),
                patch(
                    "backend.services.rag_service.EmbeddingService.embed",
                    side_effect=RuntimeError("provider unavailable"),
                ),
            ):
                retrieved = RAGService.retrieve_relevant_rules("org-test", "Use a helpful tone")

        self.assertEqual(retrieved, rules)

    def test_vector_query_failure_falls_back_to_lexical_rules(self):
        rules = [{
            "rule_id": "VOICE-01",
            "category": "tone",
            "title": "Use a helpful tone",
            "text": "Avoid aggressive language.",
            "details": "",
        }]

        with self.assertLogs("backend.services.rag_service", level="ERROR"):
            with (
                patch.object(RAGService, "get_active_rules", return_value=rules),
                patch("backend.services.rag_service.EmbeddingService.embed", return_value=[0.1, 0.2]),
                patch("backend.services.rag_service.settings.is_postgres", True),
                patch("backend.services.rag_service.get_db", side_effect=RuntimeError("vector index unavailable")),
            ):
                retrieved = RAGService.retrieve_relevant_rules("org-test", "Use a helpful tone")

        self.assertEqual(retrieved, rules)


if __name__ == "__main__":
    unittest.main()
