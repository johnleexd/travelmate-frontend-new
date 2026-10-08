'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck, TriangleAlert, X } from 'lucide-react';
import { useModalAccessibility } from '@/hooks/use-modal-accessibility';
import type { PublicUser } from '@/lib/contracts';

type Props = {
  user: PublicUser;
  suspend: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: (onError: (message: string) => void) => Promise<boolean>;
};

export function AccountAccessDialog({ user, suspend, busy, onClose, onConfirm }: Props) {
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
      const saved = await onConfirm(setError);
      if (saved) onClose();
      else setError(current => current || 'Could not update this account. Please try again.');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not update this account. Please try again.');
    } finally { sendingRef.current = false; setSending(false); }
  }

  return createPortal(<div className="fixed inset-0 z-[95] flex items-center justify-center bg-[#061714]/75 p-4 backdrop-blur-sm sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="account-access-title" aria-describedby="account-access-description" aria-busy={pending} tabIndex={-1} className="relative max-h-[calc(100dvh-2rem)] w-full max-w-[500px] overflow-y-auto rounded-2xl border border-white/15 bg-[#102824] p-6 text-slate-100 shadow-[0_28px_80px_rgba(0,0,0,.4)] outline-none">
      <button type="button" disabled={pending} aria-label="Close confirmation" onClick={close} className="absolute right-6 top-6 grid size-9 place-items-center rounded-[10px] border border-white/10 bg-white/5 text-white/65 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-[#ffcf70] disabled:opacity-50"><X size={18}/></button>
      <div className="mb-5 flex items-center gap-3 pr-12"><span className={'grid size-10 shrink-0 place-items-center rounded-xl border ' + (suspend ? 'border-red-300/20 bg-red-300/10 text-red-200' : 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200')}>{suspend ? <TriangleAlert size={20}/> : <ShieldCheck size={20}/>}</span><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#ffcf70]">TravelMate Admin</p></div>
      <h2 id="account-access-title" className="pr-2 text-2xl font-bold leading-8 tracking-tight text-white">{suspend ? 'Suspend traveler account?' : 'Restore traveler access?'}</h2>
      <p id="account-access-description" className="mt-4 text-sm leading-7 text-white/60 [overflow-wrap:anywhere]">{suspend ? user.name + ' will lose access and can submit an appeal. Their saved trips will be preserved.' : user.name + ' will regain access immediately.'}</p>
      {error && <p role="alert" className="mt-4 rounded-lg border border-red-300/20 bg-red-300/10 px-3 py-2 text-xs leading-5 text-red-200">{error}</p>}
      <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-white/10 pt-5">
        <button ref={cancelRef} type="button" disabled={pending} onClick={close} className="min-h-11 rounded-[10px] border border-white/20 px-4 text-sm font-semibold text-white/75 hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-[#ffcf70] disabled:opacity-50">Cancel</button>
        <button type="button" disabled={pending} onClick={() => void confirm()} className={'min-h-11 rounded-[10px] border px-5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60 ' + (suspend ? 'border-red-300/30 bg-red-300/10 text-red-200 hover:bg-red-300/20 focus-visible:outline-red-300' : 'border-[#ffcf70] bg-[#ffcf70] text-[#102824] hover:bg-[#ffdb94] focus-visible:outline-[#ffcf70]')}>{pending ? (suspend ? 'Suspending…' : 'Restoring…') : (suspend ? 'Suspend account' : 'Restore access')}</button>
      </div>
    </div>
  </div>, document.body);
}
