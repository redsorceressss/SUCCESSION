"""Database engine, session factory and the exact-decimal column type."""

from decimal import Decimal
from sqlalchemy import String, create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.types import TypeDecorator
from .config import settings

class DecimalString(TypeDecorator):
    """Store a Decimal as text so SQLite never turns it into a float.
    SQLite has no real decimal type; its NUMERIC columns are floats underneath.
    Storing "49.8500" as text keeps every digit. On PostgreSQL you could switch to
    Numeric(12, 4), but then do the maths in Python Decimal as we do here.
    """
    impl = String(40)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return None if value is None else str(Decimal(str(value)))

    def process_result_value(self, value, dialect):
        return None if value is None else Decimal(value)

class Base(DeclarativeBase):
    pass

_connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=_connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

def get_db():
    """FastAPI dependency: one session per request, always closed."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
