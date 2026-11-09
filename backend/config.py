import os
from pathlib import Path
from dotenv import load_dotenv

# Locate and load .env file from root or backend directory
BASE_DIR = Path(__file__).resolve().parent.parent
env_path = BASE_DIR / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()

class Settings:
    # Environment & Server
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    PORT: int = int(os.getenv("PORT", 8000))
    HOST: str = os.getenv("HOST", "127.0.0.1")
    DEBUG: bool = os.getenv("DEBUG", "False").lower() in ("true", "1", "yes")
    CORS_ORIGINS: list[str] = [
        origin.strip().rstrip("/")
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000,https://brand-governance-code-nexu.vercel.app,https://brand-governance-codenexus.onrender.com"
        ).split(",")
        if origin.strip().rstrip("/")
    ]
    TRUSTED_HOSTS: list[str] = [
        host.strip()
        for host in os.getenv(
            "TRUSTED_HOSTS",
            "localhost,127.0.0.1,testserver,brand-governance-codenexus.onrender.com,*.onrender.com,brand-governance-code-nexu.vercel.app,*.vercel.app"
        ).split(",")
        if host.strip()
    ]
    RENDER_EXTERNAL_HOSTNAME: str = os.getenv("RENDER_EXTERNAL_HOSTNAME", "").strip()

    # Security & RBAC
    SECRET_KEY: str = os.getenv("SECRET_KEY", "")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 1440))
    ENABLE_PII_REDACTION: bool = os.getenv("ENABLE_PII_REDACTION", "True").lower() in ("true", "1", "yes")
    INITIAL_ADMIN_EMAIL: str = os.getenv("INITIAL_ADMIN_EMAIL", "").strip().lower()
    INITIAL_ADMIN_NAME: str = os.getenv("INITIAL_ADMIN_NAME", "").strip()
    INITIAL_ADMIN_PASSWORD: str = os.getenv("INITIAL_ADMIN_PASSWORD", "")
    INITIAL_ORG_NAME: str = os.getenv("INITIAL_ORG_NAME", "").strip()
    INITIAL_ORG_SLUG: str = os.getenv("INITIAL_ORG_SLUG", "").strip().lower()

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./brand_governance.db")
    DB_PATH: Path = BASE_DIR / "brand_governance.db"
    is_postgres: bool = DATABASE_URL.startswith(("postgresql://", "postgres://"))
    MAX_UPLOAD_SIZE_MB: int = int(os.getenv("MAX_UPLOAD_SIZE_MB", "100"))
    MCP_REQUESTS_PER_MINUTE: int = int(os.getenv("MCP_REQUESTS_PER_MINUTE", "60"))
    MCP_RATE_LIMIT_REDIS_URL: str = os.getenv("MCP_RATE_LIMIT_REDIS_URL", "").strip()
    MCP_ALLOWED_USER_IDS: list[str] = [
        user_id.strip()
        for user_id in os.getenv("MCP_ALLOWED_USER_IDS", "").split(",")
        if user_id.strip()
    ]

    # AI & Model Provider Settings (Phase 5 Provider Boundary)
    MODEL_PROVIDER: str = os.getenv("MODEL_PROVIDER", "auto").strip().lower()
    LOCAL_MODEL_URL: str = os.getenv("LOCAL_MODEL_URL", "http://127.0.0.1:11434/v1").strip()
    LOCAL_MODEL_NAME: str = os.getenv("LOCAL_MODEL_NAME", "llama3.2").strip()
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "gemini-embedding-001")
    EMBEDDING_DIMENSIONS: int = int(os.getenv("EMBEDDING_DIMENSIONS", "768"))
    VECTOR_SEARCH_ENABLED: bool = os.getenv("VECTOR_SEARCH_ENABLED", "True").lower() in ("true", "1", "yes")

    # RAG & Verification Parameters
    RAG_TOP_K: int = int(os.getenv("RAG_TOP_K", 8))
    STRICT_GROUNDING_REQUIRED: bool = os.getenv("STRICT_GROUNDING_REQUIRED", "True").lower() in ("true", "1", "yes")
    MIN_CONFIDENCE_THRESHOLD: float = float(os.getenv("MIN_CONFIDENCE_THRESHOLD", 0.70))

    # Static Assets Storage
    STATIC_ROOT: Path = Path(os.getenv("STATIC_ROOT", str(BASE_DIR / "backend" / "static")))
    STATIC_UPLOAD_DIR: Path = STATIC_ROOT / "uploads"
    STATIC_LOGO_DIR: Path = STATIC_ROOT / "logos"
    EVALUATION_UPLOAD_DIR: Path = Path(
        os.getenv("EVALUATION_UPLOAD_DIR", str(BASE_DIR / "evaluation_assets"))
    )

settings = Settings()

if settings.MCP_REQUESTS_PER_MINUTE < 1:
    raise RuntimeError("MCP_REQUESTS_PER_MINUTE must be a positive integer.")
if settings.MCP_RATE_LIMIT_REDIS_URL and not settings.MCP_RATE_LIMIT_REDIS_URL.startswith(
    ("redis://", "rediss://")
):
    raise RuntimeError("MCP_RATE_LIMIT_REDIS_URL must use redis:// or rediss://.")

deployed_frontend_origin = "https://brand-governance-code-nexu.vercel.app"
deployed_backend_host = "brand-governance-codenexus.onrender.com"
if deployed_frontend_origin not in settings.CORS_ORIGINS:
    settings.CORS_ORIGINS.append(deployed_frontend_origin)
if deployed_backend_host not in settings.TRUSTED_HOSTS:
    settings.TRUSTED_HOSTS.append(deployed_backend_host)
if settings.RENDER_EXTERNAL_HOSTNAME and settings.RENDER_EXTERNAL_HOSTNAME not in settings.TRUSTED_HOSTS:
    settings.TRUSTED_HOSTS.append(settings.RENDER_EXTERNAL_HOSTNAME)

if settings.ENVIRONMENT.lower() in {"production", "staging"}:
    if len(settings.SECRET_KEY) < 32:
        raise RuntimeError("SECRET_KEY must be at least 32 characters outside development.")
    if not settings.CORS_ORIGINS or "*" in settings.CORS_ORIGINS:
        raise RuntimeError("Explicit CORS_ORIGINS are required outside development.")

# Ensure directories exist
settings.STATIC_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.STATIC_LOGO_DIR.mkdir(parents=True, exist_ok=True)
settings.EVALUATION_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
