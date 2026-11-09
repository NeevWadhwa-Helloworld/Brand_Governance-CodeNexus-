# Inkloom AI
## Project, Architecture, Implementation, and Round 3 Roadmap

**Project:** Intelligent Brand-Governance Platform
**Product name:** Inkloom AI
**Team:** DoraAIemon
**Prepared:** November 7, 2026
**Reference plan:** *Brand_Governance_Plan (1).pdf* — Round 1 Submission: The Plan, November 3, 2026
**Implementation snapshot:** commit `251814f` on `main`

---

## 1. What we built

Inkloom AI is a brand-governance review workspace. It helps an organization turn its brand guidance into managed rules and approved facts, check draft content against that information, explain issues, and route drafts through human review before approval.

The application brings several steps into one workflow:

- Administrators manage guideline versions, numbered rules, prohibited and preferred terminology, approved facts, brand colors, and logo records.
- Creators submit text or media drafts and see automated findings and suggestions.
- Reviewers inspect the draft and its findings, discuss changes, and make the final approval decision.
- The system keeps revision history, finding resolutions, comments, and audit events for later review.

The product is designed as a **configurable, organization-specific platform**, not a claim that every firm uses identical brand rules or review procedures. A future customer deployment would be configured and, where needed, adapted to that firm's workflow, policies, storage, and security requirements. The current web application is a demonstration of the product concept and end-to-end workflow.

The current demonstration uses a hosted web frontend and backend, with Gemini API calls when credentials are configured. These choices make the prototype accessible and practical to demonstrate; they do not lock a future customer into a browser interface or a cloud-hosted model. For a future customer or a later hackathon round, the interface could be packaged as a desktop application if that better fits the users' workflow. The model layer could also be adapted to a locally hosted model or a customer's approved private service, subject to security, hardware, quality, and operating-cost evaluation.

## 2. Why it is useful

Brand content is created by many people and teams, often under deadline. Static brand manuals are hard to apply consistently, and manual review can catch preventable issues late in the process. Inkloom aims to make the review step more consistent and explainable.

Potential benefits include:

- **Earlier feedback:** identify some issues while content is still a draft.
- **More consistent use of guidance:** compare drafts against one maintained set of organization-specific rules and facts.
- **Actionable explanations:** show a finding's quoted text, reason, rule reference where available, and suggested wording.
- **Human control:** suggestions do not publish or approve content automatically.
- **Traceability:** retain draft revisions, reviewer decisions, comments, and audit events.
- **Better visibility into recurring friction:** show which issues are frequently found or dismissed, so teams can investigate whether guidance needs clarification.
- **A flexible foundation:** support different customer rules and allow future choices about hosting, interface, and model provider.

These are intended benefits, not measured promises. The current benchmark is small, and no controlled manual-review baseline has established the plan's targeted time savings or production accuracy.

## 3. User roles

| Role | Main responsibilities in the current application |
|---|---|
| **Creator** | Creates and edits drafts, uploads supported assets, runs or re-runs scans, reviews findings, applies text suggestions where appropriate, and participates in comments and revision cycles. |
| **Reviewer** | Reviews submitted drafts and their findings, adds comments, requests changes, or approves a draft. The reviewer owns the final decision; the automated scan is advisory. |
| **Administrator** | Manages the organization's Source of Truth (guideline versions, rules, terminology, approved facts, colors, and logo records), manages creator/reviewer accounts, and has access to administrative review and audit surfaces. |

The navigation is filtered by role in the frontend, and the backend separately checks authentication, role permissions, and organization scope. The role model is a starting point and can be adapted to a customer's approval structure.

## 4. Draft lifecycle

```text
Creator creates or uploads a draft
             │
             ▼
          Submitted
             │
             ▼
 Automated scan creates a revision and findings
             │
     ┌───────┴─────────┐
     │                 │
 Findings returned   No findings returned
     │                 │
     ▼                 ▼
 In Revision       Scanned
     │
 Creator edits text, responds, or replaces media
     │
     └──────────────► Re-scan creates a new revision
                              │
                              ▼
                    Submit for approval
                              │
                              ▼
                    Pending Approval
                       /          \
                      /            \
              Changes Requested   Approved
                      │
                      └──► In Revision → edit and re-scan
```

**Coverage safeguard:** if the latest scan cannot assess the relevant policy coverage or media extraction is incomplete, the system marks the revision `needs_review` with an explanation and blocks submission until the gap is addressed. A scan that returns no findings is not a compliance certificate.

