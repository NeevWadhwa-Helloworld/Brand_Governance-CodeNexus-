import asyncio
import json
import re
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

from backend.database import get_db
from backend.services.audit_service import AuditService
from backend.services.deterministic_engine import DeterministicEngine
from backend.services.rag_service import RAGService
from backend.services.semantic_engine import SemanticEngine
from backend.services.media_analyzer import MediaAnalyzer
from backend.config import settings


class Scanner:
    """Run both checking layers, persist findings, and assess policy coverage."""

    @classmethod
    async def scan_draft(
        cls,
        draft_id: str,
        user_id: str,
        content_text: Optional[str] = None,
        image_path: Optional[str] = None,
    ) -> Dict[str, Any]:
        start_time = time.time()
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM drafts WHERE id = ?", (draft_id,))
            draft = cursor.fetchone()
            if not draft:
                raise ValueError("Draft not found")

            org_id = draft["org_id"]
            curr_version = draft["current_version"]
            content_type = draft["content_type"]
            media_ref = draft.get("content_ref")
            if content_text is None and image_path is None:
                cursor.execute(
                    "SELECT * FROM revisions WHERE draft_id = ? AND version_num = ?",
                    (draft_id, curr_version),
                )
                revision = cursor.fetchone()
                if revision:
                    content_text = revision.get("content_text")
                    image_path = revision.get("image_path")

        media_analysis = {}
        if content_type in {"image", "audio", "video"}:
            media_path = image_path
            if not media_path and media_ref and media_ref.startswith("/static/uploads/"):
                media_path = str(settings.STATIC_UPLOAD_DIR / Path(media_ref).name)
            if media_path:
                if content_type == "image":
                    image_path = media_path
                media_analysis = await asyncio.to_thread(
                    MediaAnalyzer.analyze, media_path, content_type
                )
                if content_text and content_type in {"audio", "video"}:
                    media_analysis["transcript"] = content_text
                    media_analysis["capabilities"]["speech_to_text"] = True
                    media_analysis["missing_capabilities"] = [
                        item for item in media_analysis.get("missing_capabilities", [])
                        if item != "speech_to_text"
                    ]
                    media_analysis["extraction_status"] = (
                        "complete" if not media_analysis["missing_capabilities"] else "needs_review"
                    )
                extracted_text = media_analysis.get("extracted_text", "").strip()
                if extracted_text:
                    content_text = "\n".join(
                        part for part in [content_text, extracted_text] if part
                    ).strip()

        coverage_status, coverage_reason = cls._assess_policy_coverage(
            org_id, content_text, image_path, content_type
        )
        missing_capabilities = media_analysis.get("missing_capabilities", [])
        if missing_capabilities:
            coverage_status = "needs_review"
            coverage_reason = "Media extraction is incomplete: " + ", ".join(missing_capabilities) + "."

        layer1_task = asyncio.to_thread(
            DeterministicEngine.run_all,
            org_id,
            text=content_text,
            image_path=image_path if content_type == "image" else None,
        )
        if content_text or image_path:
            layer2_task = asyncio.to_thread(
                SemanticEngine.run,
                org_id,
                text=content_text or "",
                image_path=image_path if content_type == "image" else None,
            )
            layer1_flags, layer2_flags = await asyncio.gather(layer1_task, layer2_task)
        else:
            layer1_flags = await layer1_task
            layer2_flags = []

        seen_spans = set()
        deduped_flags = []
        for flag in layer1_flags + layer2_flags:
            key = (flag["rule_id"], flag["span"].lower().strip())
            if key not in seen_spans:
                cls._attach_media_location(flag, media_analysis)
                seen_spans.add(key)
                deduped_flags.append(flag)

        if not deduped_flags:
            compliance_score = 100.0
        else:
            deduction = sum(
                15.0 if flag.get("layer") == "layer1_deterministic" else 12.0
                for flag in deduped_flags
            )
            compliance_score = max(10.0, round(100.0 - deduction, 1))
        if coverage_status == "needs_review":
            compliance_score = min(compliance_score, 99.0)

        revision_id = str(uuid.uuid4())
        timestamp = datetime.utcnow().isoformat() + "Z"
        stored_flags = []
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO revisions (
                    id, draft_id, version_num, content_text, image_path, compliance_score,
                    policy_coverage_status, policy_coverage_reason, media_analysis, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    revision_id,
                    draft_id,
                    curr_version,
                    content_text,
                    image_path,
                    compliance_score,
                    coverage_status,
                    coverage_reason,
                    json.dumps(media_analysis) if media_analysis else None,
                    timestamp,
                ),
            )
            for flag in deduped_flags:
                flag_id = str(uuid.uuid4())
                cursor.execute(
                    """
                    INSERT INTO flags (
                        id, revision_id, rule_id, category, span, start_idx, end_idx,
                        start_time, end_time, frame_number, explanation, fix, confidence, resolution, layer
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
                    """,
                    (
                        flag_id,
                        revision_id,
                        flag["rule_id"],
                        flag["category"],
                        flag["span"],
                        flag.get("start_idx", -1),
                        flag.get("end_idx", -1),
                        flag.get("start_time"),
                        flag.get("end_time"),
                        flag.get("frame_number"),
                        flag["explanation"],
                        flag["fix"],
                        flag["confidence"],
                        flag["layer"],
                    ),
                )
                stored_flags.append(
                    {
                        "id": flag_id,
                        "revision_id": revision_id,
                        **flag,
                        "resolution": "pending",
                    }
                )

            new_status = "In Revision" if deduped_flags else "Scanned"
            cursor.execute(
                """
                UPDATE drafts
                SET status = ?, content_ref = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    new_status,
                    content_text if content_type == "text" else (draft.get("content_ref") or image_path),
                    timestamp,
                    draft_id,
                ),
            )

        duration_ms = round((time.time() - start_time) * 1000, 2)
        AuditService.log(
            org_id=org_id,
            user_id=user_id,
            action="scan_completed",
            details={
                "revision_id": revision_id,
                "version_num": curr_version,
                "flags_detected": len(stored_flags),
                "compliance_score": compliance_score,
                "policy_coverage_status": coverage_status,
                "media_missing_capabilities": missing_capabilities,
                "duration_ms": duration_ms,
            },
            draft_id=draft_id,
        )
        return {
            "draft_id": draft_id,
            "revision_id": revision_id,
            "version_num": curr_version,
            "compliance_score": compliance_score,
            "flags_count": len(stored_flags),
            "flags": stored_flags,
            "scan_duration_ms": duration_ms,
            "status": new_status,
            "policy_coverage_status": coverage_status,
            "policy_coverage_reason": coverage_reason,
            "media_analysis": media_analysis,
        }

    @staticmethod
    def _attach_media_location(flag: Dict[str, Any], media_analysis: Dict[str, Any]) -> None:
        span = flag.get("span", "").strip().lower()
        if not span:
            return
        for segment in media_analysis.get("transcript_segments", []):
            if span in segment.get("text", "").lower():
                flag["start_time"] = segment.get("start_time")
                flag["end_time"] = segment.get("end_time")
                return
        for frame in media_analysis.get("findings", []):
            if span in frame.get("text", "").lower():
                flag["frame_number"] = frame.get("frame_number")
                flag["start_time"] = frame.get("timestamp_seconds")
                return

    @classmethod
    def _assess_policy_coverage(
        cls, org_id: str, content_text: Optional[str], image_path: Optional[str],
        content_type: str = "text"
    ) -> tuple[str, Optional[str]]:
        if content_type in {"audio", "video"} and not content_text:
            return (
                "needs_review",
                f"This {content_type} has no transcript or caption text. Human review is required.",
            )
        if not content_text and not image_path:
            return "needs_review", "No scannable content was provided."

        rules = RAGService.retrieve_relevant_rules(
            org_id,
            content_text or "visual asset color logo contrast accessibility",
            top_k=8,
        )
        if not rules:
            return "needs_review", "No active company policy could be retrieved for this content."

        if content_text:
            claim_like = re.search(
                r"(#\s*\d+|number\s+one|the\s+best|guarantee(?:d|s)?|"
                r"\bresults?\b|\bleader\b|\blargest\b|\bfastest\b|\bonly\b|"
                r"zero[-\s]?effort)",
                content_text,
                re.IGNORECASE,
            )
            if claim_like and not any(rule["category"] == "claims" for rule in rules):
                return (
                    "needs_review",
                    "Promotional or factual claim-like language was found, but no applicable claims policy was retrieved.",
                )

        if image_path and not any(
            rule["category"] in {"color", "logo", "accessibility"} for rule in rules
        ):
            return (
                "needs_review",
                "No color, logo, or accessibility policy was retrieved for this visual asset.",
            )

        return "covered", None
