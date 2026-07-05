"""Auth endpoints: /api/auth/{signup,login,logout,me,forgot-password,reset-password}."""
import logging

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import User
from .schemas import (
    ForgotPasswordRequest,
    LoginRequest,
    ResetPasswordRequest,
    SignupRequest,
    UserOut,
)
from .services.auth import (
    SESSION_COOKIE_NAME,
    SESSION_MAX_AGE_SECONDS,
    get_current_user,
    hash_password,
    issue_reset_token,
    issue_session_cookie,
    read_reset_token,
    verify_password,
)

log = logging.getLogger("contentsync.auth")

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_session_cookie(response: Response, user_id: int) -> None:
    # The frontend (next.js) and the API run on different ports (3001 vs 8765)
    # during local dev, so the session cookie is cross-origin. Browsers refuse
    # to attach cross-origin cookies unless SameSite=None and Secure are both
    # set. localhost / 127.0.0.1 are treated as secure contexts by Chromium
    # and Firefox, so Secure=True works in dev over plain HTTP.
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=issue_session_cookie(user_id),
        max_age=SESSION_MAX_AGE_SECONDS,
        httponly=True,
        samesite="none",
        secure=True,
        path="/",
    )


@router.post("/signup", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, response: Response, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        display_name=(payload.display_name or "").strip() or None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    _set_session_cookie(response, user.id)
    return user


@router.post("/login", response_model=UserOut)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    _set_session_cookie(response, user.id)
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    response.delete_cookie(SESSION_COOKIE_NAME, path="/", samesite="none", secure=True)
    return None


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


# --- Password reset -----------------------------------------------------
#
# Both endpoints return the same generic success message regardless of
# whether the email exists, so attackers can't enumerate accounts. The
# forgot-password endpoint additionally returns a `dev_reset_url` when
# email delivery isn't configured (development convenience).


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    generic = {"message": "If an account exists for that email, a reset link has been sent."}

    user = db.query(User).filter(User.email == email).first()
    if not user:
        return generic

    token = issue_reset_token(user.id)
    reset_url = f"{settings.reset_url_base.rstrip('/')}/reset-password?token={token}"

    # TODO: wire up SMTP. For now we log and return the URL so devs can
    # click through without setting up an inbox.
    log.warning("Password reset requested for %s -> %s", email, reset_url)
    return {
        **generic,
        "dev_reset_url": reset_url,
    }


@router.post("/reset-password", response_model=UserOut)
def reset_password(
    payload: ResetPasswordRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    user_id = read_reset_token(payload.token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset link. Please request a new one.",
        )
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset link. Please request a new one.",
        )

    user.password_hash = hash_password(payload.new_password)
    db.commit()
    db.refresh(user)

    # Sign the user in immediately so they don't have to retype credentials.
    _set_session_cookie(response, user.id)
    return user