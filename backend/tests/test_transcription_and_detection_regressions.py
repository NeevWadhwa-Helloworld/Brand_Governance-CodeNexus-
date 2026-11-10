from backend.services.deterministic_engine import DeterministicEngine
from backend.services.media_analyzer import MediaAnalyzer
from backend.services.rag_service import RAGService
from backend.services.semantic_engine import SemanticEngine


def test_whisper_failure_uses_configured_transcription_fallback(tmp_path, monkeypatch):
    media_path = tmp_path / "sample.wav"
    media_path.write_bytes(b"sample")

    def fail_local_model():
        raise RuntimeError("local model unavailable")

    monkeypatch.setattr(MediaAnalyzer, "_load_whisper_model", fail_local_model)
    monkeypatch.setattr(
        MediaAnalyzer,
        "_transcribe_with_gemini",
        lambda _path: {
            "available": True,
            "text": "Automatically generated transcript",
            "segments": [],
            "source": "gemini",
        },
    )

    result = MediaAnalyzer.analyze(str(media_path), "audio")

    assert result["transcript"] == "Automatically generated transcript"
    assert result["transcript_source"] == "gemini"
    assert result["capabilities"]["speech_to_text"] is True
    assert result["extracted_text"] == result["transcript"]


def test_uptime_claim_checks_percentages_and_nearby_qualifiers(monkeypatch):
    facts = [{
        "fact_key": "sla_uptime",
        "approved_metric": "99.9% uptime SLA",
        "citation": "Service agreement",
        "linked_rule_id": "FACT-03",
    }]
    _install_facts(monkeypatch, facts)

    flags = DeterministicEngine.check_facts(
        "org-1", "We guarantee 100% measured uptime."
    )

    assert len(flags) == 1
    assert flags[0]["span"] == "100% measured uptime"


def test_funding_claims_are_compared_to_approved_round(monkeypatch):
    facts = [{
        "fact_key": "funding_round",
        "approved_metric": "$12M Series A",
        "citation": "Company press release",
        "linked_rule_id": "FACT-02",
    }]
    _install_facts(monkeypatch, facts)

    wrong_round = DeterministicEngine.check_facts("org-1", "We closed a $5M Series A.")
    approved_round = DeterministicEngine.check_facts("org-1", "We closed a $12M Series A.")

    assert len(wrong_round) == 1
    assert wrong_round[0]["rule_id"] == "FACT-02"
    assert approved_round == []


def test_competitive_claim_phrases_are_detected_with_voice_rule():
    flags = SemanticEngine._local_semantic_rules_eval(
        "We crush competitors and dominate the competition.",
        [{"rule_id": "VOICE-01", "category": "tone"}],
    )

    assert len(flags) == 2
    assert all(flag["rule_id"] == "VOICE-01" for flag in flags)


def test_lexical_similarity_normalizes_common_word_forms():
    assert RAGService.compute_similarity(["claims"], ["claim"]) > 0


def _install_facts(monkeypatch, facts):
    from contextlib import nullcontext

    class FakeCursor:
        def execute(self, _query, _params=()):
            return self

        def fetchall(self):
            return facts

    class FakeConnection:
        def cursor(self):
            return FakeCursor()

    monkeypatch.setattr(
        "backend.services.deterministic_engine.get_db",
        lambda: nullcontext(FakeConnection()),
    )
