import { Skeleton, SkeletonRegion } from '@/components/common/Skeleton';

export default function Loading() {
  return <main className="min-h-screen bg-[#0b1d1a] px-4 py-4 text-white sm:px-6"><SkeletonRegion label="Loading TravelMate..." className="mx-auto max-w-[1380px]"><div className="flex h-16 items-center justify-between border border-white/15 bg-[#102824] px-6"><Skeleton className="h-8 w-36" /><Skeleton className="size-9" /></div><div className="mx-auto max-w-4xl py-20"><Skeleton className="h-14 w-4/5" /><Skeleton className="mt-6 h-4 w-2/3" /><Skeleton className="mt-10 h-72 w-full sm:h-96" /></div></SkeletonRegion></main>;
}
