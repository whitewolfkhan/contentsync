"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, AUTH_EVENT, CurrentUser } from "@/lib/api";

export default function AuthMenu() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null | undefined>(undefined);
  const [menuOpen, setMenuOpen] = useState(false);

  // Re-fetch /me whenever login/logout/signup/reset-password flips the cookie
  // on a page where the navbar is already mounted (e.g. /reset-password).
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const me = await api.me();
        if (!cancelled) setUser(me);
      } catch {
        if (!cancelled) setUser(null);
      }
    }
    refresh();
    window.addEventListener(AUTH_EVENT, refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_EVENT, refresh);
    };
  }, []);

  async function logout() {
    await api.logout();
    setUser(null);
    setMenuOpen(false);
    router.push("/login");
    router.refresh();
  }

  if (user === undefined) {
    return <div className="text-sm text-gray-400 w-32 text-right">…</div>;
  }

  if (!user) {
    // Signed-out menu is small enough to stay inline on every viewport.
    return (
      <div className="flex items-center gap-3 text-sm">
        <Link
          href="/login"
          className="text-gray-600 hover:text-gray-900 font-medium"
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg font-medium"
        >
          Sign up
        </Link>
      </div>
    );
  }

  return (
    <div className="relative flex items-center text-sm">
      {/* Desktop / tablet — inline controls. Hidden on phones. */}
      <div className="hidden sm:flex items-center gap-4">
        <Link
          href="/profile"
          className="text-gray-600 hover:text-gray-900 font-medium"
        >
          Profile
        </Link>
        <Link
          href="/settings"
          className="text-gray-600 hover:text-gray-900 font-medium"
        >
          Settings
        </Link>
        <span className="text-gray-500 max-w-[180px] truncate" title={user.email}>
          {user.email}
        </span>
        <button
          type="button"
          onClick={logout}
          className="text-gray-600 hover:text-gray-900 font-medium"
        >
          Sign out
        </button>
      </div>

      {/* Mobile — hamburger button toggles a dropdown. */}
      <button
        type="button"
        aria-label={menuOpen ? "Close account menu" : "Open account menu"}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((o) => !o)}
        className="sm:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-gray-200 bg-white/70 hover:bg-white text-gray-700"
      >
        {menuOpen ? (
          // Close (X) icon
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          // Hamburger icon
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        )}
      </button>

      {menuOpen && (
        <>
          {/* Tap-outside overlay — closes the menu when tapping the page. */}
          <div
            className="fixed inset-0 z-[60] sm:hidden"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div
            role="menu"
            className="fixed right-4 top-[68px] z-[70] sm:hidden w-56 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="text-xs uppercase tracking-wide text-gray-400">
                Signed in as
              </div>
              <div className="text-sm font-medium text-gray-800 truncate" title={user.email}>
                {user.email}
              </div>
            </div>
            <Link
              href="/profile"
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
              role="menuitem"
            >
              Profile
            </Link>
            <Link
              href="/settings"
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
              role="menuitem"
            >
              Settings
            </Link>
            <button
              type="button"
              onClick={logout}
              className="block w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-t border-gray-100"
              role="menuitem"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}