"""Factory that builds the right publisher instance for a given platform,
using per-user credentials loaded from the PlatformKey table.

The `Post` model no longer carries credentials — every user keeps their own
encrypted blob in `platform_keys`, and we decrypt it on the fly here.
"""
from typing import Optional

from sqlalchemy.orm import Session

from ..models import PlatformKey
from ..models.post import Post
from ..services.auth import decrypt_secret
from .base import BasePublisher, PublishResult
from .blogger import BloggerPublisher
from .devto import DevToPublisher
from .notion import NotionPublisher
from .wordpress import WordPressPublisher


def _load_credentials(
    db: Session, user_id: int, platform: str
) -> tuple[Optional[str], Optional[str]]:
    """Returns (secret, extra_id) for this user+platform, or (None, None)."""
    row = (
        db.query(PlatformKey)
        .filter(PlatformKey.user_id == user_id, PlatformKey.platform == platform)
        .first()
    )
    if not row:
        return None, None
    secret = decrypt_secret(row.secret_value)
    return secret, row.extra_id


def build_publisher(
    platform: str, post: Post, db: Session
) -> Optional[BasePublisher]:
    platform = platform.lower().strip()
    secret, extra_id = _load_credentials(db, post.user_id, platform)
    if not secret:
        return None

    if platform == "devto":
        return DevToPublisher(api_key=secret)
    if platform == "wordpress":
        if not extra_id:
            return None
        return WordPressPublisher(api_key=secret, site_id=extra_id)
    if platform == "notion":
        if not extra_id:
            return None
        return NotionPublisher(api_key=secret, parent_page_id=extra_id)
    if platform == "blogger":
        if not extra_id:
            return None
        return BloggerPublisher(api_key=secret, blog_id=extra_id)
    return None


__all__ = ["build_publisher", "BasePublisher", "PublishResult"]