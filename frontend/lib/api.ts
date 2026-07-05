// ContentSync API client.
// All requests include the session cookie (credentials: "include") so the
// FastAPI backend can identify the current user.

export type PlatformId = "devto" | "wordpress" | "notion" | "blogger";

export const SUPPORTED_PLATFORMS: { id: PlatformId; label: string }[] = [
  { id: "devto", label: "Dev.to" },
  { id: "wordpress", label: "WordPress.com" },
  { id: "notion", label: "Notion" },
  { id: "blogger", label: "Blogger" },
];

export interface Publication {
  id: number;
  platform: string;
  status: "PENDING" | "PUBLISHED" | "FAILED" | string;
  live_url: string | null;
  error_message: string | null;
  published_at: string | null;
}

export interface Post {
  id: number;
  title: string;
  markdown_content: string;
  cover_image_url: string | null;
  tags: string[];
  publish_at: string;
  status: "SCHEDULED" | "PUBLISHING" | "PUBLISHED" | "FAILED" | string;
  target_platforms: string[];
  created_at: string;
  updated_at: string;
  publications: Publication[];
}

export interface PostSummary {
  id: number;
  title: string;
  publish_at: string;
  status: Post["status"];
  target_platforms: string[];
  created_at: string;
}

export interface CreatePostInput {
  title: string;
  markdown_content: string;
  cover_image_url?: string;
  tags: string[];
  publish_at: string;
  target_platforms: PlatformId[];
}

export interface CurrentUser {
  id: number;
  email: string;
  display_name: string | null;
  created_at: string;
}

export interface PlatformKey {
  platform: PlatformId;
  extra_id: string | null;
  secret_masked: string;
  updated_at: string;
  // Set when the most recent publish to this platform was rate-limited. The
  // `RateLimitBanner` component reads these via GET /api/keys and shows a
  // notification until `rate_limit_reset_at` passes.
  rate_limited_at: string | null;
  rate_limit_reset_at: string | null;
}

export interface PlatformKeyUpsert {
  secret_value: string;
  extra_id?: string;
}

// Backend default is now 8765 because port 8000 is reserved by Windows on this
// dev machine (Hyper-V excluded range) and uvicorn cannot bind it. Override
// per-environment via NEXT_PUBLIC_API_BASE_URL in frontend/.env.local.
// Backend default is now 8765 because port 8000 is reserved by Windows on this
// dev machine (Hyper-V excluded range) and uvicorn cannot bind it. Override
// per-environment via NEXT_PUBLIC_API_BASE_URL in frontend/.env.local.
// API base URL.
//   - In the browser: NEXT_PUBLIC_API_BASE_URL is inlined at build time.
//   - During SSR / server components, `process.env.NEXT_PUBLIC_*` is also
//     available (Vercel inlines the value into the bundle), but we still
//     prefer an explicit server-only env var so deployers don't have to
//     remember to set the public one too.
const API_BASE =
  (typeof window === "undefined" && process.env.API_BASE_URL) ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:8000";

/**
 * Build a Cookie header value from the current server-component request.
 * Browser fetches already have cookies set via `credentials: "include"`,
 * but during SSR `fetch()` runs in a Node context with no cookie jar, so we
 * must pipe the inbound request's cookies through explicitly.
 */
async function buildServerCookieHeader(): Promise<string | undefined> {
  if (typeof window !== "undefined") return undefined;
  try {
    // Lazy import so this module remains usable in plain client builds.
    const { cookies } = await import("next/headers");
    const jar = await cookies();
    const pairs: string[] = [];
    jar.getAll().forEach((c) => pairs.push(`${c.name}=${c.value}`));
    return pairs.length ? pairs.join("; ") : undefined;
  } catch {
    // Not in a request scope (e.g. unit test) — let the fetch proceed
    // without cookies; the caller will handle the resulting 401.
    return undefined;
  }
}

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const cookieHeader = await buildServerCookieHeader();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (cookieHeader) headers["Cookie"] = cookieHeader;

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers,
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json()).detail || (await res.text());
    } catch {
      detail = await res.text().catch(() => "");
    }
    const err: any = new Error(
      typeof detail === "string" && detail ? detail : res.statusText
    );
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

// Notify any mounted UI (e.g. the AuthMenu in the global navbar) that the
// auth cookie has just been written or cleared, so they can re-fetch /me
// instead of showing a stale state.
export const AUTH_EVENT = "contentsync:auth-changed";
function emitAuthChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_EVENT));
  }
}

export const api = {
  // Auth -----------------------------------------------------------
  signup: (email: string, password: string, display_name?: string) =>
    jsonFetch<CurrentUser>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, display_name }),
    }).then((u) => {
      emitAuthChanged();
      return u;
    }),
  login: (email: string, password: string) =>
    jsonFetch<CurrentUser>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }).then((u) => {
      emitAuthChanged();
      return u;
    }),
  logout: () =>
    jsonFetch<void>("/api/auth/logout", { method: "POST" }).then(() => {
      emitAuthChanged();
    }),
  me: () => jsonFetch<CurrentUser>("/api/auth/me"),

  // Returns { message, dev_reset_url? }. The dev_reset_url is only present
  // when email delivery isn't configured (dev convenience).
  forgotPassword: (email: string) =>
    jsonFetch<{ message: string; dev_reset_url?: string }>(
      "/api/auth/forgot-password",
      { method: "POST", body: JSON.stringify({ email }) }
    ),

  // On success, the backend signs the user in and returns the CurrentUser.
  resetPassword: (token: string, new_password: string) =>
    jsonFetch<CurrentUser>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, new_password }),
    }).then((u) => {
      emitAuthChanged();
      return u;
    }),

  // Platform keys --------------------------------------------------
  listKeys: () => jsonFetch<PlatformKey[]>("/api/keys"),
  upsertKey: (platform: PlatformId, body: PlatformKeyUpsert) =>
    jsonFetch<PlatformKey>(`/api/keys/${platform}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteKey: (platform: PlatformId) =>
    jsonFetch<void>(`/api/keys/${platform}`, { method: "DELETE" }),

  // Posts ----------------------------------------------------------
  listPosts: () => jsonFetch<PostSummary[]>("/api/posts"),
  getPost: (id: number) => jsonFetch<Post>(`/api/posts/${id}`),
  createPost: (input: CreatePostInput) =>
    jsonFetch<Post>("/api/posts", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  deletePost: (id: number) =>
    jsonFetch<void>(`/api/posts/${id}`, { method: "DELETE" }),
  publishNow: (id: number) =>
    jsonFetch<Post>(`/api/posts/${id}/publish-now`, { method: "POST" }),
};