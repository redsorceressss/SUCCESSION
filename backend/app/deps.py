"""Dependencies that every protected route uses: who is calling, and are they allowed?"""

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from .database import get_db
from .models import User
from .security import decode_token

_bearer = HTTPBearer(auto_error=False)

def get_current_user(
    cred: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db)
) -> User:
    if cred is None:
        raise HTTPException(401, "Missing bearer token")
    try:
        data = decode_token(cred.credentials)
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid or expired token")
    user = db.get(User, int(data["sub"]))
    if user is None:
        raise HTTPException(401, "Unknown user")
    return user

def require_roles(*roles: str):
    """Usage: user: User = Depends(require_roles("jeweller")). Wrong role gives 403."""
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(403, f"This action is not allowed for role '{user.role}'")
        return user
    return checker

PARTY = require_roles("jeweller", "karigar")  # humans only; the agent role is excluded
ASSAYER = require_roles("assayer")  # independent third-party measurement verifier
PARTY_OR_ASSAYER = require_roles("jeweller", "karigar", "assayer")  # measurement + verification
