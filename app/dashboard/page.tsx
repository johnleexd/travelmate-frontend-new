import TravelerDashboard from "@/components/features/traveler/TravelerDashboard";

export default async function TravelerDashboardPage({ searchParams }: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { tab } = await searchParams;
  return <TravelerDashboard initialTab={tab === 'planner' ? 'planner' : undefined} />;
}
