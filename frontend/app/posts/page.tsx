import PostsList from "@/components/PostsList";

export const dynamic = "force-dynamic";

/**
 * /posts is intentionally a thin shell that hands off to a client component.
 * The session cookie is set on the FastAPI backend's origin
 * (contentsync-api.onrender.com), so only browser-issued requests pick it up
 * automatically. A Server Component would always appear unauthenticated.
 */
export default function PostsPage() {
  return <PostsList />;
}