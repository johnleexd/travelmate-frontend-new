'use client';

import { useState } from 'react';
import { LoaderCircle, RefreshCw } from 'lucide-react';

export function RetryDayActivities({ dayIndex, busy, retrying, onRetry }: { dayIndex: number; busy: boolean; retrying: boolean; onRetry: (dayIndex: number, includeNearby: boolean) => void }) {
  const [includeNearby, setIncludeNearby] = useState(false);
  return <div className="my-3 flex flex-wrap items-center gap-3 text-xs">
    <button type="button" disabled={busy} onClick={() => onRetry(dayIndex, includeNearby)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#28594C] bg-[#FFFEFA] px-4 font-bold text-[#28594C] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#28594C] disabled:opacity-50">
      {retrying ? <LoaderCircle size={16} aria-hidden="true" className="motion-safe:animate-spin"/> : <RefreshCw size={16} aria-hidden="true"/>}{retrying ? 'Checking places…' : `Retry Day ${dayIndex + 1} activities`}
    </button>
    <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={includeNearby} disabled={busy} onChange={event => setIncludeNearby(event.target.checked)}/>Include verified nearby alternatives (extra travel)</label>
    <p className="w-full text-[#52645A]">Keeps your existing activities and edits. Review new stops before saving.</p>
  </div>;
}
