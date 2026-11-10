<<<<<<< HEAD
# Intelligent Brand-Governance Platform
### Problem Statement by Inkloom AI | Round 1, 2 & 3 Full Implementation
**Team:** DoraAIemon  
**Team Members:** Chhavi Rani (Team Leader & Product Manager), Neev Wadhwa (Systems Architect), Prateek Singh (Frontend Lead), Paridhi Agarwal (AI & Backend Lead)

---

## 🌟 Executive Overview
The **Intelligent Brand-Governance Platform** is a proactive, AI-driven Brand Governance Control Center. Rather than acting as a strict, punitive gatekeeper that blindly rejects drafts, it acts as an intelligent, helpful co-pilot for marketing teams, freelance creators, and brand managers.

The platform solves the classic **"Forgotten PDF"** problem by turning static brand manuals into a living, versioned, searchable **Source of Truth**, scanning drafts concurrently with a **Two-Layer Checking Engine**, explaining every issue by citing the exact guideline clause, and empowering creators and managers with a full **human-in-the-loop** audit workflow.

## Database and account management

The local database is the SQLite file [brand_governance.db](./brand_governance.db) in
the project root:

`C:\Users\Kalee\OneDrive\Desktop\codeNexus\Brand_Governance_Plan\brand_governance.db`

The path is configured in `backend/config.py` and is opened through
`backend/database.py`. Each request gets a short-lived SQLite connection with foreign
keys enabled, WAL journaling, commit-on-success, and rollback-on-error. The database
stores organizations, users, passwords, guideline versions, rules, terminology,
approved facts, colors, logos, drafts, revisions, flags, comments, approvals, and
hash-linked audit logs.

The initial Inkloom records are inserted by `backend/seed_data.py` only when the
database is empty. After that, application data is read from and written to SQLite;
the API does not use a hardcoded user list. On startup, the seed routine also performs
the one-time identity migration for the existing local database and ensures the
Prateek creator account exists.

Administrators can create additional creator and reviewer accounts from the
**Team Accounts** tab. Account creation is protected by the administrator's JWT,
scoped to the administrator's organization, hashes the password before storage, and
does not permit creating another administrator through this UI.

For deployment, use Supabase PostgreSQL with pgvector, Render for the FastAPI
backend, and Vercel for the React frontend. See
[DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) for table relationships, environment
setup, and the SQLite-to-PostgreSQL migration command. The current RAG retrieval
uses pgvector when embeddings are populated; otherwise it safely falls back to
lexical retrieval.

For Vercel, set `VITE_API_BASE_URL` to the Render backend origin. The frontend
uses that value for API calls and uploaded-media URLs; leave it empty for local
same-origin development.

On Render, `TRUSTED_HOSTS` must contain the Render hostname without a protocol,
and `CORS_ORIGINS` must contain the complete Vercel origin. For the currently
deployed services, use:

```env
TRUSTED_HOSTS=brand-governance-codenexus.onrender.com
CORS_ORIGINS=https://brand-governance-code-nexu.vercel.app
```

These values are configured in Render's environment settings, not in the
frontend build.

