"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  api,
  CreatePostInput,
  PlatformId,
  SUPPORTED_PLATFORMS,
} from "@/lib/api";

// Markdown editor is client-only.
const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

function defaultPublishAt(): string {
  const d = new Date(Date.now() + 5 * 60_000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export default function PostComposer() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState(
    "# A great new post\n\nWrite something amazing..."
  );
  const [coverImage, setCoverImage] = useState("");
  const [tags, setTags] = useState("");
  const [publishAt, setPublishAt] = useState(defaultPublishAt());
  const [platforms, setPlatforms] = useState<PlatformId[]>(["devto"]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auth gate + which platforms have credentials configured.
  const [authChecked, setAuthChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [readyPlatforms, setReadyPlatforms] = useState<PlatformId[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api.me();
        if (!cancelled) setSignedIn(true);
        const keys = await api.listKeys();
        if (!cancelled) setReadyPlatforms(keys.map((k) => k.platform));
      } catch {
        if (!cancelled) setSignedIn(false);
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function togglePlatform(p: PlatformId) {
    setPlatforms((cur) =>
      cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) return setError("Title is required.");
    if (!markdown.trim()) return setError("Content is required.");
    if (!platforms.length) return setError("Pick at least one platform.");
    if (!publishAt) return setError("Pick a publish time.");

    const missing = platforms.filter((p) => !readyPlatforms.includes(p));
    if (missing.length) {
      return setError(
        `Missing credentials for: ${missing.join(
          ", "
        )}. Add them in Settings first.`
      );
    }

    const payload: CreatePostInput = {
      title: title.trim(),
      markdown_content: markdown,
      cover_image_url: coverImage.trim() || undefined,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      publish_at: new Date(publishAt).toISOString(),
      target_platforms: platforms,
    };

    setSubmitting(true);
    try {
      const created = await api.createPost(payload);
      router.push(`/posts/${created.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to schedule post");
    } finally {
      setSubmitting(false);
    }
  }

  if (!authChecked) {
    return (
      <div className="bg-white rounded-xl border p-6 text-sm text-gray-500">
        Loading…
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="bg-white rounded-xl border p-6 space-y-3">
        <h3 className="text-lg font-semibold">Sign in to compose</h3>
        <p className="text-sm text-gray-600">
          ContentSync now requires an account. Sign up once, add your platform
          API keys in Settings, and you can start scheduling posts.
        </p>
        <div className="flex gap-3">
          <Link
            href="/signup"
            className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Create account
          </Link>
          <Link
            href="/login"
            className="border px-4 py-2 rounded-lg text-sm font-medium"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="My next big post"
            className="mt-1 w-full rounded-lg border px-3 py-2 text-lg"
            required
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Cover image URL (optional)</span>
          <input
            value={coverImage}
            onChange={(e) => setCoverImage(e.target.value)}
            placeholder="https://..."
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Tags (comma separated)</span>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="python, fastapi, devops"
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
        </label>
      </div>

      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">Content</span>
          <span className="text-xs text-gray-400">Markdown</span>
        </div>
        <div className="md-editor-wrapper">
          <MDEditor value={markdown} onChange={(v) => setMarkdown(v || "")} height={420} />
        </div>
      </div>

      <div className="bg-white rounded-xl border p-6 grid md:grid-cols-2 gap-6">
        <div>
          <span className="text-sm font-medium block mb-2">
            Target platforms
          </span>
          <div className="flex flex-wrap gap-2">
            {SUPPORTED_PLATFORMS.map((p) => {
              const hasKey = readyPlatforms.includes(p.id);
              return (
                <label
                  key={p.id}
                  className={`cursor-pointer select-none px-3 py-2 rounded-lg border text-sm ${
                    platforms.includes(p.id)
                      ? "bg-brand-50 border-brand-500 text-brand-700"
                      : "bg-white text-gray-600"
                  }`}
                  title={hasKey ? "Credentials configured" : "Add API key in Settings"}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={platforms.includes(p.id)}
                    onChange={() => togglePlatform(p.id)}
                  />
                  {p.label}
                  {!hasKey && (
                    <span className="ml-1 text-[10px] text-amber-600">
                      (no key)
                    </span>
                  )}
                </label>
              );
            })}
          </div>
          {readyPlatforms.length === 0 && (
            <p className="text-xs text-amber-600 mt-2">
              No platform keys yet.{" "}
              <Link href="/settings" className="underline">
                Add them in Settings
              </Link>{" "}
              before scheduling.
            </p>
          )}
        </div>
        <label className="block">
          <span className="text-sm font-medium">Publish at</span>
          <input
            type="datetime-local"
            value={publishAt}
            onChange={(e) => setPublishAt(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
          <span className="text-xs text-gray-400 mt-1 block">
            APScheduler polls every minute and fires the moment the clock hits
            this time.
          </span>
        </label>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white px-6 py-2 rounded-lg font-medium"
        >
          {submitting ? "Scheduling…" : "Schedule post"}
        </button>
      </div>
    </form>
  );
}