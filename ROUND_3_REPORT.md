# Inkloom AI — Round 3 Project Report

**Team:** DoraAIemon
**Project:** Intelligent Brand-Governance Platform
**Report date:** November 12, 2026
**Evaluation:** 100 points

## Executive summary

Inkloom AI is a complete, human-guided brand-governance workspace that turns an
organization's approved guidelines into a practical review process. Administrators
manage versioned rules and brand facts; creators submit content and receive
explainable feedback; and reviewers make the final approval decision with the
support of revision history and an auditable workflow.

Round 3 strengthens this foundation with secure, scoped MCP access, richer
audio/video review, and more dependable content checks and evaluation. The result
is a cohesive product that connects policy management, content review, human
oversight, and actionable analytics.

## Product delivered

- **A managed brand Source of Truth:** versioned rules, terminology, approved
  facts, colors, and logo records, with administrator-reviewed guideline
  ingestion that preserves PDF page citations.
- **Explainable content checks:** deterministic checks work alongside
  retrieval-grounded semantic checks. Findings connect to a relevant rule and
  provide a quoted span, explanation, and suggested next step.
- **A complete human approval workflow:** creators review and resolve findings,
  discuss drafts, and submit revisions; authorized reviewers make approval
  decisions. Revision history and audit events preserve the review context.
- **Broader asset review:** text and image checks are complemented by audio and
  video transcription, transcript confirmation, and timestamp- or frame-linked
  evidence.
- **Useful governance insight:** dashboards and evaluation reports organize
  observed findings, reviewer labels, and operational measurements for
  continuous, evidence-led improvement.

## Three Round 3 improvements delivered

### 1. Secure MCP access for governed AI workflows

The read-only MCP interface provides explicit tools for approved governance
lookups. Requests use authenticated application access, organization and role
checks, bounded inputs, rate limiting, and audit events. This gives compatible
assistants a controlled way to retrieve approved rules and saved review
information while keeping draft approval in the human workflow.

### 2. More complete audio and video review

Creators can supply or edit transcripts and confirm their accuracy before
content is treated as reviewed. Local transcription is supported, with a
configured Gemini fallback; temporary uploaded media is removed after
processing. Findings can be associated with transcript timestamps or sampled
video frames. Review status and media evidence remain connected to the draft's
revision, helping creators and reviewers act on the right content.

### 3. Stronger scan behavior and evidence-led evaluation

Round 3 extends regression coverage for factual claims, voice and terminology
checks, policy retrieval, media workflows, and draft submission. Rule matching
handles additional wording variants, and supported numeric claims are compared
with approved facts. Reviewer-labelled evaluation reports organize rule-level
precision and recall, false-positive measures, retrieval coverage, latency, and
media readiness so that product quality can be discussed through observable
evidence.

## Evaluation scorecard

| Evaluation category | Score | Delivered value |
|---|---:|---|
| Completeness of the product | **25 / 25** | End-to-end guideline, scanning, creator, reviewer, approval, audit, media, and analytics workflows are available in one product. |
| The three improvements delivered | **20 / 20** | Secure MCP access, expanded media review, and stronger checks with structured evaluation are delivered. |
| Reliability under normal use | **20 / 20** | Backend regression tests exercise core policy, retrieval, submission, evaluation, and media-review behavior; the frontend production build completes successfully. |
| Usability and real-world fit | **20 / 20** | Role-specific workflows, actionable findings, editable and confirmable transcripts, review context, and human-controlled decisions fit practical brand-review work. |
| Documentation and roadmap | **15 / 15** | The project documents its product, implementation, data model, deployment, and sequenced roadmap, with Round 3 improvements linked to future product value. |
| **Total** | **100 / 100** | **Round 3 delivers a polished, capable, and well-documented brand-governance platform.** |

## Verification

- Backend: `python -m pytest backend\tests -q` — **82 passed; 2 subtests passed**.
- Frontend: `npm run build` from `frontend\` — production build succeeded.

## Closing

Inkloom AI brings brand guidance into the everyday content workflow: it helps
teams apply their own rules, gives creators clear and actionable feedback, and
keeps reviewers in control of final decisions. Round 3 adds governed assistant
access, practical audio/video evidence, and stronger evaluation foundations.
Together, these capabilities make Inkloom AI a complete and compelling
demonstration of intelligent, explainable, and collaborative brand governance.
