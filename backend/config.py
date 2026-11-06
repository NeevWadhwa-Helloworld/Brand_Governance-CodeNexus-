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
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173").split(",")
        if origin.strip()
    ]
    TRUSTED_HOSTS: list[str] = [
        host.strip()
        for host in os.getenv("TRUSTED_HOSTS", "localhost,127.0.0.1").split(",")
        if host.strip()
    ]

    # Security & RBAC
    SECRET_KEY: str = os.getenv("SECRET_KEY", "")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 1440))
    ENABLE_PII_REDACTION: bool = os.getenv("ENABLE_PII_REDACTION", "True").lower() in ("true", "1", "yes")

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./brand_governance.db")
    DB_PATH: Path = BASE_DIR / "brand_governance.db"
    is_postgres: bool = DATABASE_URL.startswith(("postgresql://", "postgres://"))
    MAX_UPLOAD_SIZE_MB: int = int(os.getenv("MAX_UPLOAD_SIZE_MB", "100"))

    # AI & LLM Settings
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
    STATIC_UPLOAD_DIR: Path = BASE_DIR / "backend" / "static" / "uploads"
    STATIC_LOGO_DIR: Path = BASE_DIR / "backend" / "static" / "logos"

settings = Settings()

if settings.ENVIRONMENT.lower() in {"production", "staging"}:
    if len(settings.SECRET_KEY) < 32:
        raise RuntimeError("SECRET_KEY must be at least 32 characters outside development.")
    if not settings.CORS_ORIGINS or "*" in settings.CORS_ORIGINS:
        raise RuntimeError("Explicit CORS_ORIGINS are required outside development.")

# Ensure directories exist
settings.STATIC_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.STATIC_LOGO_DIR.mkdir(parents=True, exist_ok=True)
