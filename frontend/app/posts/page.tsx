import Link from "next/link";
import { api, PostSummary } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function PostsPage() {
  let posts: PostSummary[] = [];
  let loadError: string | null = null;
  try {
    posts = await api.listPosts();
  } catch (e: any) {
    loadError = e.message || "Could not reach the API.";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">All scheduled posts</h2>
        <Link href="/" className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm">
          + New post
        </Link>
      </div>

      {loadError && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-3 text-sm">
          {loadError} — make sure the FastAPI server is reachable at{" "}
          <code className="font-mono">{process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"}</code>.
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
            {posts.length === 0 && !loadError && (
              <tr>
                <td colSpan={5} className="text-center text-gray-500 py-10">
                  No posts yet. Head back home and schedule one.
                </td>
              </tr>
            )}
            {posts.map((p) => (
              <tr key={p.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{p.title}</td>
                <td className="px-4 py-3 text-gray-600">{new Date(p.publish_at).toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-600">{p.target_platforms.join(", ")}</td>
                <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/posts/${p.id}`} className="text-brand-600 hover:text-brand-700 text-sm">
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