"""Blogger publisher. Blogger's v3 API posts to a blog using an OAuth2
access token + the numeric blog id. Blogger accepts HTML content directly,
so we feed our Markdown source through the same lightweight converter used
by the WordPress publisher.
"""
import httpx

from .base import BasePublisher, PublishResult, is_rate_limit_response, _parse_retry_after
from .wordpress import _markdown_to_html

BLOGGER_API = "https://www.googleapis.com/blogger/v3"


class BloggerPublisher(BasePublisher):
    platform_name = "blogger"

    def __init__(self, api_key: str, blog_id: str | None = None):
        super().__init__(api_key)
        if not blog_id:
            raise ValueError(
                "Blogger requires a blog_id (the numeric blog id)."
            )
        self.blog_id = blog_id

    async def publish(self, client: httpx.AsyncClient, post) -> PublishResult:
        endpoint = f"{BLOGGER_API}/blogs/{self.blog_id}/posts"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        tags = [t.strip() for t in (post.tags or []) if t.strip()][:8]
        labels = [{"name": t} for t in tags]
        body: dict = {
            "title": post.title,
            "content": _markdown_to_html(post.markdown_content),
        }
        if labels:
            body["labels"] = labels
        # Blogger does not have a first-class cover field in the v3 posts
        # insert endpoint, but you can prepend an image to the content.
        if post.cover_image_url:
            body["content"] = (
                f'<img src="{post.cover_image_url}" alt="" />\n' + body["content"]
            )

        try:
            response = await client.post(
                endpoint, json=body, params={"isDraft": "false"},
                headers=headers, timeout=30.0,
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