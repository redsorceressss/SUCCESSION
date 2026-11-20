"""Seed SYNTHETIC demo data for local development only.

Safety guarantees:
- Never performs destructive database operations (no drop/reset, no schema creation).
- Requires explicit opt-in and a verified disposable development database target.
- Collects and validates all passwords before any database access.
- Never prints passwords, tokens, or sensitive database details.
- Requires an already-migrated schema.
- Preserves original synthetic demo entities, roles, relationships, and data.
"""

from __future__ import annotations

import getpass
import os
import sys
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, OperationalError

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app import models  # noqa: F401
from backend.app.database import SessionLocal
from backend.app.models import Order, User
from backend.app.security import hash_password
from backend.app.services import audit


DEFAULT_SWARN_DB = (ROOT / "swarn.db").resolve()

DEMO_JEWELLER = {
    "login": "jeweller_demo",
    "name": "Shree Jewellers (Demo)",
    "role": "jeweller",
    "language": "en",
}
DEMO_KARIGAR_1 = {
    "login": "ramesh_karigar",
    "name": "Ramesh Artisan (Demo)",
    "role": "karigar",
    "language": "hi",
}
DEMO_KARIGAR_2 = {
    "login": "suresh_karigar",
    "name": "Suresh Artisan (Demo)",
    "role": "karigar",
    "language": "kn",
}
DEMO_AGENT = {
    "login": "agent1",
    "name": "SUCCESSION Agent",
    "role": "agent",
    "language": "en",
}
DEMO_ORDER_DESCRIPTION = "22K Traditional Bridal Haar [SYNTHETIC DEMO]"
DEMO_ORDER_WASTAGE = Decimal("2.0")
DEMO_ORDER_STATUS = "OPEN"
DEMO_AUDIT_ACTION = "demo_seeded"
DEMO_AUDIT_ENTITY = "system"
DEMO_AUDIT_METADATA = {"note": "Synthetic demo environment initialized"}


class SeedSafetyError(RuntimeError):
    """Raised when seed safety or state-validation checks fail."""


def _sqlite_path_from_url(url: str) -> Path | None:
    prefix = "sqlite:///"
    if not url.startswith(prefix):
        return None
    raw = url[len(prefix):]
    if raw.startswith("/") and len(raw) > 2 and raw[2] == ":":
        raw = raw[1:]
    if not raw or raw == ":memory:":
        return None
    try:
        return Path(raw).expanduser().resolve()
    except Exception:
        return None


def _require_disposable_db_target() -> None:
    """Strict preflight checks to ensure an explicitly selected disposable database."""
    if os.getenv("ALLOW_DEMO_SEED") != "1":
        raise SeedSafetyError(
            "Refusing to seed: set ALLOW_DEMO_SEED=1 for development/disposable database use only."
        )
    if os.getenv("DEMO_SEED_CONFIRM_DISPOSABLE_DB") != "YES":
        raise SeedSafetyError(
            "Refusing to seed: set DEMO_SEED_CONFIRM_DISPOSABLE_DB=YES to confirm a disposable database target."
        )

    db_url = os.environ.get("DATABASE_URL")
    if not db_url or not db_url.strip():
        raise SeedSafetyError(
            "Refusing to seed: DATABASE_URL must be explicitly supplied for this command."
        )

    db_url = db_url.strip()
    normalized = db_url.replace("\\", "/").lower()
    sqlite_path = _sqlite_path_from_url(db_url)
    if sqlite_path is not None and sqlite_path == DEFAULT_SWARN_DB:
        raise SeedSafetyError("Refusing to seed: target resolves to the repository default swarn.db.")
    if "swarn.db" in normalized:
        raise SeedSafetyError("Refusing to seed: DATABASE_URL must not target swarn.db.")


def _collect_and_validate_passwords() -> dict[str, str]:
    """Collect and validate all credentials before any database access."""
    creds = {
        "jeweller": os.getenv("DEMO_JEWELLER_PASSWORD") or getpass.getpass("Demo jeweller password: "),
        "karigar": os.getenv("DEMO_KARIGAR_PASSWORD") or getpass.getpass("Demo karigar password: "),
        "agent": os.getenv("DEMO_AGENT_PASSWORD") or getpass.getpass("Demo agent password: "),
    }
    missing = [key for key, value in creds.items() if not value]
    if missing:
        raise SeedSafetyError("Missing required demo credentials; no database changes were made.")
    return creds


def _find_user(db, login: str) -> User | None:
    return db.scalar(select(User).where(User.login == login))


def _user_matches(user: User, expected: dict[str, str]) -> bool:
    return (
        user.login == expected["login"]
        and user.role == expected["role"]
        and user.name == expected["name"]
        and user.language == expected["language"]
    )


def _expected_due_date(today: date) -> date:
    return today + timedelta(days=3)


