'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, X } from 'lucide-react';
import type { SavedTrip } from '@/lib/contracts';
import { useModalAccessibility } from '@/hooks/use-modal-accessibility';
import { SavedAccommodation } from './SavedAccommodation';

type Props = {
  trip: SavedTrip;
  busy: boolean;
  onClose: () => void;
  onConfirm: (onError: (message: string) => void) => Promise<boolean>;
};

export function DeleteTripDialog({ trip, busy, onClose, onConfirm }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const sendingRef = useRef(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const pending = busy || sending;
  const close = () => { if (!sendingRef.current && !busy) onClose(); };
  useModalAccessibility({ active: true, containerRef: dialogRef, initialFocusRef: cancelRef, onClose: close });

  async function confirm() {
    if (sendingRef.current || busy) return;
    sendingRef.current = true;
    setSending(true);
    setError('');
    try {
      if (await onConfirm(setError)) onClose();
      else setError(current => current || 'Could not delete this trip. Please try again.');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not delete this trip. Please try again.');
    } finally { sendingRef.current = false; setSending(false); }
  }

  return createPortal(<div className="fixed inset-0 z-[95] flex items-center justify-center bg-[#04120f]/85 p-3 text-white backdrop-blur-sm sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
    <div ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby="delete-trip-title" aria-describedby="delete-trip-description" aria-busy={pending} tabIndex={-1} className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/15 bg-[#102824] p-5 shadow-2xl outline-none sm:p-6">
      <button type="button" disabled={pending} aria-label="Close delete confirmation" onClick={close} className="absolute right-5 top-5 grid size-10 place-items-center rounded-lg border border-white/15 text-white/65 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-[#ffcf70] disabled:opacity-40"><X size={18}/></button>
      <span className="grid size-11 place-items-center rounded-xl border border-red-300/20 bg-red-300/10 text-red-200"><Trash2 size={21}/></span>
      <p className="mt-4 text-[10px] font-bold uppercase tracking-[.14em] text-[#ffcf70]">Archived trip</p>
      <h2 id="delete-trip-title" className="mt-1 text-2xl font-bold tracking-tight">Delete this trip permanently?</h2>
      <p id="delete-trip-description" className="mt-3 text-sm leading-6 text-white/60">This removes the saved trip and all its itinerary versions. This action cannot be undone.</p>
      <div className="mt-5 rounded-xl border border-white/10 bg-[#0b1d1a]/60 p-4"><h3 className="break-words text-base font-semibold">{trip.destination}</h3><p className="mt-1 text-xs leading-5 text-white/50">{trip.startDate} – {trip.endDate} · {trip.travelers} traveler{trip.travelers === 1 ? '' : 's'}</p><SavedAccommodation trip={trip}/></div>
      {error && <p role="alert" className="mt-4 rounded-lg border border-red-300/25 bg-red-300/10 p-3 text-sm leading-5 text-red-200">{error}</p>}
      <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-white/10 pt-5">
        <button ref={cancelRef} type="button" disabled={pending} onClick={close} className="min-h-11 rounded-lg border border-white/20 px-4 text-sm font-semibold text-white/75 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-[#ffcf70] disabled:opacity-40">Cancel</button>
        <button type="button" disabled={pending} onClick={() => void confirm()} className="min-h-11 rounded-lg border border-red-300/35 bg-red-300/15 px-4 text-sm font-semibold text-red-200 hover:bg-red-300/25 focus-visible:outline-2 focus-visible:outline-red-300 disabled:cursor-wait disabled:opacity-40">{pending ? 'Deleting…' : 'Delete permanently'}</button>
      </div>
    </div>
  </div>, document.body);
}
