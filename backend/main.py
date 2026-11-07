import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from fastapi.staticfiles import StaticFiles

from backend.config import settings
from backend.database import init_db
from backend.seed_data import seed_database
from backend.routers import auth, guidelines, drafts, flags, analytics, evaluation, audit, integrations

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize schema and seed data
    init_db()
    await seed_database()
    yield

app = FastAPI(
    title="Intelligent Brand-Governance Platform",
    description="Proactive, AI-driven Brand Governance Control Center by Team DoraAIemon for Inkloom AI",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.TRUSTED_HOSTS)

@app.middleware("http")
async def security_middleware(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            too_large = int(content_length) > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
        except ValueError:
            return JSONResponse(status_code=400, content={"detail": "Invalid Content-Length header"})
        if too_large:
            return JSONResponse(status_code=413, content={"detail": "Request payload is too large"})
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if settings.ENVIRONMENT.lower() in {"production", "staging"}:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# Keep CORS outside host and application middleware so API errors still include
# the headers required by the deployed frontend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
static_dir = settings.STATIC_ROOT
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
app.include_router(integrations.router)

@app.get("/api/health")
def health_check():
    from backend.database import get_db
    try:
        with get_db() as conn:
            conn.cursor().execute("SELECT 1")
    except Exception:
        return JSONResponse(status_code=503, content={"status": "unhealthy"})
    return {
        "status": "healthy",
        "service": "Intelligent Brand-Governance Platform",
        "version": "1.0.0",
        "team": "DoraAIemon"
    }

@app.get("/api/system-info")
def system_info():
    database_name = "postgresql" if settings.is_postgres else str(settings.DB_PATH)
    return {
        "environment": settings.ENVIRONMENT,
        "database": database_name,
        "ai_engine": {
            "provider": "Gemini Multimodal / Grounded RAG Adapter",
            "model": settings.GEMINI_MODEL,
            "has_api_key": bool(settings.GEMINI_API_KEY and settings.GEMINI_API_KEY != "your_gemini_api_key_here"),
            "strict_grounding": settings.STRICT_GROUNDING_REQUIRED,
            "min_confidence": settings.MIN_CONFIDENCE_THRESHOLD
        },
        "security": {
            "pii_redaction_enabled": settings.ENABLE_PII_REDACTION,
            "immutable_audit_logging": True
        }
    }

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
