import { Skeleton, SkeletonRegion } from './Skeleton';

export function OfferResultsSkeleton({ label, count = 2 }: { label: string; count?: number }) {
  return <SkeletonRegion label={label} className="mt-4">
    <div className="grid gap-3 lg:grid-cols-2">{Array.from({ length: count }, (_, index) => <div key={index} className="rounded-xl border border-slate-800 bg-slate-900/45 p-4">
      <div className="flex items-start justify-between gap-4"><div className="w-2/3"><Skeleton className="h-3 w-2/3" /><Skeleton className="mt-3 h-6 w-full" /></div><Skeleton className="h-7 w-20" /></div>
      <div className="mt-6 grid grid-cols-2 gap-4"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
      <Skeleton className="mt-5 h-3 w-4/5" /><Skeleton className="mt-4 h-10 w-40" />
    </div>)}</div>
  </SkeletonRegion>;
}

export function ItinerarySkeleton({ days }: { days: number }) {
  return <SkeletonRegion label="Generating your itinerary..." showLabel className="my-6 border border-white/10 bg-[#102824] p-5 sm:p-6">
    <div className="flex flex-wrap justify-between gap-4 border-b border-white/10 pb-5"><div className="w-2/3"><Skeleton className="h-7 w-full max-w-sm" /><Skeleton className="mt-3 h-3 w-4/5" /></div><Skeleton className="h-10 w-28" /></div>
    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: Math.max(1, Math.min(days, 3)) }, (_, index) => <div key={index} className="border border-white/10 p-4"><Skeleton className="h-32 w-full" /><Skeleton className="mt-5 h-5 w-2/3" />{[0, 1, 2].map(row => <div key={row} className="mt-4 flex gap-3"><Skeleton className="h-3 w-10 shrink-0" /><Skeleton className="h-3 w-full" /></div>)}</div>)}</div>
  </SkeletonRegion>;
}

export function AccountDetailsSkeleton() {
  return <SkeletonRegion label="Loading account details..." className="mt-6">
    <div className="border border-white/15 bg-[#102622] p-5"><Skeleton className="h-5 w-40" /><Skeleton className="mt-4 h-36 w-full" /><Skeleton className="mt-5 h-11 w-32" /></div>
    {[0, 1].map(index => <div key={index} className="mt-8"><Skeleton className="h-6 w-48" /><div className="mt-3 space-y-3 border border-white/15 bg-[#102622] p-5"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-4/5" /></div></div>)}
  </SkeletonRegion>;
}
