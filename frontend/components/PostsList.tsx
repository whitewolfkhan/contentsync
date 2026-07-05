"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import StatusBadge from "@/components/StatusBadge";
import { api, PostSummary } from "@/lib/api";

/**
 * Client-side list of every post the signed-in user has scheduled. We render
 * this from the browser (not as a Server Component) so that the session cookie
 * set by the FastAPI backend on its own origin is automatically attached to
 * each request — `credentials: "include"` in api.ts handles that. A server
 * component would have to forward cookies manually, and since the cookie lives
 * on `contentsync-api.onrender.com` (not on the Vercel origin), server-side
 * forwarding can't see it.
 */
export default function PostsList() {
  const [posts, setPosts] = useState<PostSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.listPosts();
        if (!cancelled) setPosts(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Could not reach the API.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">All scheduled posts</h2>
        <Link
          href="/posts/new"
          className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm"
        >
          + New post
        </Link>
      </div>

      {error && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-3 text-sm">
          Couldn't load your posts ({error}). If you're signed in elsewhere,{" "}
          <Link href="/login?next=/posts" className="underline font-medium">
            sign in here
          </Link>
          .
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-4 py-3">Title</th>
              <th className="text-left px-4 py-3">Publish at</th>
              <th className="text-left px-4 py-3">Targets</th>
              <th className="text-left px-4 py-3">Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {posts === null && !error && (
              <tr>
                <td colSpan={5} className="text-center text-gray-500 py-10">
                  Loading…
                </td>
              </tr>
            )}
            {posts && posts.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-gray-500 py-10">
                  No posts yet. Head back home and schedule one.
                </td>
              </tr>
            )}
            {posts?.map((p) => (
              <tr key={p.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{p.title}</td>
                <td className="px-4 py-3 text-gray-600">
                  {new Date(p.publish_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {p.target_platforms.join(", ")}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={p.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/posts/${p.id}`}
                    className="text-brand-600 hover:text-brand-700 text-sm"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}