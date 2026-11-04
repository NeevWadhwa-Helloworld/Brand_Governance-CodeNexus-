import time
import uuid
from datetime import datetime
from typing import Dict, Any, Optional
from backend.database import get_db
from backend.services.deterministic_engine import DeterministicEngine
from backend.services.semantic_engine import SemanticEngine
from backend.services.audit_service import AuditService

class Scanner:
    """
    Two-layer brand governance scanner orchestrator:
    Executes Layer 1 (Deterministic checks) and Layer 2 (Semantic LLM+RAG checks) concurrently,
    aggregates results, computes compliance score, and saves revision flags.
    """

    @classmethod
    def scan_draft(
        cls,
        draft_id: str,
        user_id: str,
        content_text: Optional[str] = None,
        image_path: Optional[str] = None
    ) -> Dict[str, Any]:
        start_time = time.time()

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM drafts WHERE id = ?", (draft_id,))
            draft = cursor.fetchone()
            if not draft:
                raise ValueError("Draft not found")

            org_id = draft['org_id']
            curr_version = draft['current_version']

            # If content not passed explicitly, load from latest revision
            if content_text is None and image_path is None:
                cursor.execute("""
                    SELECT * FROM revisions
                    WHERE draft_id = ? AND version_num = ?
                """, (draft_id, curr_version))
                rev = cursor.fetchone()
                if rev:
                    content_text = rev.get('content_text')
                    image_path = rev.get('image_path')

        # 1. Execute Layer 1 - Deterministic checks (exact, zero AI cost)
        layer1_flags = DeterministicEngine.run_all(org_id, text=content_text, image_path=image_path)

        # 2. Execute Layer 2 - Semantic checks (LLM + RAG with strict grounding)
        layer2_flags = []
        if content_text:
            layer2_flags = SemanticEngine.run(org_id, text=content_text, image_path=image_path)

        all_flags = layer1_flags + layer2_flags

        # Deduplicate any overlapping spans
        seen_spans = set()
        deduped_flags = []
        for f in all_flags:
            key = (f['rule_id'], f['span'].lower().strip())
            if key not in seen_spans:
                seen_spans.add(key)
                deduped_flags.append(f)

        # Calculate Compliance Score (0 to 100%)
        # Perfect compliance is 100%. Deductions based on flag severity/count.
        if not deduped_flags:
            compliance_score = 100.0
        else:
            deduction = sum(15.0 if f.get('layer') == 'layer1_deterministic' else 12.0 for f in deduped_flags)
            compliance_score = max(10.0, round(100.0 - deduction, 1))

        duration_ms = round((time.time() - start_time) * 1000, 2)

        # Save new or updated revision in DB
        rev_id = str(uuid.uuid4())
        timestamp = datetime.utcnow().isoformat() + "Z"

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO revisions (id, draft_id, version_num, content_text, image_path, compliance_score, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (rev_id, draft_id, curr_version, content_text, image_path, compliance_score, timestamp))

            stored_flags = []
            for f in deduped_flags:
                flag_id = str(uuid.uuid4())
                cursor.execute("""
                    INSERT INTO flags (
                        id, revision_id, rule_id, category, span, start_idx, end_idx,
                        explanation, fix, confidence, resolution, layer
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
                """, (
                    flag_id, rev_id, f['rule_id'], f['category'], f['span'],
                    f.get('start_idx', -1), f.get('end_idx', -1),
                    f['explanation'], f['fix'], f['confidence'], f['layer']
                ))
                stored_flags.append({
                    "id": flag_id,
                    "revision_id": rev_id,
                    **f,
                    "resolution": "pending"
                })

            # Transition draft status to 'Scanned' or 'In Revision'
            new_status = 'In Revision' if deduped_flags else 'Scanned'
            cursor.execute("""
                UPDATE drafts
                SET status = ?, content_ref = ?, updated_at = ?
                WHERE id = ?
            """, (new_status, content_text if draft['content_type'] == 'text' else image_path, timestamp, draft_id))

        # Log audit entry
        AuditService.log(
            org_id=org_id,
            user_id=user_id,
            action="scan_completed",
            details={
                "revision_id": rev_id,
                "version_num": curr_version,
                "flags_detected": len(stored_flags),
                "compliance_score": compliance_score,
                "duration_ms": duration_ms
            },
            draft_id=draft_id
        )

        return {
            "draft_id": draft_id,
            "revision_id": rev_id,
            "version_num": curr_version,
            "compliance_score": compliance_score,
            "flags_count": len(stored_flags),
            "flags": stored_flags,
            "scan_duration_ms": duration_ms,
            "status": new_status
        }
