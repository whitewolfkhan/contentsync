"""WordPress.com publisher. WordPress.com exposes a REST API that supports
creating posts on free blogs using an OAuth2 access token. The Markdown body
is wrapped in a tiny HTML envelope and posted to the per-site endpoint.
"""
from __future__ import annotations

import re

import httpx

from .base import BasePublisher, PublishResult, is_rate_limit_response, _parse_retry_after

WP_API_BASE = "https://public-api.wordpress.com/rest/v1.1"


def _markdown_to_html(md: str) -> str:
    """Cheap Markdown -> HTML conversion sufficient for blog posts.

    For richer rendering you can swap this for `markdown` + `bleach`,
    but WordPress.com accepts raw HTML so most formatting (headings,
    lists, links, images, code fences) survives after a few regex passes.
    """
    text = md or ""

    # Fenced code blocks first (so inner content is not touched).
    text = re.sub(
        r"```([a-zA-Z0-9_-]*)\n([\s\S]*?)```",
        lambda m: f"<pre><code>{m.group(2).rstrip()}</code></pre>",
        text,
    )
    # Headings.
    text = re.sub(r"^######\s+(.+)$", r"<h6>\1</h6>", text, flags=re.MULTILINE)
    text = re.sub(r"^#####\s+(.+)$", r"<h5>\1</h5>", text, flags=re.MULTILINE)
    text = re.sub(r"^####\s+(.+)$", r"<h4>\1</h4>", text, flags=re.MULTILINE)
    text = re.sub(r"^###\s+(.+)$", r"<h3>\1</h3>", text, flags=re.MULTILINE)
    text = re.sub(r"^##\s+(.+)$", r"<h2>\1</h2>", text, flags=re.MULTILINE)
    text = re.sub(r"^#\s+(.+)$", r"<h1>\1</h1>", text, flags=re.MULTILINE)
    # Bold + italic + inline code.
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"__(.+?)__", r"<strong>\1</strong>", text)
    text = re.sub(r"\*(.+?)\*", r"<em>\1</em>", text)
    text = re.sub(r"_(.+?)_", r"<em>\1</em>", text)
    text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
    # Images + links.
    text = re.sub(r"!\[([^\]]*)\]\(([^)]+)\)", r'<img alt="\1" src="\2" />', text)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', text)
    # Unordered + ordered lists (very simple, block-level).
    lines = text.split("\n")
    out: list[str] = []
    in_ul = in_ol = False
    for line in lines:
        if re.match(r"^[-*]\s+", line):
            if not in_ul:
                out.append("<ul>")
                in_ul = True
            out.append(f"<li>{line[2:].strip()}</li>")
            continue
        if re.match(r"^\d+\.\s+", line):
            if not in_ol:
                out.append("<ol>")
                in_ol = True
            out.append(f"<li>{line.split('.', 1)[1].strip()}</li>")
            continue
        if in_ul:
            out.append("</ul>")
            in_ul = False
        if in_ol:
            out.append("</ol>")
            in_ol = False
        out.append(line)
    if in_ul:
        out.append("</ul>")
    if in_ol:
        out.append("</ol>")
    text = "\n".join(out)

    # Paragraphs: any line that is not already wrapped in a block tag.
    blocks: list[str] = []
    for chunk in re.split(r"\n\s*\n", text):
        c = chunk.strip()
        if not c:
            continue
        if re.match(r"^<(h\d|ul|ol|pre|blockquote|p|img)", c):
            blocks.append(c)
        else:
            blocks.append(f"<p>{c}</p>")
    return "\n".join(blocks)


class WordPressPublisher(BasePublisher):
    platform_name = "wordpress"

    def __init__(self, api_key: str, site_id: str | None = None):
        super().__init__(api_key)
        if not site_id:
            raise ValueError(
                "WordPress.com requires a site_id (numeric blog id)."
            )
        self.site_id = site_id

    async def publish(self, client: httpx.AsyncClient, post) -> PublishResult:
        endpoint = f"{WP_API_BASE}/sites/{self.site_id}/posts/new"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        tags = [t.strip() for t in (post.tags or []) if t.strip()][:8]
        payload: dict = {
            "title": post.title,
            "content": _markdown_to_html(post.markdown_content),
            "status": "publish",
        }
        if tags:
            payload["tags"] = ",".join(tags)
        if post.cover_image_url:
            payload["featured_image"] = post.cover_image_url

        try:
            response = await client.post(
                endpoint, json=payload, headers=headers, timeout=30.0
            )
            if response.status_code in (200, 201):
                data = response.json()
                return PublishResult(
                    success=True, live_url=data.get("URL") or data.get("link")
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