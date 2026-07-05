"""APScheduler job: every N seconds, look for SCHEDULED posts whose
publish_at has arrived and dispatch them to the publisher pool.
"""
import logging
from datetime import datetime

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session

from ..config import settings
from ..database import SessionLocal
from ..models.post import Post
from .dispatcher import dispatch_post_sync

logger = logging.getLogger("contentsync.scheduler")


def scan_due_posts() -> None:
    """Single poll: fetch due posts and dispatch each in its own DB session."""
    db: Session = SessionLocal()
    try:
        now = datetime.utcnow()
        due_posts = (
            db.query(Post)
            .filter(Post.status == "SCHEDULED", Post.publish_at <= now)
            .all()
        )
        if not due_posts:
            return

        logger.info("Found %d due posts to publish", len(due_posts))
        for post in due_posts:
            try:
                # Each post gets a fresh session so concurrent writes don't collide.
                inner_db = SessionLocal()
                try:
                    fresh = inner_db.merge(post)
                    dispatch_post_sync(fresh, inner_db)
                finally:
                    inner_db.close()
            except Exception as exc:  # noqa: BLE001
                logger.exception("Failed to publish post id=%s: %s", post.id, exc)
                post.status = "FAILED"
                db.commit()
    finally:
        db.close()


def start_scheduler() -> BackgroundScheduler:
    scheduler = BackgroundScheduler(timezone="UTC")
    scheduler.add_job(
        scan_due_posts,
        trigger="interval",
        seconds=settings.scheduler_poll_seconds,
        id="scan_due_posts",
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )
    scheduler.start()
    logger.info(
        "Scheduler started; polling every %ss", settings.scheduler_poll_seconds
    )
    return scheduler