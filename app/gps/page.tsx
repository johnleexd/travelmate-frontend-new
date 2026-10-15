import { redirect } from 'next/navigation';
import { legacyNavigationRedirect } from '@/lib/retired-navigation';

/** Old bookmarks redirect to Saved trips; no standalone navigation UI remains. */
export default async function RetiredGpsPage({ searchParams }: { searchParams: Promise<{ trip?: string | string[]; day?: string | string[] }> }) {
  redirect(legacyNavigationRedirect(await searchParams));
}
