"""App entry point. Run from the repo root:
    python -m uvicorn backend.app.main:app --reload
"""

import os
import time
from collections import defaultdict
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from . import models  # noqa: F401 (importing registers the tables)
from .config import settings
from .database import Base, engine
from .routes import auth, disputes, misc, orders, passbook, scale, settlements, sync, transactions, voice

app = FastAPI(
    title="SUCCESSION API",
    version="0.1.0",
    description="Shared, auditable gold ledger between jewellers and karigars.",
)

# --- CORS configuration (hardened: dev = localhost only, production = explicit origins) ---
_dev_origins = ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:8000", "http://127.0.0.1:8000"]

if settings.allowed_origins:
    _origins = settings.allowed_origins
elif settings.app_env == "production":
    _origins = []  # production MUST set ALLOWED_ORIGINS explicitly
else:
    _origins = _dev_origins  # development: allow local origins only

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Idempotency-Key"],
    allow_credentials=True,
)

# --- In-memory rate limiter middleware ---
# Parse rate limit from settings: "60/minute" -> (60, 60.0 seconds)
def _parse_rate_limit(spec: str) -> tuple:
    """Parse 'N/period' into (max_requests, window_seconds)."""
    try:
        n, period = spec.split("/")
        n = int(n)
        windows = {"second": 1, "minute": 60, "hour": 3600, "day": 86400}
        return n, windows.get(period, 60)
    except Exception:
        return 60, 60  # fallback: 60/minute

_rl_max, _rl_window = _parse_rate_limit(settings.rate_limit)
_rl_store: dict[str, list] = defaultdict(list)

# Endpoints with tighter rate limits (auth brute-force, uploads, AI queries)
_TIGHT_PREFIXES = ("/auth/login", "/auth/register", "/ai/", "/scale/")
_TIGHT_MAX = max(10, _rl_max // 6)  # 10 requests per window for sensitive endpoints

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # Skip rate limiting in test mode (DATABASE_URL = in-memory SQLite)
    if os.environ.get("DATABASE_URL") == "sqlite:///:memory:" or os.environ.get("SUCCESSION_TESTING") == "1":
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(_rl_max)
        response.headers["X-RateLimit-Remaining"] = str(_rl_max)
        return response

    client_ip = request.client.host if request.client else "unknown"
    path = request.url.path
    now = time.time()

    # Determine rate limit for this path
    is_tight = any(path.startswith(p) for p in _TIGHT_PREFIXES)
    key = f"{client_ip}:tight" if is_tight else client_ip
    max_req = _TIGHT_MAX if is_tight else _rl_max

    # Clean expired entries and check
    _rl_store[key] = [t for t in _rl_store[key] if now - t < _rl_window]
    if len(_rl_store[key]) >= max_req:
        return JSONResponse(
            status_code=429,
            content={"detail": "Rate limit exceeded. Try again later."},
            headers={
                "Retry-After": str(int(_rl_window - (now - _rl_store[key][0]))),
                "X-RateLimit-Limit": str(max_req),
                "X-RateLimit-Remaining": "0",
            },
        )
    _rl_store[key].append(now)

    response = await call_next(request)
    remaining = max(0, max_req - len(_rl_store[key]))
    response.headers["X-RateLimit-Limit"] = str(max_req)
    response.headers["X-RateLimit-Remaining"] = str(remaining)
    return response

# --- Enable SQLite foreign keys and WAL mode ---
from sqlalchemy import event as _sa_event

@_sa_event.listens_for(engine, "connect")
def _sqlite_pragmas(dbapi_conn, connection_record):
    """Enable foreign keys and WAL mode for every SQLite connection."""
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys = ON")
    cursor.execute("PRAGMA journal_mode = WAL")
    cursor.close()

# --- Database initialization ---
Base.metadata.create_all(engine)

for module in (auth, orders, transactions, disputes, passbook, scale, voice, settlements, sync, misc):
    app.include_router(module.router)
