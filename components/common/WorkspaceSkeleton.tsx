import { Compass } from 'lucide-react';
import { Skeleton, SkeletonRegion } from './Skeleton';

export type WorkspaceSkeletonVariant = 'traveler' | 'planner' | 'admin';

function CardSkeleton() {
  return <div className="border border-white/10 bg-[#102824] p-6">
    <Skeleton className="size-10" />
    <Skeleton className="mt-6 h-8 w-2/3" />
    <Skeleton className="mt-3 h-3 w-full" />
    <Skeleton className="mt-2 h-3 w-4/5" />
  </div>;
}

export function WorkspaceSkeleton({ label = 'Loading your TravelMate workspace...', variant = 'traveler' }: {
  label?: string;
  variant?: WorkspaceSkeletonVariant;
}) {
  return <main className="min-h-screen overflow-x-clip bg-[#0b1d1a] pt-20 text-white">
    <SkeletonRegion label={label}>
      <header className="fixed inset-x-0 top-0 z-40 px-4 pt-4 sm:px-6">
        <div className="mx-auto flex h-16 max-w-[1380px] items-center justify-between border border-white/15 bg-[#102824] px-4 sm:px-6">
          <div className="flex items-center gap-3"><span className="grid size-9 place-items-center bg-[#ffcf70] text-[#102824]"><Compass size={20} /></span><span className="text-lg font-semibold">TravelMate</span></div>
          <div className="flex items-center gap-3 border border-white/15 p-1.5"><Skeleton className="size-9" /><div className="hidden w-32 space-y-2 sm:block"><Skeleton className="h-3 w-24" /><Skeleton className="h-2 w-full" /></div></div>
        </div>
      </header>
      {variant === 'planner' && <div className="border-b border-white/10 bg-[#102622] px-4 py-3 sm:px-6"><Skeleton className="mx-auto h-4 max-w-[1600px]" /></div>}
      <div className="mx-auto grid max-w-[1600px] grid-cols-[minmax(0,1fr)] px-4 lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-10 lg:px-6 xl:gap-14">
        <aside className="min-w-0 py-4 lg:py-8">
          <div className="flex gap-px overflow-hidden border border-white/10 bg-white/10 p-px lg:flex-col">
            {Array.from({ length: variant === 'admin' ? 4 : 6 }, (_, index) => <div key={index} className="flex h-[49px] min-w-36 items-center gap-3 bg-[#0b1d1a] px-4 lg:min-w-0"><Skeleton className="size-4 shrink-0" /><Skeleton className="h-3 w-24" /></div>)}
          </div>
          <div className="mt-8 hidden space-y-2 border-t border-white/10 pt-5 lg:block"><Skeleton className="h-3 w-4/5" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-3/5" /></div>
        </aside>
        <div className="min-w-0 pb-20 pt-5 lg:pt-10">
          <div className="mb-7 border-b border-white/10 pb-6"><Skeleton className="h-10 w-4/5 max-w-lg sm:h-14" /><Skeleton className="mt-4 h-4 w-full max-w-2xl" /></div>
          {variant === 'admin' ? <>
            <div className="border border-white/10 bg-[#102824] p-6 sm:p-9"><Skeleton className="h-3 w-48" /><Skeleton className="mt-5 h-10 w-full max-w-2xl sm:h-14" /><Skeleton className="mt-5 h-4 w-4/5" /><Skeleton className="mt-2 h-4 w-2/3" /><div className="mt-6 flex flex-wrap gap-3"><Skeleton className="h-12 w-36" /><Skeleton className="h-12 w-36" /></div></div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map(index => <CardSkeleton key={index} />)}</div>
          </> : variant === 'planner' ? <>
            <Skeleton className="h-48 w-full sm:h-60" />
            <div className="mt-5 grid gap-5 border border-white/10 bg-[#102824] p-6 sm:grid-cols-2">{[0, 1, 2, 3, 4, 5].map(index => <div key={index}><Skeleton className="mb-3 h-3 w-24" /><Skeleton className="h-12 w-full" /></div>)}<Skeleton className="h-12 w-48" /></div>
          </> : <>
            <div className="grid border border-white/15 bg-[#102824] lg:grid-cols-3">
              <div className="space-y-5 p-6 sm:p-10 lg:col-span-2"><Skeleton className="h-3 w-3/4" /><Skeleton className="h-10 w-5/6 sm:h-14" /><Skeleton className="h-10 w-4/5 sm:h-14" /><Skeleton className="h-10 w-2/3 sm:h-14" /><div className="space-y-2 py-3"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /></div><div className="flex flex-wrap gap-3"><Skeleton className="h-12 w-44" /><Skeleton className="h-12 w-36" /></div></div>
              <div className="space-y-5 border-t border-white/10 bg-[#ffcf70]/[0.06] p-6 sm:p-10 lg:border-l lg:border-t-0"><Skeleton className="h-3 w-24" /><Skeleton className="h-8 w-full" /><Skeleton className="h-4 w-4/5" /><Skeleton className="mt-12 h-24 w-full" /></div>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">{[0, 1, 2].map(index => <CardSkeleton key={index} />)}</div>
          </>}
        </div>
      </div>
    </SkeletonRegion>
  </main>;
}
