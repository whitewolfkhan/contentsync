"""/api/keys — the user-facing endpoints to manage their platform credentials."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from .models import PlatformKey, User
from .schemas import PlatformKeyOut, PlatformKeyUpsert, SUPPORTED_PLATFORMS
from .services.auth import decrypt_secret, encrypt_secret, get_current_user, mask_secret

router = APIRouter(prefix="/keys", tags=["keys"])


def _to_out(pk: PlatformKey) -> PlatformKeyOut:
    plain = decrypt_secret(pk.secret_value) or ""
    return PlatformKeyOut(
        platform=pk.platform,
        extra_id=pk.extra_id,
        secret_masked=mask_secret(plain),
        updated_at=pk.updated_at,
        rate_limited_at=pk.rate_limited_at,
        rate_limit_reset_at=pk.rate_limit_reset_at,
    )


@router.get("", response_model=List[PlatformKeyOut])
def list_keys(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    rows = (
        db.query(PlatformKey)
        .filter(PlatformKey.user_id == user.id)
        .order_by(PlatformKey.platform)
        .all()
    )
    return [_to_out(r) for r in rows]


@router.put("/{platform}", response_model=PlatformKeyOut)
def upsert_key(
    platform: str,
    payload: PlatformKeyUpsert,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    platform = platform.lower().strip()
    if platform not in SUPPORTED_PLATFORMS:
        raise HTTPException(status_code=400, detail=f"Unsupported platform: {platform}")
    if platform != "devto" and not (payload.extra_id or "").strip():
        raise HTTPException(
            status_code=400,
            detail=f"{platform} requires the extra id (site_id, page id, blog id)",
        )

    row = (
        db.query(PlatformKey)
        .filter(PlatformKey.user_id == user.id, PlatformKey.platform == platform)
        .first()
    )
    encrypted = encrypt_secret(payload.secret_value.strip())
    extra_id = (payload.extra_id or "").strip() or None
    if row is None:
        row = PlatformKey(
            user_id=user.id,
            platform=platform,
            extra_id=extra_id,
            secret_value=encrypted,
        )
        db.add(row)
    else:
        row.extra_id = extra_id
        row.secret_value = encrypted
        # Re-saving the key is the user telling us the credential is fresh —
        # clear any stale rate-limit flag so the banner disappears immediately.
        row.rate_limited_at = None
        row.rate_limit_reset_at = None
    db.commit()
    db.refresh(row)
    return _to_out(row)


@router.delete("/{platform}", status_code=status.HTTP_204_NO_CONTENT)
def delete_key(
    platform: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    platform = platform.lower().strip()
    row = (
        db.query(PlatformKey)
        .filter(PlatformKey.user_id == user.id, PlatformKey.platform == platform)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Key not set")
    db.delete(row)
    db.commit()
    return None