Render's `RENDER_EXTERNAL_HOSTNAME` is also added to the backend trusted-host
list automatically when available. Draft images, audio, and video are stored
in a private Supabase Storage bucket; set `MEDIA_STORAGE_BACKEND=supabase`,
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_STORAGE_BUCKET` in
Render's environment settings. Create the bucket as private before enabling
uploads. The service-role key is backend-only and must never be added to Vercel
or the frontend. Draft previews use short-lived signed URLs, and scans download
media to temporary files that are removed after analysis. Evaluation samples,
logos, and other static assets continue using their existing storage paths.

To clear all drafts and draft media while preserving database tables, run
`python -m backend.scripts.clear_drafts --confirm` with the Supabase database
and Storage settings configured. The command removes records from `drafts`
(including rows that cascade from them) and objects under the bucket's `drafts/`
prefix; it does not remove organizations, users, guidelines, or evaluation
samples.

Audio and video drafts are transcribed with local faster-whisper first. If local
transcription fails and `GEMINI_API_KEY` is configured with `MODEL_PROVIDER=auto`
or `gemini`, the backend may upload the media temporarily to Google Gemini as a
fallback and then delete that temporary upload. The transcript remains unconfirmed
until a creator or administrator reviews it. If the original asset is unavailable
later, a supplied transcript can still be scanned, but the revision stays in human
review.

Audio and video drafts are transcribed with local faster-whisper first. If local
transcription fails and `GEMINI_API_KEY` is configured with
`MODEL_PROVIDER=auto` or `gemini`, Gemini is used as a fallback and the temporary
provider upload is deleted afterward. Draft Studio scans the transcript against
active guidelines and requires creator review before the draft can be submitted.

---

## 🏗️ Architecture & Two-Layer Checking Engine

```
                             ┌───────────────────────────────────────────────┐
                             │           Creator / Reviewer Draft            │
                             │          (Text Copy or Visual Asset)          │
                             └───────────────────────┬───────────────────────┘
                                                     │
                                                     ▼
                             ┌───────────────────────────────────────────────┐
                             │       Concurrent Two-Layer Engine             │
                             └───────────────┬───────────────┬───────────────┘
                                             │               │
                     ┌───────────────────────┴───┐       ┌───┴───────────────────────┐
                     │   Layer 1: Deterministic  │       │  Layer 2: Grounded RAG    │
                     │  (Fast, Exact, 0 AI Cost) │       │   (Semantic LLM Adapter)  │
                     └───────────────┬───────────┘       └───┬───────────────────────┘
                                     │                       │
                     • Terminology Dictionary matching       • Tone & Voice analysis
                     • Approved-fact lookup (counts, SLAs)   • Superlatives & Claim audit
                     • Hex palette distance & WCAG contrast  • Contextual visual inspection
                     • Logo file-hash & version checking     • STRICT GROUNDING: Unretrieved
                                                               flags are discarded!
                                     │                       │
                                     └───────────────┬───────┘
                                                     │
                                                     ▼
                             ┌───────────────────────────────────────────────┐
                             │         Explainable AI (XAI) Feedback         │
                             │  • Exact Rule Cited (e.g. FACT-01, VOICE-02)  │
                             │  • Confidence Indicator & Explanation         │
                             │  • Non-Destructive Suggested Fix              │
                             └───────────────────────┬───────────────────────┘
                                                     │
                                                     ▼
                             ┌───────────────────────────────────────────────┐
                             │       Human-in-the-Loop Collaboration         │
                             │        Accept  •  Edit  •  Dismiss            │
                             └───────────────────────┬───────────────────────┘
                                                     │
                                                     ▼
                             ┌───────────────────────────────────────────────┐
                             │         Managerial Approval Pipeline          │
                             │  Submitted ➔ Scanned ➔ In Revision ➔ Pending  │
                             │         Approval ➔ Approved / Overridden      │
                             └───────────────────────────────────────────────┘
