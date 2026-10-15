'use client';

import { useRef, type RefObject } from 'react';
import { FileClock, MapPin } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import theme from './TravelerDashboard.module.css';

type Props = {
  destination: string;
  savedAt: string;
  returnFocusRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onRestore: () => void;
};

export function RestoreDraftDialog({ destination, savedAt, returnFocusRef, onClose, onRestore }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const savedDate = new Date(savedAt);
  const savedLabel = savedDate.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent
      showCloseButton={false}
      overlayClassName="z-[95] bg-[#20352d]/60 backdrop-blur-none supports-backdrop-filter:backdrop-blur-none"
      className={`${theme.theme} z-[96] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[500px] gap-0 overflow-y-auto rounded-2xl border border-[var(--tm-border)] bg-[var(--tm-surface)] p-6 text-center text-[var(--tm-text)] shadow-[0_16px_48px_rgba(20,35,31,.2)] ring-0 max-[359px]:p-4 sm:max-w-[500px] sm:p-8`}
      onOpenAutoFocus={event => {
        event.preventDefault();
        previousFocusRef.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
        cancelRef.current?.focus();
      }}
      onCloseAutoFocus={event => {
        event.preventDefault();
        const previous = previousFocusRef.current;
        (previous?.isConnected ? previous : returnFocusRef.current)?.focus();
      }}
    >
      <span aria-hidden="true" className="mx-auto mb-4 grid size-20 place-items-center rounded-full bg-[var(--tm-sage)] text-[var(--tm-primary)] max-[359px]:mb-3 max-[359px]:size-16"><FileClock size={36} strokeWidth={1.6}/></span>
      <DialogTitle className="text-[clamp(1.5rem,5vw,1.875rem)] font-bold leading-tight tracking-tight">Continue your trip plan?</DialogTitle>
      <DialogDescription className="mt-3 text-sm leading-6 text-[var(--tm-muted)] max-[359px]:leading-5">You have an unsaved itinerary draft. Restore it to continue where you left off.</DialogDescription>
      <div className="mt-5 flex items-center gap-4 rounded-xl bg-[var(--tm-group)] p-4 text-left max-[359px]:mt-4">
        <MapPin aria-hidden="true" size={28} strokeWidth={1.7} className="shrink-0 text-[var(--tm-primary)]"/>
        <div className="min-w-0"><p className="break-words font-semibold">{destination}</p><p className="mt-1 text-sm leading-5 text-[var(--tm-muted)]">Draft saved: <time dateTime={savedDate.toISOString()}>{savedLabel}</time></p></div>
      </div>
      <p className="mt-4 text-xs leading-5 text-[var(--tm-muted)] max-[359px]:mt-3">Restore your draft to review it before saving.</p>
      <div className="mt-5 grid grid-cols-1 gap-3 max-[359px]:mt-4 min-[360px]:grid-cols-2">
        <button ref={cancelRef} type="button" onClick={onClose} className="min-h-12 rounded-lg border border-[var(--tm-input-border)] px-4 text-sm font-semibold text-[var(--tm-primary)] hover:bg-[var(--tm-group)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-primary)]">Not now</button>
        <button type="button" onClick={onRestore} className="min-h-12 rounded-lg bg-[var(--tm-primary)] px-4 text-sm font-semibold text-[var(--tm-on-primary)] hover:bg-[var(--tm-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-primary)]">Restore draft</button>
      </div>
    </DialogContent>
  </Dialog>;
}