**Text and media have different resolution behavior.** Text suggestions can update draft text with revision/rescan behavior, subject to stale or ambiguous-span checks. A text suggestion cannot alter an uploaded image, audio recording, or video file; those suggestions are advisory and the creator must provide an updated source asset.

## 5. How scanning and AI work

### 5.1 Overall approach

The scanner combines two kinds of checks:

1. **Deterministic checks** apply explicit rules and patterns where a clear machine-checkable comparison is possible.
2. **Semantic checks** retrieve relevant organization rules and may ask Gemini to evaluate a draft against those rules. The model returns structured findings, not an unrestricted rewrite.

Where Gemini embeddings and vector search are available, the system can use them to retrieve relevant rules; lexical retrieval is the fallback. Semantic findings must cite a retrieved rule, quote an exact span, and include an explanation and suggestion. Findings with an unknown rule reference, invalid quote, or incomplete response are rejected.

The scan layers currently run concurrently. Deterministic results do not depend on the Gemini response. If Gemini is not configured or unavailable, some local, rule-specific semantic patterns can still run, but those patterns are limited and are not a replacement for a general semantic model.

### 5.2 Expected scan output

For each detected issue, the intended response is a structured finding containing:

- the applicable rule identifier, when the check is policy-grounded;
- the exact detected span or available media location;
- a concise explanation;
- a suggested correction or next step;
- a confidence value where provided by the semantic layer.

The automated result is advisory. The creator can consider the suggestion, and the reviewer decides whether the final content is acceptable. The product deliberately does not interpret “no finding” as “guaranteed compliant.”

### 5.3 How each asset type is examined

| Asset type | Current examination path | Important limitations |
|---|---|---|
| **Text** | Deterministic terminology checks, supported numeric-claim comparisons against approved facts, known hex-code checks, clear profanity/direct-threat patterns, and retrieval-grounded semantic checks for applicable rules. | Pattern checks cover known forms, not every possible phrase or claim. Semantic coverage depends on the quality and retrieval of the organization's rules and, when used, the model response. An unsupported number is labeled unverified rather than automatically called false. |
| **Image** | Image metadata is inspected; Tesseract OCR can extract visible text. When configured, Gemini vision can evaluate the image against retrieved rules. OCR text can enter the text-checking flow. | OCR can miss or misread stylized, small, low-contrast, or non-English text. Without the vision model, visual review is incomplete and requires human review. Logo identity, palette, layout, and contrast are not comprehensively verified by the deterministic scanner. |
| **Audio** | Faster-Whisper can produce a transcript with timing segments; that transcript is checked through the text flow. Media metadata is also inspected where available. A creator-provided transcript can also supply text for review. | **A transcript is needed for meaningful content-level brand review.** If transcription is unavailable, inaccurate, or incomplete, spoken content may be missed. The current implementation does not provide a complete direct acoustic/style review. Round 3 can improve this with reliable transcript ingestion, transcription status/quality feedback, timestamp-linked findings, and testing with representative speech; alternative speech services can be considered for customer needs. |
| **Video** | The system can attempt audio transcription, sample up to 12 frames using FFmpeg, and run OCR on sampled frames. Extracted transcript and OCR text enter the checks, and findings can include time/frame context. | Sampling can miss content between sampled frames; OCR and speech recognition can be imperfect. This is not exhaustive frame-by-frame or full multimodal understanding. A human must review when capabilities are missing or the video is high risk. |

The **suggested change** is produced by a deterministic rule's configured preferred value or by the grounded semantic response. For media, this is guidance to the creator, not an edit to the binary file. The **final decision** is made by the authorized reviewer or administrator in the approval workflow.

## 6. Architecture, database, and deployment

### 6.1 Architecture in brief

```text
React / Vite browser application
           │ HTTPS: JSON and uploaded assets
           ▼
FastAPI backend ─────────────── Gemini API (when configured)
     │                         Gemini embeddings (when configured)
     ├── Draft, guideline, auth, review, audit, analytics APIs
     ├── Deterministic + RAG/semantic scan services
     ├── Media extraction tools (OCR, transcription, frame sampling)
     ▼
SQLite locally or PostgreSQL in a configured deployment
Optional pgvector for rule retrieval
```

### 6.2 Database structure

The main records are:

- **Organizations and users:** tenant identity, account details, and creator/reviewer/admin roles.
- **Guideline versions and rules:** the active and historical policy sets used for grounding.
- **Terminology, approved facts, colors, and logos:** structured sources for relevant checks.
- **Drafts and revisions:** asset reference, status, version, extracted analysis, and scan history.
- **Flags/findings:** rule, span or media location, explanation, suggestion, confidence, and resolution.
- **Comments and audit logs:** collaboration and recorded actions.

