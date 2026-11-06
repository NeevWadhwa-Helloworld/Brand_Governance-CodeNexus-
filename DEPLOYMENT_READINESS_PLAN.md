# Deployment Readiness Plan

## Current validated baseline

- JWT login, role-based navigation, organization-scoped access, creator/reviewer/admin flows.
- Text draft creation, deterministic and semantic scanning, grounded flags, fixes, comments, approval, and audit history.
- Image upload with dimensions, palette, contrast, logo checks, and OCR capability reporting.
- Audio upload with technical metadata, optional local Whisper transcription, and explicit human-review fallback.
- Video upload with technical metadata, transcript/caption scanning, FFmpeg frame sampling, OCR capability reporting, and explicit human-review fallback.
- Analytics, benchmark execution, source-of-truth management, team account creation, audit export, and audit-chain verification.
- Supabase PostgreSQL with pgvector support, Render/Vercel deployment
  configuration, security headers, trusted-host validation, request-size limits,
  and SQLite migration tooling.

## Release blockers

1. Replace local filesystem uploads with object storage and signed URLs.
2. Move scanning and transcription/OCR into background jobs with progress and retry states.
3. Run the embedding backfill and evaluate retrieval quality before relying on vector similarity as the primary retriever.
4. Add TLS termination, secret management, encrypted backups, retention/deletion policies, rate limits, and MIME/type validation.
5. Add independent reviewer-labelled evaluation data and track precision, recall, false negatives, coverage rate, latency, and processing cost.
6. Add automated integration, API authorization, media, migration, and browser regression suites to CI.

## Delivery phases

### Phase 1 - harden the local release

- Pin Python and Node versions and lock dependencies.
- Add test fixtures for text, image, WAV, short video, long video, missing transcript, missing OCR, and unsupported media.
- Make the frontend display structured API errors instead of generic request failures.
- Add cleanup and retention jobs for uploaded media.

### Phase 2 - production foundation

- Introduce PostgreSQL migrations and a repository/service abstraction.
- Add object storage with private buckets and signed read URLs.
- Add a queue worker for scans, transcription, OCR, and frame extraction.
- Add observability: structured logs, request IDs, metrics, tracing, and alerting.

### Phase 3 - multimodal quality

- Choose and benchmark a transcription provider/model.
- Add OCR language configuration and confidence thresholds.
- Persist timestamped transcript segments and frame evidence as first-class records.
- Add timeline review controls and clickable media findings.
- Add reviewer feedback loops without automatically changing policies.

### Phase 4 - governed ecosystem

- Implement MCP only when multiple agent or integration clients need the same governed operations.
- Add OAuth/webhook adapters for CMS, Google Docs, Figma, Webflow, and HubSpot.
- Add idempotency, retries, provider health checks, and integration audit events.

## Production acceptance gates

- No cross-organization reads or writes under authorization tests.
- No unsupported or unextracted media is marked covered.
- Every automated finding cites a retrieved rule or is rejected.
- Failed jobs are visible, retryable, and auditable.
- Backups are restorable and retention/deletion requests are testable.
- Browser smoke tests pass for each role and each supported content type.
