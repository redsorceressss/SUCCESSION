from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..database import get_db
from ..deps import get_current_user
from ..models import User
from ..schemas import LoginIn, RegisterIn
from ..security import create_token, hash_password, verify_password
from ..services import audit

router = APIRouter(tags=["auth"])

@router.post("/auth/register", status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    if db.scalar(select(User).where(User.login == body.login)):
        raise HTTPException(409, "That login is already taken")
    user = User(
        login=body.login,
        name=body.name,
        password_hash=hash_password(body.password),
        role=body.role,
        language=body.language,
    )
    db.add(user)
    db.flush()
    audit.log(db, user.id, "user_registered", "user", user.id, {"role": user.role})
    db.commit()
    return {"id": user.id, "login": user.login, "role": user.role}

@router.post("/auth/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.login == body.login))
    # same error for "no such user" and "wrong password", so attackers cannot probe which logins exist
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Wrong login or password")
    return {
        "access_token": create_token(user.id, user.role),
        "token_type": "bearer",
        "user": {"id": user.id, "name": user.name, "role": user.role, "language": user.language},
    }

@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return {"id": user.id, "login": user.login, "name": user.name, "role": user.role, "language": user.language}
