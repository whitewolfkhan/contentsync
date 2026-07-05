"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  api,
  CurrentUser,
  PlatformId,
  PlatformKey,
  SUPPORTED_PLATFORMS,
} from "@/lib/api";

const PLATFORM_HELP: Record<
  PlatformId,
  { secretLabel: string; extraLabel: string; extraHelp: string; help: string }
> = {
  devto: {
    secretLabel: "Dev.to API key",
    extraLabel: "",
    extraHelp: "",
    help: "Get yours from dev.to/settings/extensions → Community API keys.",
  },
  wordpress: {
    secretLabel: "WordPress.com access token",
    extraLabel: "Site ID",
    extraHelp:
      "Find your numeric site ID under wp-admin → Settings → Writing or via the WP API.",
    help: "Create at developer.wordpress.com → Apps → Manage API tokens.",
  },
  notion: {
    secretLabel: "Notion integration secret",
    extraLabel: "Parent page ID",
    extraHelp:
      "Open the parent page in Notion → Share → copy the link; the ID is the 32-char segment.",
    help: "Create an integration at notion.so/my-integrations and share the parent page with it.",
  },
  blogger: {
    secretLabel: "Blogger OAuth access token",
    extraLabel: "Blog ID",
    extraHelp:
      "Open Blogger → Settings → look at the URL: blogID.blogspot.com — the leading number is the blog ID.",
    help: "Generate via Google OAuth playground with Blogger API v3 scope.",
  },
};

