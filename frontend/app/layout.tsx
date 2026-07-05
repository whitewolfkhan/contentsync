import type { Metadata } from "next";
import "./globals.css";
import AuthMenu from "@/components/AuthMenu";
import RateLimitBanner from "@/components/RateLimitBanner";

export const metadata: Metadata = {
  title: "ContentSync",
  description: "Smart multi-platform blog auto-publisher",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-bg min-h-screen flex flex-col">
          {/* Decorative animated blobs sit behind everything and don't capture clicks. */}
          <div aria-hidden="true" className="blob blob-1" />
          <div aria-hidden="true" className="blob blob-2" />
          <div aria-hidden="true" className="blob blob-3" />

          <header className="relative z-10 border-b border-white/40 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-4">
              <a href="/" className="flex items-center gap-3 min-w-0">
                <img
                  src="/logo.png"
                  alt="ContentSync logo"
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover shadow-sm ring-1 ring-black/5"
                />
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl font-semibold leading-none">ContentSync</h1>
                  <p className="text-[11px] sm:text-xs text-gray-500 mt-1 truncate">
                    Multi-platform blog auto-publisher
                  </p>
                </div>
              </a>
              <div className="flex items-center gap-3 sm:gap-6">
                <a
                  href="/posts"
                  className="hidden sm:inline text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  All posts →
                </a>
                <AuthMenu />
              </div>
            </div>
          </header>
          <main className="relative z-10 flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
            <RateLimitBanner />
            {children}
          </main>
          <footer className="relative z-10 text-center text-xs text-gray-400 py-6">
            ContentSync
          </footer>
        </div>
      </body>
    </html>
  );
}
