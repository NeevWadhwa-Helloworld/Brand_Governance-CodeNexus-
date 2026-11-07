import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List
from backend.database import get_db

logger = logging.getLogger(__name__)


class AnalyticsService:
    """
    Governance Analytics Engine:
    Tracks repeated mistakes, top flagged terms, compliance rate trends,
    AI flag precision, and generates actionable guideline improvement insights.
    """

    @classmethod
    def get_dashboard_metrics(cls, org_id: str) -> Dict[str, Any]:
        approval_cycles = {}
        scan_durations_ms = []
        with get_db() as conn:
            cursor = conn.cursor()

            # 1. Total drafts and revisions
            cursor.execute("SELECT COUNT(*) as total FROM drafts WHERE org_id = ?", (org_id,))
            total_drafts = cursor.fetchone()['total']

            cursor.execute("""
                SELECT COUNT(*) as approved_count FROM drafts
                WHERE org_id = ? AND status = 'Approved'
            """, (org_id,))
            approved_drafts = cursor.fetchone()['approved_count']

            # 2. Flag resolutions: Accepted, Edited, Dismissed
            cursor.execute("""
                SELECT f.resolution, COUNT(*) as cnt
                FROM flags f
                JOIN revisions r ON f.revision_id = r.id
                JOIN drafts d ON r.draft_id = d.id
                WHERE d.org_id = ?
                GROUP BY f.resolution
            """, (org_id,))
            res_rows = cursor.fetchall()
            resolution_counts = {r['resolution']: r['cnt'] for r in res_rows}
            accepted_cnt = resolution_counts.get('accepted', 0)
            edited_cnt = resolution_counts.get('edited', 0)
            dismissed_cnt = resolution_counts.get('dismissed', 0)
            total_resolved = accepted_cnt + edited_cnt + dismissed_cnt

            # Flag Precision: (Accepted + Edited) / Total Resolved
            if total_resolved > 0:
                flag_precision = round(((accepted_cnt + edited_cnt) / total_resolved) * 100, 1)
            else:
                flag_precision = None

            # 3. First-Pass Compliance Rate
            # Proportion of initial drafts (version_num = 1) that had compliance >= 80% or 0 critical flags
            cursor.execute("""
                SELECT r.compliance_score
                FROM revisions r
                JOIN drafts d ON r.draft_id = d.id
                WHERE d.org_id = ? AND r.version_num = 1
            """, (org_id,))
            initial_revs = cursor.fetchall()
            if initial_revs:
                pass_count = sum(1 for r in initial_revs if r['compliance_score'] >= 80.0)
                first_pass_rate = round((pass_count / len(initial_revs)) * 100, 1)
            else:
                first_pass_rate = None

            # 4. Top Flagged Terms & Rules
            cursor.execute("""
                SELECT f.span as term, f.rule_id, f.category, COUNT(*) as occurrences,
                       SUM(CASE WHEN f.resolution = 'accepted' THEN 1 ELSE 0 END) as accepted,
                       SUM(CASE WHEN f.resolution = 'dismissed' THEN 1 ELSE 0 END) as dismissed
                FROM flags f
                JOIN revisions r ON f.revision_id = r.id
                JOIN drafts d ON r.draft_id = d.id
                WHERE d.org_id = ?
                GROUP BY f.span, f.rule_id, f.category
                ORDER BY occurrences DESC
                LIMIT 6
            """, (org_id,))
            top_flagged_terms = cursor.fetchall()

            # 5. Violations by Category
            cursor.execute("""
                SELECT f.category, COUNT(*) as count
                FROM flags f
                JOIN revisions r ON f.revision_id = r.id
                JOIN drafts d ON r.draft_id = d.id
                WHERE d.org_id = ?
                GROUP BY f.category
                ORDER BY count DESC
            """, (org_id,))
            category_breakdown = cursor.fetchall()

            cursor.execute("""
                SELECT draft_id, action, timestamp, details
                FROM audit_logs
                WHERE org_id = ? AND action IN ('submitted_for_approval', 'draft_approved', 'scan_completed')
            """, (org_id,))
            audit_rows = cursor.fetchall()
            for row in audit_rows:
                if row["action"] == "scan_completed":
                    try:
                        details = row["details"]
                        if isinstance(details, str):
                            details = json.loads(details)
                        duration_ms = float(details.get("duration_ms"))
                        if duration_ms >= 0:
                            scan_durations_ms.append(duration_ms)
                    except (AttributeError, TypeError, ValueError, json.JSONDecodeError):
                        logger.warning("Skipping scan event with invalid duration for draft %s", row["draft_id"])
                    continue

                if not row["draft_id"]:
                    continue
                try:
                    event_time = cls._parse_timestamp(row["timestamp"])
                except (TypeError, ValueError):
                    logger.warning("Skipping invalid approval timestamp for draft %s", row["draft_id"])
                    continue
                events = approval_cycles.setdefault(row["draft_id"], {})
                action = row["action"]
                if action not in events or event_time < events[action]:
                    events[action] = event_time

            measured_turnarounds = [
                max(0.0, (events["draft_approved"] - events["submitted_for_approval"]).total_seconds())
                for events in approval_cycles.values()
                if "submitted_for_approval" in events and "draft_approved" in events
            ]
            turnaround_improvement = (
                round(max(0.0, (1 - (sum(measured_turnarounds) / len(measured_turnarounds)) / 172800) * 100), 1)
                if measured_turnarounds else None
            )
            avg_first_feedback_seconds = (
                round(sum(scan_durations_ms) / len(scan_durations_ms) / 1000, 3)
                if scan_durations_ms else None
            )

            # 6. Actionable Governance Insights (Rule Clarification Recommendations)
            recommendations = []
            for item in top_flagged_terms:
                if item['occurrences'] >= 2 and item['dismissed'] > 0:
                    recommendations.append({
                        "rule_id": item['rule_id'],
                        "term": item['term'],
                        "reason": f"High creator dismissal rate on '{item['term']}'. Consider refining guideline clause {item['rule_id']} with situational context.",
                        "action": "Clarify Guideline"
                    })
            # 7. Daily compliance & activity time-series trends
            cursor.execute("""
                SELECT substr(r.created_at, 1, 10) as scan_date,
                       ROUND(CAST(AVG(r.compliance_score) AS NUMERIC), 1) as avg_compliance,
                       COUNT(DISTINCT r.id) as scan_count,
                       COUNT(f.id) as flag_count
                FROM revisions r
                JOIN drafts d ON r.draft_id = d.id
                LEFT JOIN flags f ON f.revision_id = r.id
                WHERE d.org_id = ?
                GROUP BY scan_date
                ORDER BY scan_date ASC
                LIMIT 14
            """, (org_id,))
            trend_rows = cursor.fetchall()

        return {
            "summary": {
                "total_drafts": total_drafts,
                "approved_drafts": approved_drafts,
                "flag_precision": flag_precision,
                "target_precision": 85.0,
                "first_pass_compliance_rate": first_pass_rate,
                "target_first_pass": 80.0,
                "avg_turnaround_improvement": turnaround_improvement,
                "target_turnaround_improvement": 50.0,
                "avg_first_feedback_seconds": avg_first_feedback_seconds,
                "target_feedback_seconds": 30.0
            },
            "top_flagged_terms": top_flagged_terms,
            "category_breakdown": category_breakdown,
            "compliance_trends": trend_rows or [],
            "resolution_stats": {
                "accepted": accepted_cnt,
                "edited": edited_cnt,
                "dismissed": dismissed_cnt,
                "pending": resolution_counts.get('pending', 0)
            },
            "governance_recommendations": recommendations
        }

    @staticmethod
    def _parse_timestamp(value: Any) -> datetime:
        if isinstance(value, datetime):
            parsed = value
        elif isinstance(value, str):
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        else:
            raise ValueError("Unsupported audit timestamp type")

        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)

    @classmethod
    def get_trends(cls, org_id: str) -> List[Dict[str, Any]]:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT substr(r.created_at, 1, 10) AS date,
                       ROUND(CAST(AVG(r.compliance_score) AS NUMERIC), 1) AS compliance_score,
                       COUNT(DISTINCT r.id) AS scans,
                       COUNT(f.id) AS flags
                FROM revisions r
                JOIN drafts d ON d.id = r.draft_id
                LEFT JOIN flags f ON f.revision_id = r.id
                WHERE d.org_id = ?
                GROUP BY date
                ORDER BY date ASC
                LIMIT 30
            """, (org_id,))
            return cursor.fetchall()
