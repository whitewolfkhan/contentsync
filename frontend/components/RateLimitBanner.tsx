"use client";

import { useEffect, useState } from "react";
import { api, PlatformId, PlatformKey } from "@/lib/api";

const PLATFORM_LABEL: Record<PlatformId, string> = {
  devto: "Dev.to",
  wordpress: "WordPress.com",
  notion: "Notion",
  blogger: "Blogger",
};

function formatRemaining(ms: number): string {
  if (ms <= 0) return "resetting…";
  const totalSec = Math.ceil(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const totalMin = Math.ceil(totalSec / 60);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Surfaces a top-of-page warning whenever any of the user's platform keys
 * has crossed its rate limit. Re-checks every 60s and re-renders every 1s
 * so the countdown stays fresh.
 *
 * Returns null when nothing is currently rate-limited.
 */
export default function RateLimitBanner() {
  const [limited, setLimited] = useState<PlatformKey[]>([]);
  const [now, setNow] = useState<number>(() => Date.now());
  const [dismissedFor, setDismissedFor] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const keys = await api.listKeys();
        if (cancelled) return;
        setLimited(keys);
      } catch {
        // Not signed in or backend unreachable — silent.
      }
    }
    load();
    const id = setInterval(load, 60_000);
    const tickId = setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      cancelled = true;
      clearInterval(id);
      clearInterval(tickId);
    };
  }, []);

  if (limited.length === 0) return null;

  const active = limited.filter((k) => {
    if (!k.rate_limited_at) return false;
    if (!k.rate_limit_reset_at) return true; // Limited but unknown reset.
    const reset = new Date(k.rate_limit_reset_at).getTime();
    return reset > now;
  });

  if (active.length === 0) return null;

  const visible = active.filter((k) => dismissedFor[k.platform] !== k.rate_limited_at);

  return (
    <div className="space-y-2 mb-6">
      {visible.map((k) => {
        const remaining = k.rate_limit_reset_at
          ? new Date(k.rate_limit_reset_at).getTime() - now
          : Number.POSITIVE_INFINITY;
        const label = PLATFORM_LABEL[k.platform] ?? k.platform;
        return (
          <div
            key={k.platform}
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900"
          >
            <span className="text-lg leading-none">⚠️</span>
            <div className="flex-1 text-sm">
              <div className="font-medium">
                {label} rate limit hit
              </div>
              <div className="text-amber-800">
                New posts targeting {label} will fail until the limit
                resets in{" "}
                <span className="font-mono font-semibold">
                  {Number.isFinite(remaining)
                    ? formatRemaining(remaining)
                    : "a few minutes"}
                </span>
                . Posts to other platforms are still going through.
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                setDismissedFor((cur) => ({
                  ...cur,
                  [k.platform]: k.rate_limited_at ?? "",
                }))
              }
              className="text-amber-700 hover:text-amber-900 text-sm"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}