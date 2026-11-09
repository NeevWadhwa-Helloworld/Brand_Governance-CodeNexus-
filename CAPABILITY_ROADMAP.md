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
4. **Evaluation with real labelled data** - reviewer labeling and reporting for
   precision, recall, false positives, rule-retrieval coverage, and latency are
   implemented. Real examples still need to be added before the numbers can support
   production quality claims.

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

Creators can now edit and explicitly confirm extracted or manually supplied
transcripts, see the extraction/confirmation state and review gaps, and rescan.
Video frame previews link to sampled points in the source video. Unconfirmed
transcripts or unavailable required extraction stay in human review and cannot
be submitted as covered content.

This is needed if the target users publish podcasts, webinars, reels, video ads, or
voice-over campaigns. It is not required for a text-and-static-image MVP.

Remaining production work:

1. Move media to object storage with private/signed access.
2. Select and evaluate transcription/OCR providers, including confidence and
   accuracy checks.
3. Add robust visual brand-element review and persist transcript/frame evidence
   as first-class records.
4. Keep optional extractor dependencies available in production and monitor
   failed jobs.

Benefits:

- Finds banned claims in spoken scripts and captions.
- Detects outdated facts in video and podcast content.
- Detects off-brand colors, logos, and text inside frames.
- Gives reviewers one audit trail across all campaign formats.

#### MCP

The backend exposes a Streamable HTTP MCP server with tools to retrieve active
brand rules, list limited draft metadata, and retrieve saved findings. It is
read-only: it cannot return draft body text, edit or create drafts, trigger scans,
approve/publish content, or access arbitrary database/filesystem paths. Requests
require the application's bearer JWT, use the authenticated user's organization,
enforce governance roles, and audit tool calls and denied cross-organization
lookups. Tool input sizes and per-user request frequency are bounded. The
in-memory rate limit is per backend process, so a scaled deployment still needs
an edge or shared rate limiter. This is user-token authorization, not a
server-side MCP client registry or OAuth client-approval flow.

Remaining implementation sequence:

1. Deploy over HTTPS and validate an organization's chosen MCP client.
2. Add OAuth/client registration if organization-managed client approvals are
   required.
3. Add a shared or edge-enforced rate limit before horizontal scaling.
4. Keep approval and publishing behind the application's explicit human review
   workflow.

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
- Reviewer-labeled dataset schema and quality-metrics dashboard.
- Add and review enough representative, human-labeled examples to make the
  implemented quality metrics meaningful.
- TLS, secrets management, retention, and backups.

### Phase C - multimodal quality

- Improve transcription/OCR quality and confidence handling.
- Persist transcript segments and frame evidence as first-class records.
- Expand timeline review and media-specific approval evidence beyond the current
  transcript editor and sampled-frame workflow.

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
