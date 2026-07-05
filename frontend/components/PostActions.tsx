"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function PostActions({ id }: { id: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function publishNow() {
    if (!confirm("Publish this post to all selected platforms immediately?")) return;
    setBusy("publish");
    try {
      await api.publishNow(id);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function deletePost() {
    if (!confirm("Delete this scheduled post?")) return;
    setBusy("delete");
    try {
      await api.deletePost(id);
      router.push("/posts");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={publishNow}
        disabled={busy !== null}
        className="px-3 py-1.5 rounded-lg border text-sm hover:bg-gray-50 disabled:opacity-50"
      >
        {busy === "publish" ? "Publishing…" : "Publish now"}
      </button>
      <button
        onClick={deletePost}
        disabled={busy !== null}
        className="px-3 py-1.5 rounded-lg border text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {busy === "delete" ? "Deleting…" : "Delete"}
      </button>
    </div>
  );
}