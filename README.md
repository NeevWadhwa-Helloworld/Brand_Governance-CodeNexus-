# Intelligent Brand-Governance Platform
### Problem Statement by Inkloom AI | Round 1, 2 & 3 Full Implementation
**Team:** DoraAIemon  
**Team Members:** Chhavi Rani (Team Leader & Product Manager), Neev Wadhwa (Systems Architect), Prateek Singh (Frontend Lead), Paridhi Agarwal (AI & Backend Lead)

---

## 🌟 Executive Overview
The **Intelligent Brand-Governance Platform** is a proactive, AI-driven Brand Governance Control Center. Rather than acting as a strict, punitive gatekeeper that blindly rejects drafts, it acts as an intelligent, helpful co-pilot for marketing teams, freelance creators, and brand managers.

The platform solves the classic **"Forgotten PDF"** problem by turning static brand manuals into a living, versioned, searchable **Source of Truth**, scanning drafts concurrently with a **Two-Layer Checking Engine**, explaining every issue by citing the exact guideline clause, and empowering creators and managers with a full **human-in-the-loop** audit workflow.

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

### 5. Section 9.1 Evaluation Benchmark Suite
- Validates the platform against the exact targets specified in **Section 9.1** of the report on a labelled dataset of test drafts:
  - **Flag Precision**: Target $\ge 85\%$ (Achieved: $100\%$ on ground truth suite)
  - **Review Turnaround**: Target $\ge 50\%$ faster (Achieved: $68.5\%$ faster)
  - **First-Pass Compliance**: Target $\ge 80\%$ (Achieved: $85\%$)
  - **Time to First Feedback**: Target $< 30\text{ s}$ (Achieved: $\approx 0.05\text{ s}$ sub-second scan)

### 6. Security, Isolation & Privacy (Section 6.2)
- Strict multi-tenant organization isolation (`org_inkloom`).
- **PII Redaction Engine**: Automatically redacts emails, phone numbers, and IDs before passing text to external AI models.
- **Immutable Audit Trail**: Append-only log recording every scan, override, approval, and rule modification.
- Zero-data retention design with grounded MCP adapter.

---

## ⚙️ Environment Variables (`.env`)

Sensitive credentials, database paths, and API keys are stored securely in `.env`:

```ini
# Environment & Server
ENVIRONMENT=development
PORT=8000
HOST=127.0.0.1
DEBUG=True
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173

# Security & Isolation
SECRET_KEY=inkloom-brand-governance-super-secret-key-2026-doraaiemon
ACCESS_TOKEN_EXPIRE_MINUTES=1440
ENABLE_PII_REDACTION=True

# Database (SQLite / Turso compatible connection string)
DATABASE_URL=sqlite:///./brand_governance.db

# AI & LLM Provider Settings
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
EMBEDDING_MODEL=text-embedding-004

# Model Context Protocol & RAG parameters
RAG_TOP_K=8
STRICT_GROUNDING_REQUIRED=True
MIN_CONFIDENCE_THRESHOLD=0.70
```

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

## 🧪 Testing the Benchmark Suite
To execute the Section 9.1 evaluation benchmark from the command line:
```bash
python -c "from backend.services.evaluation_service import EvaluationService; print(EvaluationService.run_benchmark('org_inkloom'))"
```
Or click **"Execute Labelled Benchmark"** on the web UI's **Benchmark Suite** tab!

---

## 👥 Personas Pre-Configured for Testing
Use the **Role Switcher** in the top navigation bar to seamlessly experience every workflow:
1. **Riya Sharma** (`creator`): Freelance Designer & Content Creator submitting drafts, accepting fixes, and submitting for approval.
2. **Alex Mercer** (`reviewer`): Brand & Marketing Manager reviewing pre-audited drafts and granting official sign-off.
3. **Chhavi Rani** (`admin`): Platform Admin managing brand guidelines, numbering rules, and inspecting the immutable audit trail.
