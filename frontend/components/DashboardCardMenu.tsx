"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * Mobile-only hamburger that lives in the top-right corner of the dashboard
 * welcome card. It exposes the same two actions that the desktop row shows:
 * "Compose post" → /posts/new and "View profile" → /profile.
 *
 * Tapping outside the menu (or the icon again) closes it. ESC closes it too
 * for keyboard users.
 */
export default function DashboardCardMenu() {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        aria-label={open ? "Close quick actions" : "Open quick actions"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        )}
      </button>

      {open && (
        <>
          {/* Tap-outside overlay closes the menu. */}
          <div
            className="fixed inset-0 z-[60]"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="menu"
            className="fixed right-4 top-[68px] z-[70] w-56 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden"
          >
            <Link
              href="/posts/new"
              onClick={() => setOpen(false)}
              className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
              role="menuitem"
            >
              Compose post
            </Link>
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-t border-gray-100"
              role="menuitem"
            >
              View profile
            </Link>
          </div>
        </>
      )}
    </div>
  );
}