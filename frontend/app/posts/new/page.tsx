import { redirect } from "next/navigation";

import PostComposer from "@/components/PostComposer";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Dedicated compose page. Bounces unauthenticated visitors to /login and
 * then back here via `next` so the form is the destination, not the root.
 */
export default async function NewPostPage() {
  try {
    await api.me();
  } catch {
    redirect("/login?next=/posts/new");
  }

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