SQLite is supported for local development. PostgreSQL is supported when configured, with optional pgvector for embeddings. A lexical rule search remains available as a fallback. Uploaded files are stored separately from relational records; reliable production retention therefore depends on the deployment's persistent storage configuration.

### 6.3 Deployment and current latency

The demonstration frontend is deployed on Vercel and the API is deployed on Render. The application can also call an external Gemini service, which adds its own request time. **The current site may feel slow because it is running on free-tier hosting, particularly the Render backend, where limited resources and service wake-up/cold-start delays can increase response time.** Network and model-provider latency may add to that. This is a hosting characteristic of the demonstration setup, not evidence that the final customer deployment must be slow.

For a customer deployment, the team can evaluate an appropriately sized always-on service, a customer's cloud environment, private networking, persistent asset storage, or a local/on-premise model. Those choices require a separate deployment and security design; they are not currently provided by the demo.

## 7. Development process and issues addressed

The work progressed from the Round 1 concept into a functioning demonstration: establish the web/API workflow and data model, add guideline retrieval and scanning, connect review and approval, extend previews and media handling, and refine analytics and reliability based on observed failures and test cases.

| Issue encountered | Why it occurred | How it was addressed |
|---|---|---|
| Clear offensive or hostile text received no finding | Semantic checks depend on relevant policy retrieval, and the deterministic layer initially lacked direct checks for these examples. | Added deterministic checks for profanity and direct threats, exact spans, suggested alternatives, and regression tests for the reported text. |
| A raw, very large user-count claim was missed | The earlier numeric rule recognized only a narrow subset of number formats. | Expanded numeric-claim recognition, normalized scale words/suffixes, and compared claims with relevant approved facts. Unverified is distinguished from false. |
| A draft showed “100% alignment” with no findings | An arbitrary score treated an empty result as perfect, even though detection and policy coverage are not complete. | Removed the unsupported score from new scan responses and the UI. Screens now show findings and coverage, and clarify that no findings do not establish compliance. |
| Edits could make stored scan evidence misleading | A finding belongs to the revision that produced it; applying edits should not silently rewrite that evidence. | Preserved prior revision findings and rescans updated text as a new revision. Guards reject stale or ambiguous text matches. |
| Media suggestions could be mistaken for automatic file edits | Text replacement is not an appropriate way to modify binary media. | Kept media suggestions advisory and added asset previews, extracted context, and instructions to upload an updated source asset. |
| Incomplete extraction could appear to be a clean scan | OCR, transcription, frame extraction, vision, or policy retrieval can be unavailable or incomplete. | Record coverage status and missing capabilities, explain human-review needs, and block approval submission when coverage is incomplete. |
| Analytics implied accuracy based on an uncalibrated score | Fixed score deductions and targets were not supported by representative evaluation data. | Replaced the compliance score views with observable counts and operational metrics; benchmark claims are qualified by the size and limits of the labelled set. |
| “Immutable audit” wording overstated the guarantee | A hash chain can reveal mismatches but does not prevent privileged modification of the underlying storage. | Describe the feature as hash-linked and verifiable, not immutable. |
| Slow or failing hosted requests complicated testing | The free-tier backend can have high latency, and some sessions showed API 500 responses. | Added UI error/retry handling and preserved drafts when an initial scan fails so they can be reopened and rescanned. Production diagnosis still requires service logs and environment checks. |

The current frontend is a **demonstration UI assembled quickly (about two days, as reported by the team)**. It is sufficient to communicate the workflow, but it should not be treated as final customer-ready design. Round 3 should include usability, accessibility, responsive behavior, and error-state refinement.

## 8. Current limitations, bugs, and unimplemented plan items

### 8.1 Known limitations

- Automated checks are bounded. The system can miss issues outside explicit patterns, retrieved rules, model coverage, or successful extraction.
- A finding or a suggestion can be imperfect. Human review remains necessary; no automatic publication or final approval is performed.
- Audio review depends on an accurate transcript. Video review samples frames rather than inspecting every instant.
- Visual color, contrast, layout, and logo identity checks are not yet comprehensive.
- The built-in benchmark has only five labelled examples. It is useful for regression checks, not a statistically reliable product accuracy claim.
- No controlled manual-review baseline is available to validate the planned “50% faster” target.
- The demo's free hosting can make interactions feel laggy and is not a fair measure of performance on a production-sized deployment.
- The audit chain is verifiable but not immutable storage. Enterprise SSO, customer-managed encryption, and configurable retention are not delivered.

