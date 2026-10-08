import { BedDouble } from 'lucide-react';
import type { SavedTrip } from '@/lib/contracts';
import { savedAccommodation } from '@/lib/saved-accommodation';

export function SavedAccommodation({ trip }: { trip: SavedTrip }) {
  const stay = savedAccommodation(trip);
  if (!stay) return null;
  return <div className="mt-4 flex min-w-0 items-start gap-3 rounded-xl border border-[#ffcf70]/20 bg-[#081b18]/60 p-3">
    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#ffcf70]/10 text-[#ffcf70]"><BedDouble size={18}/></span>
    <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#ffcf70]">Selected accommodation</p><p className="mt-1 break-words text-sm font-semibold text-white">{stay.name}</p>{stay.address && <p className="mt-1 break-words text-xs leading-5 text-white/60">{stay.address}</p>}<p className="mt-2 text-[11px] leading-5 text-white/45">{stay.selectionKind === 'planned' ? 'Planning preference · Price and availability unconfirmed.' : 'Saved room quote · Recheck price and availability before booking.'}</p></div>
  </div>;
}