def _find_expected_orders(db, jeweller_id: int, karigar_id: int) -> list[Order]:
    return list(
        db.scalars(
            select(Order).where(
                Order.jeweller_id == jeweller_id,
                Order.karigar_id == karigar_id,
                Order.description == DEMO_ORDER_DESCRIPTION,
            )
        )
    )


def _order_matches_expected(order: Order, today: date) -> bool:
    return (
        order.description == DEMO_ORDER_DESCRIPTION
        and order.wastage_pct == DEMO_ORDER_WASTAGE
        and order.status == DEMO_ORDER_STATUS
        and order.due_date == _expected_due_date(today)
    )


def seed() -> int:
    _require_disposable_db_target()
    creds = _collect_and_validate_passwords()

    try:
        with SessionLocal() as db:
            today = date.today()
            jeweller = _find_user(db, DEMO_JEWELLER["login"])
            karigar1 = _find_user(db, DEMO_KARIGAR_1["login"])
            karigar2 = _find_user(db, DEMO_KARIGAR_2["login"])
            agent = _find_user(db, DEMO_AGENT["login"])
            users = [jeweller, karigar1, karigar2, agent]
            present = [u for u in users if u is not None]

            # Strict preflight: partial seed or unexpected roles/relationships must stop without modification.
            if present and len(present) != len(users):
                raise SeedSafetyError(
                    "Partial demo seed detected (some expected demo users are missing). "
                    "No database changes were made."
                )

            if len(present) == len(users):
                assert jeweller and karigar1 and karigar2 and agent
                expected_pairs = [
                    (jeweller, DEMO_JEWELLER),
                    (karigar1, DEMO_KARIGAR_1),
                    (karigar2, DEMO_KARIGAR_2),
                    (agent, DEMO_AGENT),
                ]
                if any(not _user_matches(user, expected) for user, expected in expected_pairs):
                    raise SeedSafetyError(
                        "Existing demo users have unexpected roles or attributes. No database changes were made."
                    )

                orders = _find_expected_orders(db, jeweller.id, karigar1.id)
                if len(orders) != 1 or not _order_matches_expected(orders[0], today):
                    raise SeedSafetyError(
                        "Expected synthetic demo order is missing, duplicated, or has unexpected details/relationships. "
                        "No database changes were made."
                    )

                print("=== DEMO SEED NO-OP ===")
                print("Expected synthetic demo entities already exist and are valid. No database changes were made.")
                return 0

            # No demo entities exist: create the complete dataset.
            jeweller = User(
                login=DEMO_JEWELLER["login"],
                name=DEMO_JEWELLER["name"],
                password_hash=hash_password(creds["jeweller"]),
                role=DEMO_JEWELLER["role"],
                language=DEMO_JEWELLER["language"],
            )
            karigar1 = User(
                login=DEMO_KARIGAR_1["login"],
                name=DEMO_KARIGAR_1["name"],
                password_hash=hash_password(creds["karigar"]),
                role=DEMO_KARIGAR_1["role"],
                language=DEMO_KARIGAR_1["language"],
            )
            karigar2 = User(
                login=DEMO_KARIGAR_2["login"],
                name=DEMO_KARIGAR_2["name"],
                password_hash=hash_password(creds["karigar"]),
                role=DEMO_KARIGAR_2["role"],
                language=DEMO_KARIGAR_2["language"],
            )
            agent = User(
                login=DEMO_AGENT["login"],
                name=DEMO_AGENT["name"],
                password_hash=hash_password(creds["agent"]),
                role=DEMO_AGENT["role"],
                language=DEMO_AGENT["language"],
            )
            db.add_all([jeweller, karigar1, karigar2, agent])
            db.flush()

            order = Order(
                jeweller_id=jeweller.id,
                karigar_id=karigar1.id,
                description=DEMO_ORDER_DESCRIPTION,
                due_date=_expected_due_date(today),
                wastage_pct=DEMO_ORDER_WASTAGE,
                status=DEMO_ORDER_STATUS,
            )
            db.add(order)
            db.flush()

            audit.log(
                db,
                jeweller.id,
                DEMO_AUDIT_ACTION,
                DEMO_AUDIT_ENTITY,
                None,
                DEMO_AUDIT_METADATA,
            )

            try:
                db.commit()
            except IntegrityError as exc:
                db.rollback()
                raise SeedSafetyError(
                    "Demo seed could not be completed due to integrity constraints. No partial repair was attempted."
                ) from exc

        print("=== DEMO SEED COMPLETED ===")
        print("Synthetic demo dataset created on a disposable development database (credentials not displayed).")
        return 0

    except OperationalError as exc:
        print(
            "Error: database unavailable or schema not initialized. "
            "Run `python -m alembic upgrade head` on the intended disposable development database first.",
            file=sys.stderr,
        )
        return 1
    except SeedSafetyError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    try:
        raise SystemExit(seed())
    except (EOFError, KeyboardInterrupt):
        print("Error: required input was not provided. No database changes were made.", file=sys.stderr)
        raise SystemExit(1)
    except SystemExit:
        raise
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        raise SystemExit(1)

