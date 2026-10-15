import TravelerDashboard from "@/components/features/traveler/TravelerDashboard";
import { redirect } from 'next/navigation';
import { firstQueryValue, legacyNavigationRedirect } from '@/lib/retired-navigation';

export default async function TravelerDashboardPage({ searchParams }: {
  searchParams: Promise<{ tab?: string | string[]; trip?: string | string[]; day?: string | string[] }>;
}) {
  const params = await searchParams;
  const tab = firstQueryValue(params.tab);
  if (tab === 'gps') redirect(legacyNavigationRedirect(params));
  return <TravelerDashboard initialTab={tab === 'planner' || tab === 'bookings' ? tab : undefined} />;
}