Some runtime or third-party failures may still surface as errors. Local tests do not guarantee that the deployed database, model key, media binaries, persistent disk, or hosting environment are configured correctly. Round 3 should include a reproducible deployment smoke-test and error-triage process.

### 8.2 Planned but not implemented

The original plan and follow-on product direction include features that are **not in the current implementation**:

- **MCP server:** No MCP server or MCP tools are implemented. The current service uses ordinary authenticated HTTP API endpoints. MCP is a planned integration layer, not a current product capability.
- **Rust/Axum service:** File handling remains in FastAPI/Python.
- **Live third-party connectors:** The code has local adapters/normalizers for source labels, but not production OAuth, sync, plugin, or publish-back integrations for CMS tools, Google Docs, Figma, Webflow, or HubSpot.
- **Desktop app:** The current demonstration is a web app. A desktop app is a possible customer-driven packaging option, not an already completed feature.
- **Local model deployment:** Gemini is the demonstration provider when configured. A local/private provider is not currently a finished deployment option.
- **Enterprise capabilities:** SSO, customer-managed keys, end-to-end encryption, on-prem model hosting, and configurable asset-retention policies remain future work.
- **Multilingual/regional support:** There is no validated multilingual policy pipeline or country-specific advertising-rule framework.
- **Learning from overrides:** Dismissals and edits are recorded but are not used to train a model or automatically alter policy.
- **Full PDF ingestion and rule approval:** Current guideline ingestion accepts text; it does not provide robust PDF extraction with source-page citations and an administrator confirmation workflow.
- **Exhaustive visual/audio/video review:** Current OCR, transcription, and frame sampling are partial extraction aids.

## 9. Round 3 plan

Round 3 should turn the demonstration into a more reliable, evaluable, and customer-adaptable product. The sequence below builds on the current system without implying that every customer needs the same hosting or interface.

### Phase 1 — Stabilize the current application

1. Create a reproducible environment and deployment checklist for the frontend, backend, database, model credentials, media executables, and persistent asset storage.
2. Add API and browser smoke tests for the full creator-to-reviewer lifecycle, including error, retry, and incomplete-coverage paths.
3. Reproduce and resolve remaining API 500s using request IDs, backend logs, and focused tests.
4. Test supported database configurations and migration/backup/restore behavior.
5. Add upload validation, clear extraction status, and resilience tests for unavailable OCR, transcription, vector search, or Gemini.

**Outcome:** fewer demonstration failures, clearer diagnosis, and a stable baseline before adding integration complexity.

### Phase 2 — Build MCP intentionally and securely

1. Agree on concrete MCP use cases before building tools—for example: retrieve a caller's approved brand rules, submit a draft for review, or retrieve findings for a draft.
2. Define a small, read-only-first tool set and explicit input/output schemas. Do not expose arbitrary database access or unrestricted file operations.
3. Authenticate each request and enforce organization scope and role permissions on every tool, reusing the backend authorization boundary.
4. Apply least privilege, input validation, rate limits, audit logging, and safe error handling. Keep model-generated suggestions separate from actions that change records.
5. Add integration tests for unauthorized roles, cross-organization requests, malformed input, tool errors, and audit events.
6. Only then connect an approved MCP client and document the tool contract and deployment threat model.

**Outcome:** MCP becomes a controlled interoperability surface, not a bypass around existing security checks. It can let approved AI clients use the organization's governance workflow without granting broad access to company data.

### Phase 3 — Improve scanning quality and evaluation

1. Expand the labelled test set across tone, terminology, numerical claims, unsupported claims, media extraction, and benign near-miss examples.
2. Have human reviewers label exact spans, correct rule IDs, severity, acceptable alternatives, and known ambiguous cases.
3. Measure precision, recall, false-positive rate, extraction coverage, and latency separately; report sample size and uncertainty.
4. Test deterministic claim matching against unit, boundary, locale/format, and conflicting-source cases.
5. Improve retrieval evaluation so relevant rules are measured as retrieved or missed, not assumed available.
6. Record reviewer outcomes for analysis, but do not automatically train on overrides or change rules without an explicit, reviewed process.

**Outcome:** improvements become measurable, and project demonstrations can report observed performance without treating a small sample as proof of general reliability.

### Phase 4 — Improve media review

1. Add transcript upload/edit/confirmation for audio and video, plus clear confidence and missing-audio status.
2. Link speech findings to reliable transcript timestamps and visual findings to frame timestamps.
3. Evaluate denser or adaptive frame sampling and explicit video duration/coverage limits.
4. Test OCR and transcription quality using representative accents, noise, typography, and asset formats.
5. Add robust logo matching, palette sampling, and contrast analysis with human-verifiable evidence.
6. Keep the final approval human-controlled and require replacement media for accepted changes to binary assets.

