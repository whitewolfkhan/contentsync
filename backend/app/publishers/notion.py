"""Notion publisher. Notion's public API accepts a parent page id and
the post content as Notion-flavored Markdown. The page is created inside
the configured parent — share the parent page with your integration first.
"""
import httpx

from .base import BasePublisher, PublishResult, is_rate_limit_response, _parse_retry_after

NOTION_API = "https://api.notion.com/v1"
NOTION_VERSION = "2022-06-28"


class NotionPublisher(BasePublisher):
    platform_name = "notion"

    def __init__(self, api_key: str, parent_page_id: str | None = None):
        super().__init__(api_key)
        if not parent_page_id:
            raise ValueError(
                "Notion requires a parent_page_id (the page that will own new posts)."
            )
        # Notion ids are dashed UUIDs in the UI but the API accepts the dashed
        # form directly. We just trim whitespace.
        self.parent_page_id = parent_page_id.strip()

    async def publish(self, client: httpx.AsyncClient, post) -> PublishResult:
        endpoint = f"{NOTION_API}/pages"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        # The properties payload must match the parent's schema. For a plain
        # page parent, only "title" is accepted as a property.
        properties = {
            "title": {
                "title": [{"type": "text", "text": {"content": post.title}}]
            }
        }
        # Notion-flavored markdown body. The `markdown` body parameter handles
        # most common syntax (headings, lists, code, quotes, links, images).
        children_payload: dict = {"markdown": post.markdown_content}
        if post.cover_image_url:
            children_payload["cover"] = {"type": "external", "external": {"url": post.cover_image_url}}

        body = {
            "parent": {"page_id": self.parent_page_id},
            "properties": properties,
        }
        # `children` and `markdown` are mutually exclusive; `markdown` was added
        # in 2025 and is the cleanest way to send our single Markdown source.
        body.update(children_payload)

        try:
            response = await client.post(
                endpoint, json=body, headers=headers, timeout=30.0
            )
            if response.status_code in (200, 201):
                data = response.json()
                return PublishResult(
                    success=True, live_url=data.get("url") or data.get("public_url")
                )
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