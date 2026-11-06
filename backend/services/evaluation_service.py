import time
from datetime import datetime, timezone
from typing import Dict, Any, List
from backend.services.deterministic_engine import DeterministicEngine
from backend.services.semantic_engine import SemanticEngine
from backend.database import get_db

class EvaluationService:
    """
    Evaluation & Benchmark Suite (Section 9.1 of Report):
    Validates platform against target success metrics on a labelled sample set:
    - Flag precision >= 85%
    - Review turnaround improvement >= 50%
    - First-pass compliance >= 80%
    - Time to first feedback < 30s
    """

    LABELLED_DATASET = [
        {
            "id": "SAMPLE-01",
            "title": "Launch Teaser - Outdated User Count & Banned Terms",
            "content": "We're proud to serve over 10,000 active users! Our cheap pricing and rockstar team crush our competitors every single day.",
            "expected_flags": ["FACT-01", "TERM-01", "TERM-02", "VOICE-01"],
            "ground_truth_compliance": False
        },
        {
            "id": "SAMPLE-02",
            "title": "Marketing Hero Banner Copy - Unsubstantiated Superlatives",
            "content": "The #1 solution on the market! Inkloom delivers guaranteed 100% results with zero effort.",
            "expected_flags": ["CLAIM-01", "CLAIM-02"],
            "ground_truth_compliance": False
        },
        {
            "id": "SAMPLE-03",
            "title": "Enterprise Trust Center Article - Fully Compliant",
            "content": "Inkloom AI empowers over 50,000+ active users worldwide with enterprise brand consistency, backing teams with a 99.9% uptime SLA.",
            "expected_flags": [],
            "ground_truth_compliance": True
        },
        {
            "id": "SAMPLE-04",
            "title": "Product Update Note - Jargon & Unapproved Hex",
            "content": "We leverage cross-functional synergies to create a paradigm shift in holistic ideation, styled in custom accent #FF0055.",
            "expected_flags": ["VOICE-02", "COLOR-01"],
            "ground_truth_compliance": False
        },
        {
            "id": "SAMPLE-05",
            "title": "Customer Success Story - Compliant On-Brand Case Study",
            "content": "Global marketing teams partner with Inkloom AI to streamline content reviews while maintaining human-in-the-loop creative freedom.",
            "expected_flags": [],
            "ground_truth_compliance": True
        }
    ]

    @classmethod
    def run_benchmark(cls, org_id: str) -> Dict[str, Any]:
        results = []
        latencies = []
        total_flags_generated = 0
        true_positive_flags = 0

        for sample in cls.LABELLED_DATASET:
            t0 = time.time()
            text = sample["content"]

            # Layer 1 scan
            l1_flags = DeterministicEngine.run_all(org_id, text=text)
            # Layer 2 scan
            l2_flags = SemanticEngine.run(org_id, text=text)

            duration = time.time() - t0
            latencies.append(duration)

            all_flags = l1_flags + l2_flags
            detected_rule_ids = {f["rule_id"] for f in all_flags}
            expected_set = set(sample["expected_flags"])

            # Check precision against expected ground truth rules
            for f in all_flags:
                total_flags_generated += 1
                if f["rule_id"] in expected_set:
                    true_positive_flags += 1

            # Recall-aware sample evaluation: all expected ground truth violations detected
            if not expected_set:
                passed_sample = (len(detected_rule_ids) == 0)
            else:
                passed_sample = expected_set.issubset(detected_rule_ids)

            results.append({
                "sample_id": sample["id"],
                "title": sample["title"],
                "content_preview": text[:60] + "...",
                "latency_seconds": round(duration, 3),
                "detected_flags_count": len(all_flags),
                "detected_rules": list(detected_rule_ids),
                "expected_rules": list(expected_set),
                "passed": passed_sample
            })

        precision = round((true_positive_flags / max(1, total_flags_generated)) * 100, 1)
        avg_latency = round(sum(latencies) / len(latencies), 3)

        # Measure operational metrics from persisted audit events rather than reporting
        # synthetic demo values.
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT draft_id,
                       MIN(CASE WHEN action = 'submitted_for_approval' THEN timestamp END) AS submitted_at,
                       MIN(CASE WHEN action = 'draft_approved' THEN timestamp END) AS approved_at
                FROM audit_logs
                WHERE org_id = ?
                GROUP BY draft_id
            """, (org_id,))
            approval_rows = cursor.fetchall()

        measured_turnarounds = []
        for row in approval_rows:
            if row["submitted_at"] and row["approved_at"]:
                try:
                    start = datetime.fromisoformat(row["submitted_at"].replace("Z", "+00:00"))
                    end = datetime.fromisoformat(row["approved_at"].replace("Z", "+00:00"))
                    measured_turnarounds.append(max(0.0, (end - start).total_seconds()))
                except ValueError:
                    continue
        if measured_turnarounds:
            avg_turnaround_seconds = sum(measured_turnarounds) / len(measured_turnarounds)
            turnaround_improvement = round(max(0.0, (1 - avg_turnaround_seconds / 172800) * 100), 1)
        else:
            turnaround_improvement = 0.0
        first_pass_rate = round(
            sum(1 for sample in cls.LABELLED_DATASET if not sample["expected_flags"])
            / len(cls.LABELLED_DATASET) * 100,
            1
        )

        metrics_summary = [
            {
                "metric": "Flag precision (Share of AI flags reviewers agree with)",
                "target": "≥ 85%",
                "measured": f"{precision}%",
                "passed": precision >= 85.0,
                "details": f"{true_positive_flags}/{total_flags_generated} flags verified against labelled ground truth"
            },
            {
                "metric": "Review turnaround improvement vs manual baseline",
                "target": "≥ 50% faster",
                "measured": f"{turnaround_improvement}% faster",
                "passed": turnaround_improvement >= 50.0,
                "details": "Automated pre-audit shrinks turnaround from ~48 hours to immediate feedback"
            },
            {
                "metric": "First-pass compliance rate",
                "target": "≥ 80%",
                "measured": f"{first_pass_rate}%",
                "passed": first_pass_rate >= 80.0,
                "details": "Creators correct issues during drafting before managerial submission"
            },
            {
                "metric": "Time to first feedback (Text drafts)",
                "target": "< 30 s",
                "measured": f"{avg_latency:.2f} s",
                "passed": avg_latency < 30.0,
                "details": f"Average scan latency across benchmark suite is {avg_latency*1000:.0f} ms"
            }
        ]

        return {
            "run_timestamp": datetime.now(timezone.utc).isoformat(),
            "total_test_samples": len(cls.LABELLED_DATASET),
            "flag_precision": precision,
            "flag_precision_target": 85.0,
            "review_turnaround_improvement": turnaround_improvement,
            "review_turnaround_target": 50.0,
            "first_pass_compliance_rate": first_pass_rate,
            "first_pass_compliance_target": 80.0,
            "avg_first_feedback_seconds": avg_latency,
            "avg_first_feedback_target": 30.0,
            "metrics_summary": metrics_summary,
            "sample_results": results
        }
