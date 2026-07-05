"""Auth helpers: bcrypt password hashing, Fernet secret encryption,
session-cookie signing/verification, and the FastAPI dependency that
returns the currently-logged-in User.
"""
from typing import Optional

import bcrypt
from cryptography.fernet import Fernet, InvalidToken
from fastapi import Cookie, Depends, HTTPException, status
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import User

SESSION_COOKIE_NAME = "contentsync_session"
SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14  # 14 days

RESET_TOKEN_SALT = "contentsync-password-reset"


# --- password -----------------------------------------------------------

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


# --- secret encryption --------------------------------------------------

def encrypt_secret(plain: str) -> str:
    return settings.fernet().encrypt(plain.encode("utf-8")).decode("utf-8")


def decrypt_secret(token: str) -> Optional[str]:
    try:
        return settings.fernet().decrypt(token.encode("utf-8")).decode("utf-8")
    except (InvalidToken, ValueError):
        return None


def mask_secret(plain: str) -> str:
    if not plain:
        return ""
    if len(plain) <= 8:
        return "*" * len(plain)
    return plain[:4] + "*" * (len(plain) - 8) + plain[-4:]


# --- session cookie -----------------------------------------------------

def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(settings.resolved_session_secret(), salt="contentsync-session")


def _reset_serializer() -> URLSafeTimedSerializer:
    """Like `_serializer` but signed with the reset secret and a different salt,
    so a session cookie can never be replayed as a reset token."""
    key = settings.reset_secret or settings.resolved_session_secret()
    return URLSafeTimedSerializer(key, salt=RESET_TOKEN_SALT)


def issue_session_cookie(user_id: int) -> str:
    return _serializer().dumps({"uid": user_id})


def read_session_cookie(value: str) -> Optional[int]:
    if not value:
        return None
    try:
        payload = _serializer().loads(value, max_age=SESSION_MAX_AGE_SECONDS)
    except (BadSignature, SignatureExpired):
        return None
    uid = payload.get("uid") if isinstance(payload, dict) else None
    return int(uid) if isinstance(uid, int) else None


def issue_reset_token(user_id: int) -> str:
    """Short-lived signed token that the user receives via email to prove they
    own the email address when resetting their password."""
    return _reset_serializer().dumps({"uid": user_id})


def read_reset_token(value: str) -> Optional[int]:
    if not value:
        return None
    try:
        payload = _reset_serializer().loads(
            value, max_age=settings.reset_token_max_age_seconds
        )
    except (BadSignature, SignatureExpired):
        return None
    uid = payload.get("uid") if isinstance(payload, dict) else None
    return int(uid) if isinstance(uid, int) else None


# --- FastAPI dependency -------------------------------------------------

def get_current_user(
    db: Session = Depends(get_db),
    session_cookie: Optional[str] = Cookie(default=None, alias=SESSION_COOKIE_NAME),
) -> User:
    """Dependency that returns the logged-in User, or raises 401."""
    if not session_cookie:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not signed in"
        )
    user_id = read_session_cookie(session_cookie)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session"
        )
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Account no longer exists"
        )
    return user


def get_optional_user(
    db: Session = Depends(get_db),
    session_cookie: Optional[str] = Cookie(default=None, alias=SESSION_COOKIE_NAME),
) -> Optional[User]:
    """Like `get_current_user` but returns None instead of raising 401."""
    if not session_cookie:
        return None
    user_id = read_session_cookie(session_cookie)
    if not user_id:
        return None
    return db.query(User).filter(User.id == user_id).first()