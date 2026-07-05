import Link from "next/link";
import { redirect } from "next/navigation";

import StatusBadge from "@/components/StatusBadge";
import {
  api,
  PlatformId,
  PlatformKey,
  PostSummary,
  SUPPORTED_PLATFORMS,
} from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Platform redirect URLs. Each opens the user's connected dashboard on the
 * platform itself (e.g. Dev.to's "My Posts" page). If we don't know a
 * platform's dashboard URL, fall back to its root so the user can still
 * navigate from there.
 */
const PLATFORM_HOME: Record<PlatformId, { dashboard: string; label: string }> = {
  devto: {
    dashboard: "https://dev.to/dashboard",
    label: "Dev.to dashboard",
  },
  wordpress: {
    dashboard: "https://wordpress.com/posts",
    label: "WordPress.com posts",
  },
  notion: {
    dashboard: "https://www.notion.so",
    label: "Notion workspace",
  },
  blogger: {
    dashboard: "https://www.blogger.com",
    label: "Blogger dashboard",
  },
};

function initialsFor(name: string | null, email: string): string {
  const source = (name && name.trim()) || email || "?";
  const parts = source.split(/\s+|@/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default async function ProfilePage() {
  // Server component — read /me on the server. If unauthenticated, push to
  // /login with a `next` redirect so the user lands back here after sign in.
  let user;
  try {
    user = await api.me();
  } catch {
    redirect("/login?next=/profile");
  }

  // Pull the connected keys + recent posts in parallel for the cards below.
  let keys: PlatformKey[] = [];
  let posts: PostSummary[] = [];
  let loadError: string | null = null;
  try {
    [keys, posts] = await Promise.all([api.listKeys(), api.listPosts()]);
  } catch (e: any) {
    loadError = e?.message || "Could not load your workspace.";
  }

  const connectedIds = new Set(keys.map((k) => k.platform));
  const totalPosts = posts.length;
  const publishedPosts = posts.filter((p) => p.status === "PUBLISHED").length;
  const failedPosts = posts.filter((p) => p.status === "FAILED").length;
  const scheduledPosts = posts.filter(
    (p) => p.status === "SCHEDULED" || p.status === "PUBLISHING"
  ).length;

  return (
    <div className="space-y-8">
      {/* Profile header */}
      <section className="bg-white rounded-xl border p-6 flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-brand-600 text-white text-xl font-semibold flex items-center justify-center shrink-0">
          {initialsFor(user.display_name, user.email)}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold truncate">
            {user.display_name || user.email}
          </h1>
          <p className="text-sm text-gray-500 truncate">{user.email}</p>
          <p className="text-xs text-gray-400 mt-1">
            Member since {new Date(user.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/settings"
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Settings
          </Link>
          <Link
            href="/posts/new"
            className="px-3 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
          >
            New post
          </Link>
        </div>
      </section>

      {/* Workspace stats */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total posts" value={totalPosts} />
        <StatCard label="Published" value={publishedPosts} accent="emerald" />
        <StatCard label="Scheduled" value={scheduledPosts} accent="amber" />
        <StatCard label="Failed" value={failedPosts} accent="rose" />
      </section>

      {loadError && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-3 text-sm">
          Couldn't load your workspace ({loadError}). Try{" "}
          <Link href="/login?next=/profile" className="underline font-medium">
            signing in again
          </Link>
          .
        </div>
      )}

      {/* Platforms: redirect to each connected platform's dashboard */}
      <section className="bg-white rounded-xl border p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Your platforms</h2>
          <Link
            href="/settings"
            className="text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            Manage keys →
          </Link>
        </div>
        <p className="text-sm text-gray-500">
          Jump straight to the dashboard for each platform you've connected.
          Unconfigured platforms are dimmed until you add a key in Settings.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SUPPORTED_PLATFORMS.map(({ id, label }) => {
            const connected = connectedIds.has(id);
            const home = PLATFORM_HOME[id];
            return (
              <div
                key={id}
                className={`rounded-lg border p-4 flex items-center justify-between gap-3 ${
                  connected
                    ? "bg-white"
                    : "bg-gray-50 border-dashed"
                }`}
              >
                <div className="min-w-0">
                  <div className="font-medium flex items-center gap-2">
                    {label}
                    {connected ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Connected
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 border">
                        Not configured
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 truncate">{home.label}</div>
                </div>
                {connected ? (
                  <a
                    href={home.dashboard}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
                  >
                    Open
                  </a>
                ) : (
                  <Link
                    href="/settings"
                    className="shrink-0 px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-100"
                  >
                    Connect
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Recent posts authored by this user */}
      <section className="bg-white rounded-xl border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Your recent posts</h2>
          <Link
            href="/posts"
            className="text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            See all →
          </Link>
        </div>
        {posts.length === 0 ? (
          <div className="text-sm text-gray-500 py-6 text-center">
            You haven't written any posts yet.{" "}
            <Link href="/posts/new" className="text-brand-600 hover:underline">
              Compose your first one
            </Link>
            .
          </div>
        ) : (
          <ul className="divide-y">
            {posts.slice(0, 5).map((p) => (
              <li key={p.id} className="py-3 flex items-center justify-between gap-3">
                <Link
                  href={`/posts/${p.id}`}
                  className="flex-1 min-w-0 hover:underline"
                >
                  <div className="font-medium truncate">{p.title}</div>
                  <div className="text-xs text-gray-500">
                    Publish at {new Date(p.publish_at).toLocaleString()} ·{" "}
                    {p.target_platforms.join(", ")}
                  </div>
                </Link>
                <StatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent = "default",
}: {
  label: string;
  value: number;
  accent?: "default" | "emerald" | "amber" | "rose";
}) {
  const accents: Record<string, string> = {
    default: "bg-white",
    emerald: "bg-emerald-50 border-emerald-100",
    amber: "bg-amber-50 border-amber-100",
    rose: "bg-rose-50 border-rose-100",
  };
  return (
    <div className={`rounded-xl border p-4 ${accents[accent]}`}>
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}