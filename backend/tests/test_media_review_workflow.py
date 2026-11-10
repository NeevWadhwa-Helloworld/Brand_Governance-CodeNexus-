from contextlib import nullcontext
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from backend.routers import drafts
from backend.schemas import TranscriptUpdate
from backend.services.media_analyzer import MediaAnalyzer
from backend.services.scanner import Scanner


@pytest.fixture
def anyio_backend():
    return "asyncio"


class FakeCursor:
    def __init__(self, draft):
        self.draft = draft
        self.executed = []

    def execute(self, query, params=()):
        self.executed.append((query, params))

    def fetchone(self):
        return self.draft


def _draft_context(monkeypatch, draft):
    cursor = FakeCursor(draft)

    class FakeConnection:
        def cursor(self):
            return cursor

        def execute(self, query, params=()):
            return cursor.execute(query, params)

    monkeypatch.setattr(drafts, "get_db", lambda: nullcontext(FakeConnection()))
    return cursor


@pytest.mark.anyio
async def test_creator_can_edit_and_confirm_transcript_then_rescan(monkeypatch):
    cursor = _draft_context(
        monkeypatch,
        {
            "id": "draft-1",
            "org_id": "org-1",
            "author_id": "creator-1",
            "content_type": "video",
            "current_version": 2,
            "status": "Scanned",
        },
    )
    scan_calls = []
    audit_calls = []

    async def scan_draft(*args, **kwargs):
        scan_calls.append((args, kwargs))

    monkeypatch.setattr(drafts.Scanner, "scan_draft", scan_draft)
    monkeypatch.setattr(drafts, "get_draft", lambda *_args: {"id": "draft-1"})
    monkeypatch.setattr(
        drafts.AuditService, "log",
        lambda *args, **kwargs: audit_calls.append((args, kwargs)),
    )

    result = await drafts.update_media_transcript(
        "draft-1",
        TranscriptUpdate(transcript="  Verified spoken copy  ", confirmed=True),
        {"id": "creator-1", "org_id": "org-1", "role": "creator"},
    )

    assert result == {"id": "draft-1"}
    assert cursor.executed[-1][1][0] == 3
    assert cursor.executed[-1][1][2:] == ("draft-1", "org-1")
    assert scan_calls == [
        (
            ("draft-1", "creator-1"),
            {
                "content_text": "Verified spoken copy",
                "transcript_confirmed": True,
                "transcript_source": "creator",
            },
        )
    ]
    assert audit_calls[0][0][2] == "media_transcript_updated"
    assert audit_calls[0][0][3]["character_count"] == len("Verified spoken copy")
    assert "Verified spoken copy" not in str(audit_calls[0])


@pytest.mark.anyio
async def test_non_owner_cannot_edit_media_transcript(monkeypatch):
    cursor = _draft_context(
        monkeypatch,
        {
            "id": "draft-1",
            "org_id": "org-1",
            "author_id": "creator-1",
            "content_type": "audio",
            "current_version": 1,
        },
    )
    with pytest.raises(HTTPException) as error:
        await drafts.update_media_transcript(
            "draft-1",
            TranscriptUpdate(transcript="Changed", confirmed=False),
            {"id": "creator-2", "org_id": "org-1", "role": "creator"},
        )

    assert error.value.status_code == 403
    assert len(cursor.executed) == 1


@pytest.mark.anyio
async def test_empty_transcript_cannot_be_confirmed():
    with pytest.raises(HTTPException) as error:
        await drafts.update_media_transcript(
            "draft-1",
            TranscriptUpdate(transcript=" ", confirmed=True),
            {"id": "creator-1", "org_id": "org-1", "role": "creator"},
        )

    assert error.value.status_code == 422


@pytest.mark.anyio
async def test_transcript_scan_failure_returns_service_error_and_rolls_back_version(monkeypatch):
    cursor = _draft_context(
        monkeypatch,
        {
            "id": "draft-1",
            "org_id": "org-1",
            "author_id": "creator-1",
            "content_type": "audio",
            "current_version": 2,
            "status": "Scanned",
        },
    )
    monkeypatch.setattr(
        drafts.Scanner,
        "scan_draft",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("scanner unavailable")),
    )
    monkeypatch.setattr(drafts.AuditService, "log", lambda *_args, **_kwargs: None)

    with pytest.raises(HTTPException) as error:
        await drafts.update_media_transcript(
            "draft-1",
            TranscriptUpdate(transcript="Reviewed copy", confirmed=True),
            {"id": "creator-1", "org_id": "org-1", "role": "creator"},
        )

    assert error.value.status_code == 503
    assert "previous draft revision is unchanged" in error.value.detail["message"]
    rollback_query, rollback_params = cursor.executed[-1]
    assert "current_version = ?" in rollback_query
    assert rollback_params[:2] == (2, "Scanned")


def test_missing_media_transcript_keeps_policy_coverage_in_human_review():
    status, reason = Scanner._assess_policy_coverage(
        "org-1", None, None, "audio"
    )

    assert status == "needs_review"
    assert "no transcript or caption text" in reason


