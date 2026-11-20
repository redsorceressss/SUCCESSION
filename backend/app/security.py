"""Password hashing and JWT tokens."""

import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone
import jwt
from .config import settings

_ALGO = "HS256"

def hash_password(password: str) -> str:
    """scrypt (memory-hard) from standard library: safe defaults.
    Format: scrypt$<salt hex>$<hash hex>.
    """
    salt = os.urandom(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return f"scrypt${salt.hex()}${digest.hex()}"

def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, salt_hex, hash_hex = stored.split("$")
        if scheme != "scrypt":
            return False
        digest = hashlib.scrypt(
            password.encode(),
            salt=bytes.fromhex(salt_hex),
            n=2**14,
            r=8,
            p=1,
            dklen=32,
        )
        return hmac.compare_digest(digest.hex(), hash_hex)
    except Exception:
        return False

def create_token(user_id: int, role: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=settings.token_minutes)
    return jwt.encode({"sub": str(user_id), "role": role, "exp": exp}, settings.secret_key, algorithm=_ALGO)

def decode_token(token: str) -> dict:
    """Raises jwt.PyJWTError for bad signature or expired token."""
    return jwt.decode(token, settings.secret_key, algorithms=[_ALGO])