```

---

## 🚀 Key Features Implemented End-to-End

### 1. The "Source of Truth" Brain
- **Numbered Brand Rules**: Guidelines are decomposed into numbered, versioned rules (e.g., `VOICE-01`, `TERM-01`, `FACT-01`, `COLOR-01`, `CLAIM-01`, `A11Y-01`).
- **Terminology Dictionary**: Exact-match database of prohibited terms and preferred alternatives.
- **Approved Fact Sheet v3**: Citable corporate benchmarks (e.g., *50,000+ active users*, *$12M Series A funding*, *99.9% uptime SLA*).
- **Brand Palette & Accessibility**: Exact hex codes with WCAG AA (4.5:1) contrast calculation.
- **Automated Guideline Ingestion**: Upload raw markdown or brand policy text; the system splits, numbers, and indexes rules into the RAG knowledge base.

### 2. Interactive Draft Studio & Scanner
- Real-time text and multimodal visual asset auditing.
- Inline text highlighting on offending draft spans.
- Visual banner inspector with palette extraction and WCAG contrast meter.
- **One-Click Fix Application**: Clicking "Accept" replaces the off-brand phrasing in-place and boosts compliance score in real time.
- **Creator Creative Freedom**: Creators can edit the fix or dismiss it with a recorded reason (e.g., *"Intentional creative rule break for holiday marketing"*).

### 3. Managerial Approval Pipeline
- Draft status lifecycle: `Submitted` ➔ `Scanned` ➔ `In Revision` ➔ `Pending Approval` ➔ `Approved` (or `Changes Requested`).
- Pre-audited draft inspection showing creator overrides and accepted fixes.
- One-click managerial sign-off and downloadable verifiable **Compliance Certificate**.
- Collaborative comment threads for every draft.

### 4. Governance Analytics Dashboard
- **Top Flagged Terms**: Identifies repeated mistakes across the organization to show where guidelines are ambiguous.
- **AI Flag Precision Metric**: Tracks reviewer agreement rate (target $\ge 85\%$).
- **First-Pass Compliance Rate**: Measures drafts entering without foundational errors (target $\ge 80\%$).
- **Review Cycle Turnaround**: Quantifies turnaround time reduction vs manual baseline (target $\ge 50\%$ faster).
- **Actionable Clarification Insights**: Automated recommendations on rules needing refinement.

- **Reviewer-Labeled Evaluation Suite**: Reviewers can label examples against an active
  guideline version. The report computes rule-level precision, recall, false-positive
  rate, retrieval coverage, and latency only from non-demo reviewer-labeled examples.
  Seeded demonstration examples are excluded. Results are unmeasured when no real
  labeled examples are available; the current small dataset is not a production-quality
  benchmark or evidence for previously stated accuracy or turnaround targets.

### 6. Security, Isolation & Privacy (Section 6.2)
- Strict multi-tenant organization isolation (`org_inkloom`).
- **PII Redaction Engine**: Automatically redacts emails, phone numbers, and IDs before passing text to external AI models.
- **Immutable Audit Trail**: Append-only log recording every scan, override, approval, and rule modification.
- Grounded policy adapter with configurable PII redaction before optional model evaluation.

---

## Environment variables

Copy `.env.example` to `.env` for local development. For Render and Vercel,
enter each variable in the platform's secret/environment-variable settings.
Never commit `.env`; use `frontend/.env.example` for the Vercel-only
`VITE_API_BASE_URL` setting.

---

## 🏃 Quick Start Guide

### Option 1: One-Click Launch (Recommended)
Run the root startup script:
```bash
python run.py
```
Or on Windows:
```cmd
start.bat
```

This will automatically initialize the database, seed the Inkloom AI brand kit, launch the FastAPI backend at `http://127.0.0.1:8000`, and start the React/Vite frontend at `http://localhost:5173`.

### Option 2: Run Backend and Frontend Separately

**Backend:**
```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

**Frontend:**
```bash
cd frontend
npm run dev
```

---

## 🧪 Running the Evaluation Suite
To execute the benchmark for the local Inkloom organization:
```bash
python -c "from backend.services.evaluation_service import EvaluationService; print(EvaluationService.run_benchmark('org_inkloom'))"
```
Or click **"Execute Labelled Benchmark"** on the web UI's **Benchmark Suite** tab.
Only non-demo examples explicitly labeled by a reviewer or administrator are counted.

---

## 👥 Personas Pre-Configured for Testing
Use the **Role Switcher** in the top navigation bar to seamlessly experience every workflow:
1. **Paridhi Agarwal** (`creator`): Freelance Designer & Content Creator submitting drafts, accepting fixes, and submitting for approval.
2. **Neev Wadhwa** (`reviewer`): Brand & Marketing Manager reviewing pre-audited drafts and granting official sign-off.
3. **Chhavi Rani** (`admin`): Platform Admin managing brand guidelines, numbering rules, and inspecting the immutable audit trail.
