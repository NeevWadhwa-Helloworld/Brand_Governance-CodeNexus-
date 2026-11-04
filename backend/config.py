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
    DEBUG: bool = os.getenv("DEBUG", "True").lower() in ("true", "1", "yes")
    CORS_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173").split(",")
        if origin.strip()
    ]

    # Security & RBAC
    SECRET_KEY: str = os.getenv("SECRET_KEY", "inkloom-brand-governance-super-secret-key-2026-doraaiemon")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 1440))
    ENABLE_PII_REDACTION: bool = os.getenv("ENABLE_PII_REDACTION", "True").lower() in ("true", "1", "yes")

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./brand_governance.db")
    DB_PATH: Path = BASE_DIR / "brand_governance.db"

    # AI & LLM Settings
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "text-embedding-004")

    # RAG & Verification Parameters
    RAG_TOP_K: int = int(os.getenv("RAG_TOP_K", 8))
    STRICT_GROUNDING_REQUIRED: bool = os.getenv("STRICT_GROUNDING_REQUIRED", "True").lower() in ("true", "1", "yes")
    MIN_CONFIDENCE_THRESHOLD: float = float(os.getenv("MIN_CONFIDENCE_THRESHOLD", 0.70))

    # Static Assets Storage
    STATIC_UPLOAD_DIR: Path = BASE_DIR / "backend" / "static" / "uploads"
    STATIC_LOGO_DIR: Path = BASE_DIR / "backend" / "static" / "logos"

settings = Settings()

# Ensure directories exist
settings.STATIC_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.STATIC_LOGO_DIR.mkdir(parents=True, exist_ok=True)
