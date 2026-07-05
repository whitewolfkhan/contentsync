import Link from "next/link";
import { notFound } from "next/navigation";
import { api, Post } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import PostActions from "@/components/PostActions";

export const dynamic = "force-dynamic";

export default async function PostDetail({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();

  let post: Post | null = null;
  let loadError: string | null = null;
  try {
    post = await api.getPost(id);
  } catch (e: any) {
    loadError = e.message || "Failed to load post.";
  }

  if (!post) {
    return (
      <div className="space-y-4">
        <Link href="/posts" className="text-sm text-brand-600">← All posts</Link>
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-3 text-sm">
          {loadError}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/posts" className="text-sm text-brand-600">← All posts</Link>
        <PostActions id={post.id} />
      </div>

      <div className="bg-white rounded-xl border p-6 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">{post.title}</h2>
            <p className="text-sm text-gray-500 mt-1">
              Publish at <span className="font-medium">{new Date(post.publish_at).toLocaleString()}</span> ·{" "}
              Targets: <span className="font-medium">{post.target_platforms.join(", ")}</span>
            </p>
          </div>
          <StatusBadge status={post.status} />
        </div>

        {post.cover_image_url && (
          <img src={post.cover_image_url} alt="" className="rounded-lg max-h-64 object-cover" />
        )}

        <pre className="whitespace-pre-wrap text-sm bg-gray-50 rounded-lg p-4 border max-h-96 overflow-auto">
{post.markdown_content}
        </pre>
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h3 className="text-lg font-semibold mb-3">Platform results</h3>
        {post.publications.length === 0 ? (
          <p className="text-sm text-gray-500">
            No platforms have reported back yet. The scheduler will dispatch this post at the scheduled time.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-gray-500">
              <tr>
                <th className="text-left py-2">Platform</th>
                <th className="text-left py-2">Status</th>
                <th className="text-left py-2">Live URL</th>
                <th className="text-left py-2">Published</th>
                <th className="text-left py-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {post.publications.map((pub) => (
                <tr key={pub.id} className="border-t">
                  <td className="py-2 font-medium">{pub.platform}</td>
                  <td className="py-2"><StatusBadge status={pub.status} /></td>
                  <td className="py-2">
                    {pub.live_url ? (
                      <a className="text-brand-600 hover:underline" href={pub.live_url} target="_blank" rel="noreferrer">
                        open
                      </a>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-2 text-gray-500">
                    {pub.published_at ? new Date(pub.published_at).toLocaleString() : "—"}
                  </td>
                  <td className="py-2 text-red-600 max-w-xs truncate" title={pub.error_message || ""}>
                    {pub.error_message || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}