**Outcome:** fewer blind spots in non-text assets and more useful, localized reviewer feedback.

### Phase 5 — Refine the interface and customer configuration

1. Rework the demo UI based on creator, reviewer, and administrator usability tests.
2. Improve information hierarchy, accessibility, responsive layouts, empty/loading/error states, and navigation consistency.
3. Make the user's next action clear for each finding and for every incomplete-coverage condition.
4. Add customer-level configuration for role names, approval stages, policy categories, and retention where justified.
5. Evaluate web versus desktop packaging with a prospective customer rather than assuming one is universally better.

**Outcome:** a more usable product that can be tailored without hard-coding one firm's process into the platform.

### Phase 6 — Provider, privacy, and deployment choices

1. Define a provider adapter boundary and test Gemini and any customer-approved local/private model against the same structured contract.
2. Compare quality, latency, operating cost, hardware needs, and data-handling constraints before selecting a deployment.
3. Document what data is sent to each model and enable PII redaction where it is appropriate; test both redaction and restoration behavior.
4. For enterprise hosting, define encryption at rest/in transit, key management, backup, access logging, data retention, and incident-response responsibilities with the customer.
5. Move the demonstration off free-tier hosting when performance or availability requirements demand it; measure latency before and after.

**Outcome:** customers can make informed privacy and hosting choices instead of being forced into the demo's Gemini-and-free-cloud setup.

## 10. How future features expand the use case

| Future capability | How it improves the product | Expanded use case |
|---|---|---|
| MCP with scoped tools | Lets approved assistants and workflows request policy checks through a governed interface. | Bring brand checks into internal AI assistants or controlled content pipelines. |
| Local/private model option | Gives customers another way to meet data-location or confidentiality requirements. | Review unreleased campaigns in a customer-controlled environment, if validated and supported. |
| Direct CMS/editor integrations | Removes manual export/import steps and returns findings where content is authored. | Review blog, campaign, and web content inside existing publishing workflows. |
| Improved audio/video review | Adds transcript and frame evidence with clearer coverage. | Review advertisements, social videos, podcasts, and spoken product claims. |
| Stronger visual verification | Provides evidence for palette, contrast, and logo usage. | Review banners, presentations, product imagery, and campaign assets more consistently. |
| Better benchmark and analytics | Separates measured quality from unsupported claims and identifies repeated workflow problems. | Help brand and legal teams prioritize policy clarification and training. |
| Customer-specific workflow configuration | Aligns roles and approval stages to each firm's actual process. | Support agencies, regulated organizations, and teams with multiple brands or regions. |
| Desktop packaging, if needed | Can fit restricted or specialized working environments. | Offer a dedicated workstation workflow where a browser deployment is not suitable. |

## 11. Verification and project status

At the implementation snapshot named above:

- Backend: `python -m pytest backend\tests` — **27 passed**.
- Frontend: `cd frontend; npm run build` — **succeeded**.
- Frontend: `cd frontend; npm run lint` — completed with existing warnings.
- Commit `251814f` was pushed to `origin/main`.

These results verify local tests and frontend compilation at that snapshot. They do not prove that the live hosting services, database credentials, media executables, Gemini configuration, or every production interaction are functioning at all times.

## 12. Technology stack

| Layer | Current tools |
|---|---|
| Web UI | React, Vite, Tailwind CSS, Lucide React |
| API and orchestration | Python, FastAPI, Uvicorn, Pydantic |
| Authentication | JWT (`python-jose`), PBKDF2-HMAC-SHA256 password hashing |
| Data | SQLite locally; PostgreSQL/psycopg and optional pgvector |
| Model / embeddings | Google Gemini API and Gemini embedding model, when configured |
| Media utilities | Pillow, Tesseract OCR, Faster-Whisper, FFmpeg/ffprobe |
| Quality checks | pytest, Vite production build, Oxlint |
| Demo hosting / source | Vercel, Render, GitHub |

## 13. Closing perspective

Inkloom AI demonstrates the core idea from the original plan: organization-specific guidance can be connected to draft scanning and a human approval process. It also exposes the work still required to make the system dependable for different firms—especially measured evaluation, fuller media coverage, production-grade integrations, privacy/deployment choices, a more polished UI, and MCP built with strict access controls.

The next round should preserve what is already useful while being precise about the system's limits. The goal is not to let AI make a firm's final brand or legal decision; it is to provide grounded, reviewable assistance that fits the customer's workflow and leaves people in control.
