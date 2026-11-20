"""Create the agent account (not available via public registration).

Usage (secure):
  python -m scripts.create_agent <login>
Provide the password via AGENT_PASSWORD or a hidden prompt.

Run against an already-migrated database. This script does not modify schema.
"""

from __future__ import annotations

import getpass
import os
import sys
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, OperationalError

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app import models  # noqa: F401
from backend.app.database import SessionLocal
from backend.app.models import User
from backend.app.security import hash_password


AGENT_DISPLAY_NAME = "SUCCESSION Agent"
AGENT_ROLE = "agent"


def _resolve_login() -> str:
    if len(sys.argv) > 1 and sys.argv[1].strip():
        return sys.argv[1].strip()
    return (os.getenv("AGENT_LOGIN") or "").strip()


def _resolve_password() -> str:
    env_password = os.getenv("AGENT_PASSWORD")
    if env_password:
        return env_password
    return getpass.getpass("Agent password: ")


def create_agent_account(login: str, password: str) -> None:
    """Create an agent user with existing fixed name/role behavior."""
    if not login or not login.strip():
        raise ValueError("Agent login is required.")
    if not password:
        raise ValueError("Agent password is required.")
    login = login.strip()

    try:
        with SessionLocal() as db:
            existing = db.scalar(select(User).where(User.login == login))
            if existing is not None:
                raise ValueError(f"Login already exists: {login}")

            user = User(
                login=login,
                name=AGENT_DISPLAY_NAME,
                password_hash=hash_password(password),
                role=AGENT_ROLE,
            )
            db.add(user)
            try:
                db.commit()
            except IntegrityError as exc:
                db.rollback()
                # Preserve safe behavior under race/constraint conditions.
                existing = db.scalar(select(User).where(User.login == login))
                if existing is not None:
                    raise ValueError(f"Login already exists: {login}") from exc
                raise
    except OperationalError as exc:
        raise RuntimeError(
            "Database schema unavailable or not initialized. Run migrations on the intended "
            "disposable development database first (e.g. `python -m alembic upgrade head`)."
        ) from exc

    print("agent created successfully:", login)


if __name__ == "__main__":
    if len(sys.argv) > 2:
        print(
            "Error: passing a password as a command-line argument is not allowed. "
            "Use AGENT_PASSWORD or the hidden prompt.",
            file=sys.stderr,
        )
        sys.exit(1)

    login = _resolve_login()
    try:
        password = _resolve_password()
    except (EOFError, KeyboardInterrupt):
        print("Error: agent password input was not provided.", file=sys.stderr)
        sys.exit(1)

    if not login or not password:
        print(
            "Usage: python -m scripts.create_agent <login>\n"
            "Provide the password via AGENT_PASSWORD or the hidden prompt.",
            file=sys.stderr,
        )
        sys.exit(1)

    try:
        create_agent_account(login, password)
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)

