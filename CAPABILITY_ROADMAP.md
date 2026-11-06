# Capability Roadmap

## What the product needs

### Essential for the current brand-governance MVP

1. **Policy coverage states** - implemented now. A clean scan means “no known
   violation under retrieved policies,” not “guaranteed safe.” Uncovered claim-like
   content is marked `needs_review`, capped below 100%, shown to the creator, and
   blocked from submission until policy coverage is resolved.
2. **Reliable text, image, fact, terminology, approval, and audit workflows** -
   these are the core value proposition and should remain the first operational
   priority.
3. **Production database and object storage** - PostgreSQL with `pgvector` plus
   object storage becomes important when multiple organizations and concurrent
   writers are introduced.
4. **Evaluation with real labelled data** - the current benchmark is useful for
   regression testing, but production quality needs reviewer-labelled examples,
   precision/recall, false-negative tracking, and policy-coverage rates.

### Important, but dependent on product scope

#### Audio and video analysis

The local implementation is now available without changing database engines:
audio/video drafts can be uploaded into SQLite-backed draft records, metadata is
inspected locally and persisted with the draft, and users can provide transcript/caption text for the existing
brand scanner. Media without transcript/caption text is explicitly marked
`needs_review` and cannot be submitted as covered content. automatic speech-to-text, OCR, frame sampling, and timestamped findings are
implemented locally with optional tool dependencies.

The technical metadata foundation now uses Pillow for images, optional `ffprobe`
for audio/video streams, and a WAV parser fallback when `ffprobe` is unavailable.
The multimodal extraction pipeline now persists extraction evidence on revisions,
supports `faster-whisper` when installed for timestamped speech segments, uses
FFmpeg plus Tesseract when installed for sampled video-frame OCR, and attaches
timestamps or frame numbers to matching policy flags. If a capability is
unavailable, the revision remains `needs_review` instead of being treated as
covered.

This is needed if the target users publish podcasts, webinars, reels, video ads, or
voice-over campaigns. It is not required for a text-and-static-image MVP.

Implementation sequence:

1. Store media in object storage and create a `media_assets` record.
2. Extract technical metadata with FFmpeg/MediaInfo.
3. Transcribe audio and speech with a selected speech-to-text provider or local
   model; extract video captions and on-screen frames.
4. Run OCR on sampled frames for visible text.
5. Send transcript, OCR text, timestamps, and sampled visual features through the
   same deterministic and grounded semantic checks.
6. Store findings with `start_time`, `end_time`, or `frame_number`.
7. Display clickable timeline findings and require human approval before release.

Benefits:

- Finds banned claims in spoken scripts and captions.
- Detects outdated facts in video and podcast content.
- Detects off-brand colors, logos, and text inside frames.
- Gives reviewers one audit trail across all campaign formats.

#### MCP

MCP is not required for local correctness. The current Python adapter already
provides a service boundary. MCP becomes useful when the platform must expose
governed capabilities to multiple AI clients or agents.

Implementation sequence:

1. Define narrow tools: retrieve rules, scan draft, explain flag, list approved
   facts, and create an approval request.
2. Validate every MCP request with JWT, organization scope, role, and input limits.
3. Make tools call existing application services rather than duplicate logic.
4. Return structured Pydantic responses with rule citations and coverage status.
5. Add audit events for tool calls, retrieved rule IDs, model provider, and
   approval actions.
6. Add rate limits, timeouts, redaction, and explicit confirmation for mutations.

Benefits:

- Consistent governed access from copilots, IDE agents, CMS plugins, and workflow
  automation.
- Centralized tenant isolation and auditability.
- Easier provider/model replacement.

MCP should not be added merely to claim compliance; it should be added when there
are multiple agent or integration clients that need the same governed operations.

### Later enterprise capabilities

- Rust/Axum media gateway: useful for high-throughput uploads and isolation, but
  not necessary before the Python service is a measured bottleneck.
- Vector RAG with `pgvector`: recommended when guideline collections grow and
  lexical retrieval misses paraphrases.
- SSO, TLS termination, encryption at rest, retention policies, and key management:
  required before handling confidential enterprise material.
- Multilingual and regional policy variants: required for organizations publishing
  across languages or jurisdictions.
- Continuous learning: only after collecting approved, reviewer-labelled overrides;
  never update rules automatically without manager approval.

## Recommended delivery phases

### Phase A - current hardening

- Policy coverage state and human-review gate.
- Database migration tests.
- Regression tests for unsupported claims, empty policy sets, unsupported media,
  and rejected integrations.
- Persist coverage metrics in analytics.

### Phase B - production foundation

- PostgreSQL and `pgvector` deployment path; populate/evaluate embeddings before switching retrieval.
- Object storage and signed media URLs.
- Background job queue for scans.
- Real labelled evaluation set and false-negative dashboard.
- TLS, secrets management, retention, and backups.

### Phase C - multimodal quality

- Improve transcription/OCR quality and confidence handling.
- Persist transcript segments and frame evidence as first-class records.
- Expand timeline review and media-specific approval evidence.

### Phase D - governed ecosystem (optional)

- CMS, Google Docs, and Figma integrations using OAuth and webhooks.
- Integration-level audit and retry handling.

## Success measures

- Policy-coverage rate and percentage of drafts requiring human review.
- False-negative rate on reviewer-labelled claims.
- Flag precision and recall by rule category.
- Time to first feedback for text and media.
- Reviewer override rate by rule.
- Processing cost, queue latency, and failed-job rate.