export default function SettingsPage() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [keys, setKeys] = useState<Record<PlatformId, PlatformKey | undefined>>({
    devto: undefined,
    wordpress: undefined,
    notion: undefined,
    blogger: undefined,
  });

  // Per-platform edit state. We keep the in-progress secret separate so we
  // never display the typed value back to the user.
  const [drafts, setDrafts] = useState<
    Record<PlatformId, { secret: string; extra: string }>
  >({
    devto: { secret: "", extra: "" },
    wordpress: { secret: "", extra: "" },
    notion: { secret: "", extra: "" },
    blogger: { secret: "", extra: "" },
  });
  const [saving, setSaving] = useState<PlatformId | null>(null);
  const [feedback, setFeedback] = useState<
    Record<PlatformId, { ok: string | null; err: string | null }>
  >({
    devto: { ok: null, err: null },
    wordpress: { ok: null, err: null },
    notion: { ok: null, err: null },
    blogger: { ok: null, err: null },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api.me();
        if (!cancelled) setUser(me);
        const k = await api.listKeys();
        if (!cancelled) {
          const next: typeof keys = {
            devto: undefined,
            wordpress: undefined,
            notion: undefined,
            blogger: undefined,
          };
          for (const key of k) next[key.platform] = key;
          setKeys(next);
          // Pre-fill extra_id where present so the user just has to type a new
          // secret and click save.
          setDrafts((cur) => {
            const updated = { ...cur };
            for (const key of k) {
              updated[key.platform] = {
                secret: "",
                extra: key.extra_id ?? "",
              };
            }
            return updated;
          });
        }
      } catch {
        if (!cancelled) {
          router.replace("/login?next=/settings");
        }
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function save(platform: PlatformId) {
    const { secret, extra } = drafts[platform];
    setSaving(platform);
    setFeedback((cur) => ({ ...cur, [platform]: { ok: null, err: null } }));
    try {
      if (!secret.trim()) {
        throw new Error("Secret is required.");
      }
      const help = PLATFORM_HELP[platform];
      if (help.extraLabel && !extra.trim()) {
        throw new Error(`${help.extraLabel} is required.`);
      }
      const saved = await api.upsertKey(platform, {
        secret_value: secret.trim(),
        extra_id: help.extraLabel ? extra.trim() : undefined,
      });
      setKeys((cur) => ({ ...cur, [platform]: saved }));
      setDrafts((cur) => ({
        ...cur,
        [platform]: { secret: "", extra: saved.extra_id ?? "" },
      }));
      setFeedback((cur) => ({
        ...cur,
        [platform]: { ok: "Saved.", err: null },
      }));
    } catch (err: any) {
      setFeedback((cur) => ({
        ...cur,
        [platform]: { ok: null, err: err.message || "Failed to save" },
      }));
    } finally {
      setSaving(null);
    }
  }

  async function remove(platform: PlatformId) {
    if (!confirm(`Remove ${platform} credentials?`)) return;
    setSaving(platform);
    try {
      await api.deleteKey(platform);
      setKeys((cur) => ({ ...cur, [platform]: undefined }));
      setDrafts((cur) => ({ ...cur, [platform]: { secret: "", extra: "" } }));
      setFeedback((cur) => ({
        ...cur,
        [platform]: { ok: "Removed.", err: null },
      }));
    } catch (err: any) {
      setFeedback((cur) => ({
        ...cur,
        [platform]: { ok: null, err: err.message || "Failed to remove" },
      }));
    } finally {
      setSaving(null);
    }
  }

  if (!authChecked) {
    return (
      <div className="bg-white rounded-xl border p-6 text-sm text-gray-500">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="bg-white rounded-xl border p-6 text-sm">
        Please{" "}
        <Link href="/login?next=/settings" className="text-brand-600 underline">
          sign in
        </Link>{" "}
        to manage settings.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Settings</h2>
        <p className="text-sm text-gray-500 mt-1">
          Signed in as <span className="font-medium">{user.email}</span>. Secrets
          are Fernet-encrypted before they land in the database.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {SUPPORTED_PLATFORMS.map(({ id, label }) => {
          const help = PLATFORM_HELP[id];
          const existing = keys[id];
          const draft = drafts[id];
          const fb = feedback[id];
          return (
            <div key={id} className="bg-white rounded-xl border p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{label}</h3>
                <div className="flex items-center gap-2">
                  {existing?.rate_limited_at &&
                    (!existing.rate_limit_reset_at ||
                      new Date(existing.rate_limit_reset_at).getTime() >
                        Date.now()) && (
                      <span
                        className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200"
                        title={
                          existing.rate_limit_reset_at
                            ? `Resets at ${new Date(
                                existing.rate_limit_reset_at
                              ).toLocaleString()}`
                            : "Rate limited — reset time unknown"
                        }
                      >
                        Rate limited
                      </span>
                    )}
                  {existing ? (
                    <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Connected
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-50 text-gray-500 border">
                      Not configured
                    </span>
                  )}
                </div>
              </div>

              {existing && (
                <p className="text-xs text-gray-500">
                  Stored secret: <code>{existing.secret_masked}</code>
                  {help.extraLabel && existing.extra_id && (
                    <>
                      {" · "}
                      {help.extraLabel}: <code>{existing.extra_id}</code>
                    </>
                  )}
                </p>
              )}

              <label className="block">
                <span className="text-sm font-medium">{help.secretLabel}</span>
                <input
                  type="password"
                  value={draft.secret}
                  onChange={(e) =>
                    setDrafts((cur) => ({
                      ...cur,
                      [id]: { ...cur[id], secret: e.target.value },
                    }))
                  }
                  placeholder={
                    existing ? "Enter new value to replace" : "Paste here"
                  }
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </label>

              {help.extraLabel && (
                <label className="block">
                  <span className="text-sm font-medium">{help.extraLabel}</span>
                  <input
                    value={draft.extra}
                    onChange={(e) =>
                      setDrafts((cur) => ({
                        ...cur,
                        [id]: { ...cur[id], extra: e.target.value },
                      }))
                    }
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                  />
                  <span className="text-xs text-gray-400 mt-1 block">
                    {help.extraHelp}
                  </span>
                </label>
              )}

              <p className="text-xs text-gray-400">{help.help}</p>

              {fb.err && (
                <div className="text-sm text-red-600">{fb.err}</div>
              )}
              {fb.ok && (
                <div className="text-sm text-emerald-600">{fb.ok}</div>
              )}

              <div className="flex justify-between">
                {existing ? (
                  <button
                    type="button"
                    onClick={() => remove(id)}
                    disabled={saving === id}
                    className="text-sm text-red-600 hover:text-red-700 disabled:opacity-60"
                  >
                    Remove
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={() => save(id)}
                  disabled={saving === id}
                  className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  {saving === id
                    ? "Saving…"
                    : existing
                    ? "Replace"
                    : "Save"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}