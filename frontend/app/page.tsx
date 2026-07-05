import DashboardView from "@/components/DashboardView";

export const dynamic = "force-dynamic";

/**
 * / (dashboard) is intentionally a thin shell that hands off to a client
 * component. Same reason as /posts and /profile: the session cookie is set on
 * the FastAPI origin, so only browser-issued requests automatically attach it
 * to outgoing fetches.
 */
export default function DashboardPage() {
  return <DashboardView />;
}