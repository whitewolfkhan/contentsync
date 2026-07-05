"use client";

import Link from "next/link";
import { useState } from "react";
import AuthShell from "@/components/AuthShell";
import { api } from "@/lib/api";

type Status =
  | { kind: "idle" }
  | { kind: "sent"; message: string; devResetUrl?: string }
  | { kind: "error"; message: string };

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    try {
      const res = await api.forgotPassword(email.trim().toLowerCase());
      setStatus({
        kind: "sent",
        message:
          res.message ||
          "If an account exists for that email, a reset link has been sent.",
        devResetUrl: res.dev_reset_url,
      });
    } catch (err: any) {
      setStatus({
        kind: "error",
        message: err?.message || "Something went wrong. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (status.kind === "sent") {
    return (
      <AuthShell
        title="Check your inbox"
        subtitle="If we found an account for that address, we just sent a reset link."
      >
        <div className="space-y-4 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-2xl">
            ✉️
          </div>
          <p className="text-sm text-gray-600">{status.message}</p>
          <p className="text-xs text-gray-400">
            The link expires in 30 minutes. You can close this tab once you've
            set a new password.
          </p>

          {status.devResetUrl && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-3 text-xs text-left break-all">
              <p className="font-semibold mb-1">Dev mode</p>
              <p>
                Email isn't wired up yet, so here's the reset link directly:
              </p>
              <a
                href={status.devResetUrl}
                className="text-brand-600 hover:underline mt-1 inline-block"
              >
                Open reset link →
              </a>
            </div>
          )}

          <Link
            href="/login"
            className="inline-block text-sm text-brand-600 hover:underline font-medium"
          >
            ← Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter your account email and we'll send you a reset link."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Email</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="you@example.com"
          />
        </label>

        {status.kind === "error" && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
            {status.message}
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
          {submitting ? "Sending link…" : "Send reset link"}
        </button>
      </form>

      <p className="text-sm text-gray-500 text-center pt-2">
        Remembered it?{" "}
        <Link href="/login" className="text-brand-600 hover:underline font-medium">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}