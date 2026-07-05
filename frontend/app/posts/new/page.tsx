import PostComposer from "@/components/PostComposer";

export const dynamic = "force-dynamic";

/**
 * /posts/new is a thin shell that just renders the composer. The composer is
 * already a client component and does its own auth gate (it calls api.me() in
 * useEffect and redirects to /login?next=/posts/new when the cookie is gone).
 *
 * We must NOT call api.me() in this server component: the FastAPI session
 * cookie lives on contentsync-api.onrender.com (not on the Vercel origin), so
 * an SSR fetch always looks unauthenticated and would bounce the user back to
 * /login even when they're signed in.
 */
export default function NewPostPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Compose & schedule</h1>
        <p className="text-sm text-gray-500 mt-1">
          Write your post in Markdown, pick the platforms, and choose a publish
          time. ContentSync will publish to every selected platform at the
          scheduled moment.
        </p>
      </div>
      <PostComposer />
    </div>
  );
}