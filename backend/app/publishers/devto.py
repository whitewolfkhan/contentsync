"""Dev.to publisher. Dev.to expects a standard Markdown body with YAML-style
front matter describing the article metadata.
"""
import re

import httpx

from .base import BasePublisher, PublishResult, is_rate_limit_response, _parse_retry_after

DEVTO_ENDPOINT = "https://dev.to/api/articles"


def _to_devto_payload(post) -> dict:
    """Reformat the markdown content into Dev.to's expected JSON shape."""
    tags = [t.strip() for t in (post.tags or []) if t.strip()][:4]

    # Dev.to article markdown body must include front matter. We prepend a
    # canonical front matter block so the post renders correctly on Dev.to.
    front_matter_lines = ["---"]
    front_matter_lines.append(f"title: {post.title}")
    front_matter_lines.append(f"published: true")
    if post.cover_image_url:
        front_matter_lines.append(f"cover_image: {post.cover_image_url}")
    if tags:
        front_matter_lines.append(f"tags: {','.join(tags)}")
    front_matter_lines.append("---")
    front_matter = "\n".join(front_matter_lines)

    body = post.markdown_content.strip()
    # Strip any leading front matter the author may have added to avoid duplication.
    body = re.sub(r"^---[\s\S]*?---\s*", "", body)

    return {
        "article": {
            "title": post.title,
            "body_markdown": f"{front_matter}\n\n{body}",
            "published": True,
            "tags": tags,
            **({"main_image": post.cover_image_url} if post.cover_image_url else {}),
            **({"canonical_url": post.cover_image_url} if False else {}),
        }
    }


class DevToPublisher(BasePublisher):
    platform_name = "devto"

    async def publish(self, client: httpx.AsyncClient, post) -> PublishResult:
        headers = {
            "api-key": self.api_key,
            "Content-Type": "application/json",
        }
        try:
            response = await client.post(
                DEVTO_ENDPOINT, json=_to_devto_payload(post), headers=headers, timeout=30.0
            )
            if response.status_code in (200, 201):
                data = response.json()
                return PublishResult(success=True, live_url=data.get("url"))
            if is_rate_limit_response(response):
                return PublishResult(
                    success=False,
                    error=f"HTTP {response.status_code}: rate limit hit",
                    rate_limited=True,
                    rate_limit_reset_at=_parse_retry_after(response),
                )
            return PublishResult(
                success=False,
                error=f"HTTP {response.status_code}: {response.text[:300]}",
            )
        except Exception as exc:  # noqa: BLE001
            return PublishResult(success=False, error=str(exc))