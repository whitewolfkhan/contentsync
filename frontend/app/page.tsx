import Link from "next/link";
import { redirect } from "next/navigation";

import StatusBadge from "@/components/StatusBadge";
import DashboardCardMenu from "@/components/DashboardCardMenu";
import { api, PlatformId, PostSummary, SUPPORTED_PLATFORMS } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Personal dashboard. Every post listed here is scoped to the signed-in user
 * — `api.listPosts()` filters by `user_id` server-side, so even if the URL is
 * hit directly, no other user's posts leak through.
 */
export default async function DashboardPage() {
  // Bounce unauthenticated visitors to /login with a `next` redirect.
  let user;
  try {
    user = await api.me();
  } catch {
    redirect("/login?next=/");
  }

  let posts: PostSummary[] = [];
  let keys: { platform: PlatformId }[] = [];
  let loadError: string | null = null;
  try {
    [posts, keys] = await Promise.all([api.listPosts(), api.listKeys()]);
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
  const connectedCount = connectedIds.size;

  // Sort posts by publish_at descending so the next-up one is at the top.
  const upcoming = [...posts]
    .sort(
      (a, b) =>
        new Date(b.publish_at).getTime() - new Date(a.publish_at).getTime()
    )
    .slice(0, 8);

  const greetingName = user.display_name || user.email.split("@")[0];

  return (
    <div className="space-y-8">
      {/* Greeting + quick actions */}
      <section className="bg-white rounded-xl border p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold">
              Welcome back, {greetingName}.
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {totalPosts === 0
                ? "You haven't written any posts yet — start by composing one."
                : `You have ${scheduledPosts} scheduled, ${publishedPosts} published, and ${failedPosts} failed.`}
            </p>
          </div>
          {/* Mobile-only hamburger; hidden from sm: upward. */}
          <div className="sm:hidden shrink-0">
            <DashboardCardMenu />
          </div>
        </div>
        {/* Desktop / tablet — inline buttons. Hidden on phones. */}
        <div className="hidden sm:flex flex-wrap gap-2 mt-4">
          <Link
            href="/posts/new"
            className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
          >
            Compose post
          </Link>
          <Link
            href="/profile"
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            View profile
          </Link>
        </div>
      </section>

      {loadError && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-3 text-sm">
          {loadError}
        </div>
      )}

      {/* Workspace stats */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total posts" value={totalPosts} />
        <StatCard label="Published" value={publishedPosts} accent="emerald" />
        <StatCard label="Scheduled" value={scheduledPosts} accent="amber" />
        <StatCard label="Failed" value={failedPosts} accent="rose" />
      </section>

      {/* Two-column body: recent posts + platforms snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Posts table — user-scoped */}
        <section className="bg-white rounded-xl border p-6 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your posts</h2>
            <Link
              href="/posts"
              className="text-sm text-brand-600 hover:text-brand-700 font-medium"
            >
              See all →
            </Link>
          </div>
          {posts.length === 0 ? (
            <div className="text-sm text-gray-500 py-8 text-center">
              No posts yet.{" "}
              <Link href="/posts/new" className="text-brand-600 hover:underline">
                Compose your first one
              </Link>
              .
            </div>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm">
                <thead className="text-gray-500">
                  <tr>
                    <th className="text-left py-2 px-2 font-medium">Title</th>
                    <th className="text-left py-2 px-2 font-medium">Targets</th>
                    <th className="text-left py-2 px-2 font-medium">Publish at</th>
                    <th className="text-left py-2 px-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="py-2 px-2 max-w-xs">
                        <Link
                          href={`/posts/${p.id}`}
                          className="font-medium hover:underline truncate block"
                        >
                          {p.title}
                        </Link>
                      </td>
                      <td className="py-2 px-2 text-gray-600">
                        {p.target_platforms.join(", ")}
                      </td>
                      <td className="py-2 px-2 text-gray-500">
                        {new Date(p.publish_at).toLocaleString()}
                      </td>
                      <td className="py-2 px-2">
                        <StatusBadge status={p.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Platforms snapshot */}
        <section className="bg-white rounded-xl border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Platforms</h2>
            <Link
              href="/settings"
              className="text-sm text-brand-600 hover:text-brand-700 font-medium"
            >
              Manage →
            </Link>
          </div>
          <p className="text-xs text-gray-500">
            {connectedCount} of {SUPPORTED_PLATFORMS.length} platforms connected.
          </p>
          <ul className="space-y-2">
            {SUPPORTED_PLATFORMS.map(({ id, label }) => {
              const connected = connectedIds.has(id);
              return (
                <li
                  key={id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2"
                >
                  <span className="font-medium text-sm">{label}</span>
                  {connected ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Connected
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 border">
                      Not configured
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
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