@pytest.mark.anyio
async def test_manual_transcript_rescan_survives_missing_original_media(monkeypatch):
    class Cursor:
        def __init__(self, rows=()):
            self.rows = list(rows)
            self.executed = []

        def execute(self, query, params=()):
            self.executed.append((query, params))

        def fetchone(self):
            return self.rows.pop(0) if self.rows else None

    class Connection:
        def __init__(self, cursor):
            self.fake_cursor = cursor

        def cursor(self):
            return self.fake_cursor

    draft = {
        "id": "draft-1",
        "org_id": "org-1",
        "current_version": 2,
        "content_type": "audio",
        "content_ref": "/static/uploads/missing.wav",
    }
    previous_revision = {
        "content_text": "Automatic transcript",
        "media_analysis": json.dumps({
            "transcript": "Automatic transcript",
            "transcript_source": "automatic",
            "transcript_confirmed": False,
            "transcript_segments": [],
            "missing_capabilities": ["transcript_confirmation"],
            "capabilities": {"speech_to_text": True},
        }),
    }
    read_cursor = Cursor([draft, previous_revision])
    write_cursor = Cursor()
    contexts = iter([
        nullcontext(Connection(read_cursor)),
        nullcontext(Connection(write_cursor)),
    ])
    monkeypatch.setattr("backend.services.scanner.get_db", lambda: next(contexts))
    monkeypatch.setattr(
        "backend.services.scanner.RAGService.retrieve_relevant_rules",
        lambda *_args, **_kwargs: [{"rule_id": "CLAIM-01", "category": "claims"}],
    )
    monkeypatch.setattr(
        "backend.services.scanner.DeterministicEngine.run_all",
        lambda *_args, **_kwargs: [],
    )
    monkeypatch.setattr(
        "backend.services.scanner.SemanticEngine.run",
        lambda *_args, **_kwargs: [],
    )
    monkeypatch.setattr(
        "backend.services.scanner.AuditService.log",
        lambda *_args, **_kwargs: None,
    )

    result = await Scanner.scan_draft(
        "draft-1",
        "creator-1",
        content_text="Creator-reviewed transcript",
        transcript_confirmed=True,
        transcript_source="creator",
    )

    assert result["policy_coverage_status"] == "needs_review"
    assert result["media_analysis"]["transcript"] == "Creator-reviewed transcript"
    assert result["media_analysis"]["transcript_source"] == "creator"
    assert result["media_analysis"]["media_asset_available"] is False
    assert "media_asset" in result["media_analysis"]["missing_capabilities"]


def test_media_findings_are_linked_to_transcript_timestamps_and_video_frames():
    transcript_finding = {"span": "we guarantee results"}
    Scanner._attach_media_location(
        transcript_finding,
        {
            "transcript_segments": [{
                "text": "we guarantee results",
                "start_time": 12.5,
                "end_time": 14.0,
            }]
        },
    )
    frame_finding = {"span": "number one"}
    Scanner._attach_media_location(
        frame_finding,
        {
            "findings": [{
                "text": "number one",
                "frame_number": 3,
                "timestamp_seconds": 20,
            }]
        },
    )

    assert transcript_finding["start_time"] == 12.5
    assert transcript_finding["end_time"] == 14.0
    assert frame_finding["frame_number"] == 3
    assert frame_finding["start_time"] == 20


def test_video_sampling_uses_duration_to_spread_samples_across_full_asset(tmp_path):
    output_commands = []

    def fake_ffmpeg(command, **_kwargs):
        output_commands.append(command)
        Path(command[-1].replace("%03d", "001")).touch()
        return SimpleNamespace(stdout="", stderr="")

    with (
        patch("backend.services.media_analyzer.shutil.which", return_value="ffmpeg"),
        patch("backend.services.media_analyzer.subprocess.run", side_effect=fake_ffmpeg),
        patch.object(
            MediaAnalyzer, "_ocr_image", return_value={"available": True, "text": ""}
        ),
    ):
        frames = MediaAnalyzer._analyze_video_frames(
            tmp_path / "campaign.mp4", duration_seconds=240
        )

    assert "fps=12/240.000000" in output_commands[0]
    assert frames[0]["timestamp_seconds"] == 0
    assert frames[0]["ocr_available"] is True


def test_blank_but_successfully_ocr_scanned_frames_are_not_reported_as_ocr_failure(tmp_path):
    video_path = tmp_path / "campaign.mp4"
    video_path.touch()
    with (
        patch.object(MediaAnalyzer, "_transcribe", return_value={"available": True, "text": "Verified speech"}),
        patch.object(MediaAnalyzer, "_probe_video_duration", return_value=30.0),
        patch.object(
            MediaAnalyzer,
            "_analyze_video_frames",
            return_value=[{"text": "", "ocr_available": True, "frame_number": 1}],
        ),
    ):
        result = MediaAnalyzer.analyze(str(video_path), "video")

    assert "ocr" not in result["missing_capabilities"]
    assert result["frame_sampling"]["sample_count"] == 1
    assert result["frame_sampling"]["exhaustive"] is False
