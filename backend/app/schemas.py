"""Pydantic schemas for request/response validation."""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


# --- Auth ----------------------------------------------------------------

class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    display_name: Optional[str] = Field(None, max_length=120)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class UserOut(BaseModel):
    id: int
    email: EmailStr
    display_name: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=10)
    new_password: str = Field(..., min_length=8, max_length=128)


# --- Platform keys -------------------------------------------------------

SUPPORTED_PLATFORMS = ("devto", "wordpress", "notion", "blogger")


class PlatformKeyUpsert(BaseModel):
    """Payload to save/overwrite one platform's credentials.

    Only `secret_value` is mandatory; `extra_id` is required only for
    platforms that have a non-secret identifier (wordpress, notion, blogger).
    """
    secret_value: str = Field(..., min_length=1)
    extra_id: Optional[str] = None


class PlatformKeyOut(BaseModel):
    """Returned to the user; secret value is masked, extra_id is shown."""
    platform: str
    extra_id: Optional[str]
    secret_masked: str
    updated_at: datetime
    # Filled when the dispatcher sees a 429 (or platform-specific rate-limit
    # signal) on this key. `rate_limit_reset_at` may be None if the platform
    # didn't include a Retry-After header.
    rate_limited_at: Optional[datetime] = None
    rate_limit_reset_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Posts ---------------------------------------------------------------

class PostCreate(BaseModel):
    title: str = Field(..., max_length=300)
    markdown_content: str
    cover_image_url: Optional[str] = None
    tags: List[str] = []
    publish_at: datetime
    target_platforms: List[str] = Field(..., min_length=1)


class PublicationOut(BaseModel):
    id: int
    platform: str
    status: str
    live_url: Optional[str]
    error_message: Optional[str]
    published_at: Optional[datetime]

    class Config:
        from_attributes = True


class PostOut(BaseModel):
    id: int
    user_id: int
    title: str
    markdown_content: str
    cover_image_url: Optional[str]
    tags: List[str]
    publish_at: datetime
    status: str
    target_platforms: List[str]
    created_at: datetime
    updated_at: datetime
    publications: List[PublicationOut] = []

    class Config:
        from_attributes = True


class PostSummary(BaseModel):
    id: int
    title: str
    publish_at: datetime
    status: str
    target_platforms: List[str]
    created_at: datetime

    class Config:
        from_attributes = True