import ProfileView from "@/components/ProfileView";

export const dynamic = "force-dynamic";

/**
 * /profile is intentionally a thin shell that hands off to a client component.
 * Same reason as /posts: the session cookie is set on the FastAPI origin, so
 * only browser-issued requests automatically attach it to outgoing fetches.
 */
export default function ProfilePage() {
  return <ProfileView />;
}