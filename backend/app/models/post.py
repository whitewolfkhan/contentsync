"""Database models for posts and per-platform publication results."""
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from ..database import Base


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(String(300), nullable=False)
    markdown_content = Column(Text, nullable=False)
    cover_image_url = Column(String(500), nullable=True)
    tags = Column(String(500), nullable=True)  # comma separated

    publish_at = Column(DateTime, nullable=False, index=True)
    status = Column(String(20), nullable=False, default="SCHEDULED", index=True)
    # SCHEDULED | PUBLISHING | PUBLISHED | FAILED

    # Selected target platforms stored as comma separated list:
    # "devto,wordpress,notion,blogger"
    target_platforms = Column(String(200), nullable=False, default="devto")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="posts")
    publications = relationship(
        "Publication", back_populates="post", cascade="all, delete-orphan"
    )


class Publication(Base):
    __tablename__ = "publications"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    platform = Column(String(30), nullable=False)  # devto | wordpress | notion | blogger
    status = Column(String(20), nullable=False, default="PENDING")
    # PENDING | PUBLISHED | FAILED
    live_url = Column(String(500), nullable=True)
    error_message = Column(Text, nullable=True)
    published_at = Column(DateTime, nullable=True)

    post = relationship("Post", back_populates="publications")