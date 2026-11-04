import uvicorn
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.config import settings
from backend.database import init_db
from backend.seed_data import seed_database
from backend.routers import auth, guidelines, drafts, flags, analytics, evaluation, audit

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize schema and seed data
    init_db()
    seed_database()
    yield

app = FastAPI(
    title="Intelligent Brand-Governance Platform",
    description="Proactive, AI-driven Brand Governance Control Center by Team DoraAIemon for Inkloom AI",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
static_dir = Path(__file__).parent / "static"
static_dir.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# Mount API Routers
app.include_router(auth.router)
app.include_router(guidelines.router)
app.include_router(drafts.router)
app.include_router(flags.router)
app.include_router(analytics.router)
app.include_router(evaluation.router)
app.include_router(audit.router)

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Intelligent Brand-Governance Platform",
        "version": "1.0.0",
        "team": "DoraAIemon"
    }

@app.get("/api/system-info")
def system_info():
    return {
        "environment": settings.ENVIRONMENT,
        "database": settings.DATABASE_URL.split("///")[-1],
        "ai_engine": {
            "provider": "Gemini Multimodal / Grounded RAG Adapter",
            "model": settings.GEMINI_MODEL,
            "has_api_key": bool(settings.GEMINI_API_KEY and settings.GEMINI_API_KEY != "your_gemini_api_key_here"),
            "strict_grounding": settings.STRICT_GROUNDING_REQUIRED,
            "min_confidence": settings.MIN_CONFIDENCE_THRESHOLD
        },
        "security": {
            "pii_redaction_enabled": settings.ENABLE_PII_REDACTION,
            "immutable_audit_logging": True,
            "mcp_grounding_protocol": "Active"
        }
    }

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
