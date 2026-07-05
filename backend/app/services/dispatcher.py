"""Dispatcher service: given a due Post, fires concurrent publish requests to
all selected platforms using a single httpx.AsyncClient, then writes the
results back into the Publication table for each platform.
"""
import asyncio
from dataclasses import dataclass
from datetime import datetime

import httpx
from sqlalchemy.orm import Session

from ..models.platform_key import PlatformKey
from ..models.post import Post, Publication
from ..publishers.factory import build_publisher


@dataclass
class _PublishOutcome:
    platform: str
    success: bool
    live_url: str | None
    error: str | None
    rate_limited: bool = False
    rate_limit_reset_at: datetime | None = None


async def _publish_one(
    client: httpx.AsyncClient, post: Post, platform: str, db: Session
) -> _PublishOutcome:
    publisher = build_publisher(platform, post, db)
    if publisher is None:
        return _PublishOutcome(
            platform=platform,
            success=False,
            live_url=None,
            error=f"No credentials configured for {platform}",
        )
    result = await publisher.publish(client, post)
    return _PublishOutcome(
        platform=platform,
        success=result.success,
        live_url=result.live_url,
        error=result.error,
        rate_limited=result.rate_limited,
        rate_limit_reset_at=result.rate_limit_reset_at,
    )


def _update_rate_limit_state(
    db: Session, user_id: int, platform: str, outcome: _PublishOutcome
) -> None:
    """Write/clear rate-limit columns on the user's PlatformKey row.

    The dispatcher runs concurrently across platforms, so we may see a stale
    rate-limit state from an earlier dispatch when a new publish succeeds —
    that's exactly the moment we want to *clear* the flag so the UI stops
    showing the warning.
    """
    row = (
        db.query(PlatformKey)
        .filter(PlatformKey.user_id == user_id, PlatformKey.platform == platform)
        .first()
    )
    if row is None:
        return
    now = datetime.utcnow()
    if outcome.rate_limited:
        row.rate_limited_at = now
        row.rate_limit_reset_at = outcome.rate_limit_reset_at
    elif outcome.success:
        # Successful publish means the key is healthy again — clear any
        # outstanding rate-limit flag so the banner disappears.
        row.rate_limited_at = None
        row.rate_limit_reset_at = None
    # If the publish failed for a non-rate-limit reason, leave any existing
    # rate-limit state untouched — they're independent signals.


async def dispatch_post(post: Post, db: Session) -> None:
    """Publish a single post to all of its target platforms concurrently."""
    targets = [
        t.strip() for t in (post.target_platforms or "").split(",") if t.strip()
    ]
    if not targets:
        return

    post.status = "PUBLISHING"
    db.commit()

    async with httpx.AsyncClient() as client:
        outcomes = await asyncio.gather(
            *[_publish_one(client, post, platform, db) for platform in targets],
            return_exceptions=False,
        )

    any_success = False
    for outcome in outcomes:
        pub = Publication(
            post_id=post.id,
            platform=outcome.platform,
            status="PUBLISHED" if outcome.success else "FAILED",
            live_url=outcome.live_url,
            error_message=outcome.error,
            published_at=datetime.utcnow() if outcome.success else None,
        )
        db.add(pub)
        if outcome.success:
            any_success = True
        _update_rate_limit_state(db, post.user_id, outcome.platform, outcome)

    post.status = "PUBLISHED" if any_success else "FAILED"
    db.commit()


def dispatch_post_sync(post: Post, db: Session) -> None:
    """Convenience wrapper to run the async dispatcher from sync code (scheduler)."""
    asyncio.run(dispatch_post(post, db))