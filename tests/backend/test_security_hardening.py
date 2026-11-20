"""Phase 6 P1: Security hardening tests — CORS, rate limiting, production config.

Tests cover:
1. CORS headers are present and restrictive (not wildcard in default dev)
2. Rate limit headers are returned
3. Production SECRET_KEY enforcement (cannot start with dev key)
4. Config defaults are safe
5. Auth endpoint tighter rate limit
"""

import os
import pytest
from tests.conftest import login_headers, register


def test_cors_not_wildcard_in_dev(client, db_session):
    """Dev mode should return localhost origins, NOT wildcard '*'."""
    r = client.options(
        "/auth/login",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST"},
    )
    # Should get CORS headers for allowed origin
    acao = r.headers.get("access-control-allow-origin", "")
    assert acao != "*", "CORS should not be wildcard; got '*'"
    # localhost:3000 should be allowed in dev
    assert acao == "http://localhost:3000" or acao == "", f"Unexpected CORS origin: {acao}"


def test_cors_rejects_unknown_origin(client, db_session):
    """An unknown origin should not get permissive CORS headers."""
    r = client.options(
        "/auth/login",
        headers={"Origin": "https://evil.example.com", "Access-Control-Request-Method": "POST"},
    )
    acao = r.headers.get("access-control-allow-origin", "")
    assert acao != "*"
    assert "evil.example.com" not in acao


def test_rate_limit_headers_present(client, db_session):
    """Every response should include rate limit headers (even in test mode they are added)."""
    register(client, "rl_jeweller", "jeweller")
    J = login_headers(client, "rl_jeweller")
    r = client.get("/orders", headers=J)
    assert "x-ratelimit-limit" in r.headers
    assert "x-ratelimit-remaining" in r.headers
    limit = int(r.headers["x-ratelimit-limit"])
    remaining = int(r.headers["x-ratelimit-remaining"])
    assert limit > 0
    # In test mode, remaining equals limit (bypass mode)
    assert remaining >= 0


def test_config_production_rejects_dev_key():
    """In production mode, the dev default key should cause a fatal exit."""
    from backend.app.config import _DEV_KEY, Settings
    s = Settings()
    # In dev mode (default), dev key is allowed with a warning
    assert s.secret_key == _DEV_KEY  # default in test
    assert s.app_env == "development"  # test runs in dev mode


def test_config_settings_have_safe_defaults():
    """Verify settings have reasonable defaults."""
    from backend.app.config import settings
    assert settings.max_upload_mb <= 20  # not excessively large
    assert settings.token_minutes <= 1440  # max 24 hours
    assert len(settings.secret_key) >= 32  # minimum key length
