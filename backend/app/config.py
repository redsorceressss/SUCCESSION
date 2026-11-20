"""Settings read from environment variables (and an optional .env file).
Secrets (SECRET_KEY, API keys) must never be committed to Git.
"""

import os
import sys
import warnings
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

def _load_dotenv(path: Path) -> None:
    """Tiny .env reader: KEY=value per line. Existing environment variables win."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))

_load_dotenv(ROOT.parent / ".env")  # repo root when backend/ sits in repo root
_load_dotenv(ROOT / ".env")

_DEV_KEY = "dev-only-change-me-dev-only-change-me-0123"

class Settings:
    database_url: str = os.getenv("DATABASE_URL", f"sqlite:///{ROOT / 'swarn.db'}")
    secret_key: str = os.getenv("SECRET_KEY", _DEV_KEY)
    token_minutes: int = int(os.getenv("ACCESS_TOKEN_MINUTES", "60"))
    upload_dir: Path = Path(os.getenv("UPLOAD_DIR", str(ROOT / "uploads")))
    max_upload_mb: int = int(os.getenv("MAX_UPLOAD_MB", "5"))
    tolerance_g: Decimal = Decimal(os.getenv("TOLERANCE_G", "0.20"))  # normal-loss tolerance
    scale_match_g: Decimal = Decimal(os.getenv("SCALE_MATCH_G", "0.01"))  # OCR vs entered weight
    allowed_fields: tuple = ("weight_g", "karat", "scrap_g", "note")
    app_env: str = os.getenv("APP_ENV", "development")
    allowed_origins: list = [
        o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()
    ] or None  # None = use dev defaults
    rate_limit: str = os.getenv("RATE_LIMIT", "60/minute")  # default global rate limit

settings = Settings()

# --- Production safety checks ---
if settings.app_env == "production":
    if settings.secret_key == _DEV_KEY:
        print(
            "FATAL: SECRET_KEY is the development default. "
            "Set a secure random SECRET_KEY in the environment or .env before running in production.",
            file=sys.stderr,
        )
        sys.exit(1)
    if len(settings.secret_key) < 32:
        print(
            "FATAL: SECRET_KEY must be at least 32 characters for production use.",
            file=sys.stderr,
        )
        sys.exit(1)
elif settings.secret_key == _DEV_KEY:
    warnings.warn(
        "Using development SECRET_KEY. Set APP_ENV=production and a secure SECRET_KEY for deployment.",
        stacklevel=1,
    )
