"""Base publisher contract. Each platform implementation reformats the
single markdown source into the JSON shape that the destination API expects.
"""
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx


@dataclass
class PublishResult:
    success: bool
    live_url: Optional[str] = None
    error: Optional[str] = None
    # Set when the platform's API responded with a rate-limit signal
    # (HTTP 429, or a platform-specific error body). The dispatcher writes
    # these onto the user's PlatformKey row so the UI can show a banner.
    rate_limited: bool = False
    rate_limit_reset_at: Optional[datetime] = None


def _parse_retry_after(response: httpx.Response) -> Optional[datetime]:
    """Best-effort parse of `Retry-After` (seconds or HTTP-date) into a UTC
    datetime. Falls back to None when the header is missing or malformed."""
    header = response.headers.get("Retry-After") or response.headers.get(
        "retry-after"
    )
    if not header:
        return None
    header = header.strip()
    # Numeric form = seconds.
    if header.isdigit():
        return datetime.now(timezone.utc) + timedelta(seconds=int(header))
    # HTTP-date form.
    try:
        from email.utils import parsedate_to_datetime

        dt = parsedate_to_datetime(header)
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:  # noqa: BLE001
        return None


def is_rate_limit_response(response: httpx.Response) -> bool:
    """True when this HTTP response looks like a rate-limit signal.

    Most platforms use HTTP 429, but Blogger sometimes returns 403 with
    `rateLimitExceeded` in the body and a few others use 503 with a custom
    message. We stay conservative: only treat a response as a rate-limit
    hit when the status OR body unambiguously identifies one.
    """
    if response.status_code == 429:
        return True
    if response.status_code in (403, 503):
        body = (response.text or "").lower()
        if any(
            marker in body
            for marker in (
                "ratelimitexceeded",
                "rate_limit_exceeded",
                "rate limit",
                "too many requests",
            )
        ):
            return True
    return False


class BasePublisher:
    platform_name: str = "base"

    def __init__(self, api_key: Optional[str] = None):
        if not api_key:
            raise ValueError(
                f"Missing API credentials for platform '{self.platform_name}'."
            )
        self.api_key = api_key

    async def publish(self, client, post) -> PublishResult:  # pragma: no cover
        raise NotImplementedError