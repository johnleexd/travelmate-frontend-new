'use client';

import { useRef, type RefObject } from 'react';
import { TriangleAlert, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import theme from './TravelerDashboard.module.css';

type Props = {
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onDiscard: () => void;
};

export function UnsavedTripDialog({ returnFocusRef, onClose, onDiscard }: Props) {
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const leavingRef = useRef(false);
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent
      showCloseButton={false}
      overlayClassName="z-[95] bg-[#20352d]/40 backdrop-blur-none supports-backdrop-filter:backdrop-blur-none"
      className={`${theme.theme} z-[96] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[420px] gap-0 overflow-y-auto rounded-2xl border border-[var(--tm-border)] bg-[var(--tm-surface)] p-6 text-center text-[var(--tm-text)] shadow-[0_16px_48px_rgba(20,35,31,.2)] ring-0 max-[359px]:p-5 sm:max-w-[420px]`}
      onOpenAutoFocus={event => { event.preventDefault(); keepEditingRef.current?.focus(); }}
      onCloseAutoFocus={event => {
        event.preventDefault();
        if (!leavingRef.current) returnFocusRef.current?.focus({ preventScroll: true });
      }}
    >
      <button type="button" aria-label="Close unsaved changes confirmation" onClick={onClose} className={theme.confirmationClose}><X size={18} aria-hidden="true"/></button>
      <span aria-hidden="true" className={theme.warningIcon}><TriangleAlert size={28} strokeWidth={1.7}/></span>
      <DialogTitle className="text-[22px] font-bold leading-tight tracking-tight">Leave without saving?</DialogTitle>
      <DialogDescription className="mt-3 text-sm leading-6 text-[var(--tm-muted)]">You have unsaved changes to this trip. Leaving now will discard them.</DialogDescription>
      <div className={theme.confirmationActions}>
        <button ref={keepEditingRef} type="button" onClick={onClose} className={theme.keepEditing}>Keep editing</button>
        <button type="button" onClick={() => { leavingRef.current = true; onDiscard(); }} className={theme.discardChanges}>Discard changes</button>
      </div>
    </DialogContent>
  </Dialog>;
}
