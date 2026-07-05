// Shared layout for auth-style pages (login, signup, forgot-password,
// reset-password). Provides the logo header, glassmorphism card, and the
// "back to home" link so each page only has to provide its own form.
import Link from "next/link";
import { ReactNode } from "react";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: AuthShellProps) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center py-6 sm:py-10">
      <div className="w-full max-w-md fade-in">
        <div className="flex flex-col items-center mb-6">
          <Link href="/" className="group inline-flex flex-col items-center gap-2">
            <img
              src="/logo.png"
              alt="ContentSync logo"
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover shadow-md ring-1 ring-black/5 transition group-hover:scale-105"
            />
            <span className="text-sm font-semibold tracking-wide text-gray-700">
              ContentSync
            </span>
          </Link>
        </div>

        <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-5">
          <header className="space-y-1 text-center">
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">
              {title}
            </h2>
            <p className="text-sm text-gray-500">{subtitle}</p>
          </header>
          {children}
        </div>

        {footer && (
          <p className="text-sm text-gray-500 text-center mt-4">{footer}</p>
        )}
      </div>
    </div>
  );
}