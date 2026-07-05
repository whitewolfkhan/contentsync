"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthShell from "@/components/AuthShell";
import { api } from "@/lib/api";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email) return setError("Email is required.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");

    setSubmitting(true);
    try {
      await api.signup(
        email.trim().toLowerCase(),
        password,
        displayName.trim() || undefined
      );
      router.push("/settings");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to create account");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="One account, all your blog credentials. Stored encrypted."
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
        <label className="block">
          <span className="text-sm font-medium text-gray-700">
            Display name <span className="text-gray-400">(optional)</span>
          </span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="input"
            placeholder="Jane Doe"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Password</span>
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
          <span className="text-sm font-medium text-gray-700">Confirm password</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="input"
            placeholder="Re-enter your password"
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
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="text-sm text-gray-500 text-center pt-2">
        Already registered?{" "}
        <Link href="/login" className="text-brand-600 hover:underline font-medium">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}