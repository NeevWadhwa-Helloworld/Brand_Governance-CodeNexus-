from contextlib import nullcontext

from backend.services.deterministic_engine import DeterministicEngine


class FakeCursor:
    def __init__(self, facts):
        self.facts = facts

    def execute(self, query, params=()):
        return self

    def fetchall(self):
        return self.facts


class FakeConnection:
    def __init__(self, facts):
        self.cursor_instance = FakeCursor(facts)

    def cursor(self):
        return self.cursor_instance


def _approved_facts(monkeypatch, facts):
    connection = FakeConnection(facts)
    monkeypatch.setattr(
        "backend.services.deterministic_engine.get_db",
        lambda: nullcontext(connection),
    )


def test_clear_profanity_is_flagged_with_exact_span():
    text = "This is terrible. Fuck you!"

    flags = DeterministicEngine.check_profanity(text)

    assert len(flags) == 1
    assert flags[0]["span"] == "Fuck you"
    assert text[flags[0]["start_idx"]:flags[0]["end_idx"]] == flags[0]["span"]
    assert flags[0]["category"] == "tone"


def test_screenshot_phrase_flags_threat_and_profanity():
    text = "Kill you all,fuck you"

    flags = DeterministicEngine.check_profanity(text)

    assert {flag["span"] for flag in flags} == {"Kill you all", "fuck you"}
    assert all(
        text[flag["start_idx"]:flag["end_idx"]] == flag["span"]
        for flag in flags
    )


def test_large_numeric_user_claim_without_approved_fact_is_unverified(monkeypatch):
    _approved_facts(monkeypatch, [])
    text = "We serve 1000000000 users worldwide."

    flags = DeterministicEngine.check_facts("org-1", text)

    assert len(flags) == 1
    assert flags[0]["span"] == "We serve 1000000000 users"
    assert "could not be matched to an approved fact" in flags[0]["explanation"]


def test_numeric_claim_matching_approved_fact_is_not_flagged(monkeypatch):
    _approved_facts(monkeypatch, [{
        "fact_key": "active_users",
        "claim_text": "The company serves active users",
        "approved_metric": "1 billion users",
        "citation": "Annual report",
        "linked_rule_id": "FACT-01",
    }])

    flags = DeterministicEngine.check_facts(
        "org-1", "We serve 1000000000 users."
    )

    assert flags == []


def test_numeric_claim_conflicting_with_approved_fact_cites_source(monkeypatch):
    _approved_facts(monkeypatch, [{
        "fact_key": "active_users",
        "claim_text": "The company serves active users",
        "approved_metric": "50,000 users",
        "citation": "Annual report",
        "linked_rule_id": "FACT-01",
    }])

    flags = DeterministicEngine.check_facts(
        "org-1", "We serve 1000000000 users."
    )

    assert len(flags) == 1
    assert "50,000 users" in flags[0]["explanation"]
    assert "Annual report" in flags[0]["explanation"]
    assert flags[0]["fix"] == "We serve 50,000 users."


def test_numeric_claim_qualifier_must_match_approved_fact(monkeypatch):
    _approved_facts(monkeypatch, [{
        "fact_key": "active_users",
        "claim_text": "The company serves active users",
        "approved_metric": "50,000 users",
        "citation": "Annual report",
        "linked_rule_id": "FACT-01",
    }])

    flags = DeterministicEngine.check_facts(
        "org-1", "We serve over 50,000 users."
    )

    assert len(flags) == 1
    assert "does not match the approved figure" in flags[0]["explanation"]


def test_ordinary_text_without_numeric_claim_is_not_flagged(monkeypatch):
    _approved_facts(monkeypatch, [])

    assert DeterministicEngine.check_facts(
        "org-1", "We help teams create consistent brand content."
    ) == []
