import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import TravelMateLanding from "@/components/features/home/TravelMateLanding";

export default async function Home() {
  const session = (await cookies()).get('travelmate_session');
  if (session?.value) {
    let dashboardPath: string | null = null;
    try {
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
      const response = await fetch(new URL('/api/auth', backendUrl), {
        headers: { cookie: `travelmate_session=${session.value}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(2_000),
      });
      if (response.ok) {
        const payload = await response.json() as { user?: { role?: string } };
        dashboardPath = payload.user?.role === 'admin'
          ? '/admin/dashboard'
          : payload.user?.role === 'owner'
            ? '/owner/dashboard'
            : payload.user?.role === 'traveler'
              ? '/dashboard'
              : null;
      }
    } catch {
      dashboardPath = null;
    }
    if (dashboardPath) redirect(dashboardPath);
  }

  return <TravelMateLanding />;
}
