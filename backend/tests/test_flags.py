from contextlib import nullcontext

import pytest
from fastapi import HTTPException

from backend.routers import flags
from backend.schemas import FlagResolveRequest


class FakeCursor:
    def __init__(self, row):
        self.row = row
        self.executed = []
        self.result = None

    def execute(self, query, params=()):
        self.executed.append((query, params))
        if "SELECT f.*" in query:
            self.result = self.row
        return self

    def fetchone(self):
        return self.result


class FakeConnection:
    def __init__(self, row):
        self.cursor_instance = FakeCursor(row)

    def cursor(self):
        return self.cursor_instance


def _request(monkeypatch, content_type, content_text, span="guarantees results"):
    row = {
        "draft_id": "draft-1",
        "org_id": "org-1",
        "content_type": content_type,
        "content_text": content_text,
        "span": span,
        "fix": "results may vary",
        "rule_id": "CLAIM-01",
        "revision_id": "revision-1",
    }
    connection = FakeConnection(row)
    audit_entries = []
    monkeypatch.setattr(flags, "get_db", lambda: nullcontext(connection))
    monkeypatch.setattr(flags.AuditService, "log", lambda *args, **kwargs: audit_entries.append(args))
    return connection.cursor_instance, audit_entries


def test_text_suggestion_updates_draft_content_without_rewriting_scan(monkeypatch):
    cursor, audit_entries = _request(
        monkeypatch, "text", "Our product guarantees results"
    )

    result = flags.resolve_flag(
        "flag-1",
        FlagResolveRequest(resolution="accepted"),
        {"id": "user-1", "org_id": "org-1"},
    )

    assert result["updated_text"] == "Our product results may vary"
    assert result["rescan_required"] is True
    assert result["asset_update_required"] is False
    assert not any("UPDATE revisions" in query for query, _ in cursor.executed)
    assert not any("compliance_score" in query for query, _ in cursor.executed)
    assert len(audit_entries) == 1


def test_media_suggestion_is_recorded_without_changing_asset_or_text(monkeypatch):
    cursor, _ = _request(
        monkeypatch, "audio", "The transcript says guaranteed results"
    )

    result = flags.resolve_flag(
        "flag-1",
        FlagResolveRequest(resolution="accepted"),
        {"id": "user-1", "org_id": "org-1"},
    )

    assert result["updated_text"] is None
    assert result["rescan_required"] is False
    assert result["asset_update_required"] is True
    assert not any("UPDATE drafts" in query for query, _ in cursor.executed)
    assert not any("UPDATE revisions" in query for query, _ in cursor.executed)


def test_stale_text_finding_cannot_be_resolved_as_applied(monkeypatch):
    cursor, audit_entries = _request(monkeypatch, "text", "A different draft")

    with pytest.raises(HTTPException) as error:
        flags.resolve_flag(
            "flag-1",
            FlagResolveRequest(resolution="accepted"),
            {"id": "user-1", "org_id": "org-1"},
        )

    assert error.value.status_code == 409
    assert not any("UPDATE flags" in query for query, _ in cursor.executed)
    assert not audit_entries


def test_repeated_text_is_replaced_at_the_finding_location(monkeypatch):
    text = "guarantees results, then guarantees results"
    cursor, _ = _request(monkeypatch, "text", text)
    cursor.row["start_idx"] = text.rfind("guarantees results")
    cursor.row["end_idx"] = cursor.row["start_idx"] + len("guarantees results")

    result = flags.resolve_flag(
        "flag-1",
        FlagResolveRequest(resolution="accepted"),
        {"id": "user-1", "org_id": "org-1"},
    )

    assert result["updated_text"] == "guarantees results, then results may vary"


def test_ambiguous_text_finding_requires_a_fresh_scan(monkeypatch):
    cursor, audit_entries = _request(
        monkeypatch, "text", "guarantees results, then guarantees results"
    )

    with pytest.raises(HTTPException) as error:
        flags.resolve_flag(
            "flag-1",
            FlagResolveRequest(resolution="accepted"),
            {"id": "user-1", "org_id": "org-1"},
        )

    assert error.value.status_code == 409
    assert not any("UPDATE flags" in query for query, _ in cursor.executed)
    assert not audit_entries
