"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import AuthShell from "@/components/AuthShell";
import { api } from "@/lib/api";

function ResetPasswordForm() {
  const router = useRouter();
  const search = useSearchParams();
  const token = search.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-2xl">
          ⚠️
        </div>
        <p className="text-sm text-gray-600">
          This page is missing a reset token. Open the link from your email or
          request a new one.
        </p>
        <Link
          href="/forgot-password"
          className="inline-block text-sm text-brand-600 hover:underline font-medium"
        >
          Request a new reset link
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      return setError("Password must be at least 8 characters.");
    }
    if (password !== confirm) {
      return setError("Passwords do not match.");
    }
    setSubmitting(true);
    try {
      await api.resetPassword(token, password);
      // Backend signs the user in automatically; redirect to settings.
      router.push("/settings");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Reset failed. Please request a new link.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">New password</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            placeholder="At least 8 characters"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Confirm new password</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="input"
            placeholder="Re-enter your new password"
          />
        </label>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white px-4 py-2.5 rounded-lg font-medium shadow-sm transition"
        >
          {submitting && (
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          )}
          {submitting ? "Updating password…" : "Update password"}
        </button>
      </form>

      <p className="text-sm text-gray-500 text-center pt-2">
        Link expired or wrong email?{" "}
        <Link
          href="/forgot-password"
          className="text-brand-600 hover:underline font-medium"
        >
          Request a new one
        </Link>
      </p>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose something at least 8 characters long."
    >
      <Suspense
        fallback={
          <p className="text-sm text-gray-500 text-center py-6">Loading…</p>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}