"""REST routes for posts: list, create, get, delete, manual publish.

Every post is owned by the logged-in user (injected via the
`current_user` dependency). Users can only see and modify their own posts.
"""
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from .database import get_db
from .models import Post, User
from .schemas import PostCreate, PostOut, PostSummary
from .services.auth import get_current_user
from .services.dispatcher import dispatch_post_sync

router = APIRouter()


def _post_to_out(post: Post) -> PostOut:
    return PostOut(
        id=post.id,
        user_id=post.user_id,
        title=post.title,
        markdown_content=post.markdown_content,
        cover_image_url=post.cover_image_url,
        tags=[t for t in (post.tags or "").split(",") if t],
        publish_at=post.publish_at,
        status=post.status,
        target_platforms=[t for t in (post.target_platforms or "").split(",") if t],
        created_at=post.created_at,
        updated_at=post.updated_at,
        publications=post.publications or [],
    )


@router.get("/health")
def health():
    return {"status": "ok", "time": datetime.utcnow().isoformat()}


@router.get("/posts", response_model=List[PostSummary])
def list_posts(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    posts = (
        db.query(Post)
        .options(joinedload(Post.publications))
        .filter(Post.user_id == user.id)
        .order_by(Post.publish_at.desc())
        .all()
    )
    return [
        PostSummary(
            id=p.id,
            title=p.title,
            publish_at=p.publish_at,
            status=p.status,
            target_platforms=[t for t in (p.target_platforms or "").split(",") if t],
            created_at=p.created_at,
        )
        for p in posts
    ]


@router.post("/posts", response_model=PostOut, status_code=status.HTTP_201_CREATED)
def create_post(
    payload: PostCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    post = Post(
        user_id=user.id,
        title=payload.title.strip(),
        markdown_content=payload.markdown_content,
        cover_image_url=payload.cover_image_url,
        tags=",".join(t.strip() for t in payload.tags if t.strip()),
        publish_at=payload.publish_at,
        target_platforms=",".join(
            t.strip().lower() for t in payload.target_platforms if t.strip()
        ),
        status="SCHEDULED",
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return _post_to_out(post)


@router.get("/posts/{post_id}", response_model=PostOut)
def get_post(
    post_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    post = (
        db.query(Post)
        .options(joinedload(Post.publications))
        .filter(Post.id == post_id, Post.user_id == user.id)
        .first()
    )
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return _post_to_out(post)


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    post = (
        db.query(Post)
        .filter(Post.id == post_id, Post.user_id == user.id)
        .first()
    )
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    db.delete(post)
    db.commit()
    return None


@router.post("/posts/{post_id}/publish-now", response_model=PostOut)
def publish_now(
    post_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Force-publish a post immediately, ignoring the schedule."""
    post = (
        db.query(Post)
        .options(joinedload(Post.publications))
        .filter(Post.id == post_id, Post.user_id == user.id)
        .first()
    )
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    for pub in list(post.publications):
        db.delete(pub)
    db.commit()
    dispatch_post_sync(post, db)
    db.refresh(post)
    return _post_to_out(post)