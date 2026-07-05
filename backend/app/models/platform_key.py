"""Per-user per-platform encrypted credentials (e.g. devto api key).

Secret values are stored Fernet-encrypted at rest so a database dump
alone does not leak API tokens.
"""
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from ..database import Base


class PlatformKey(Base):
    __tablename__ = "platform_keys"
    __table_args__ = (
        UniqueConstraint("user_id", "platform", name="uq_user_platform"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # devto | wordpress | notion | blogger
    platform = Column(String(30), nullable=False)
    # For platforms that need a non-secret id (WordPress site id, Blogger blog
    # id, Notion parent page id) we keep the encrypted blob in `secret_value`
    # and the unencrypted id in `extra_id` since it's not strictly secret.
    extra_id = Column(String(255), nullable=True)
    secret_value = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Rate-limit state. Set by the dispatcher when a publish call returns 429
    # (or a platform-specific rate-limit signal). Frontend reads these columns
    # via GET /api/keys and shows a banner until `rate_limit_reset_at` passes.
    rate_limited_at = Column(DateTime, nullable=True)
    rate_limit_reset_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="platform_keys")