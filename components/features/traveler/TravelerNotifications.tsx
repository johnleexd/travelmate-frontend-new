'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X } from 'lucide-react';
import type { PlatformResponse } from '@/lib/contracts';
import { useModalAccessibility } from '@/hooks/use-modal-accessibility';
type Action = (body: Record<string, unknown>, message: string) => Promise<boolean>;

export function TravelerNotifications({ data, busy, action }: { data: PlatformResponse; busy: boolean; action: Action }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [readError, setReadError] = useState('');
  const selected = data.notifications.find(item => item.id === selectedId);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useModalAccessibility({ active: Boolean(selected), containerRef: modalRef, initialFocusRef: closeRef, onClose: () => setSelectedId(null) });
  const openDetails = (id: string) => { setReadError(''); setSelectedId(id); };
  const button = 'min-h-11 border border-white/20 px-4 py-2 text-xs font-bold hover:bg-white/10 disabled:opacity-50';

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-4 bg-amber-300 p-6 text-[#14231f]"><div><Bell size={22}/><strong className="mt-3 block text-3xl font-black">{data.notifications.filter(item => !item.readAt).length} unread</strong></div><button disabled={busy} onClick={() => void action({ action: 'mark-all-notifications-read' }, 'All notifications marked as read.')} className="min-h-11 bg-[#14231f] px-4 text-sm font-black text-white">Mark all read</button></div>
    <div className="divide-y divide-white/10 border border-white/10 bg-[#102622]">
      {data.notifications.length === 0 ? <p className="p-8 text-sm text-white/42">No notifications yet.</p> : data.notifications.map(item => <article key={item.id} className={`flex min-w-0 flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between ${item.readAt ? 'opacity-55' : ''}`}>
        <div className="min-w-0 flex-1"><button type="button" onClick={() => openDetails(item.id)} aria-haspopup="dialog" className="text-left font-bold [overflow-wrap:anywhere] hover:underline">{item.title}</button><p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-white/60 [overflow-wrap:anywhere]">{item.body}</p><time className="mt-2 block text-xs text-white/45">{new Date(item.createdAt).toLocaleString()}</time></div>
        <div className="flex shrink-0 flex-wrap gap-2"><button type="button" onClick={() => openDetails(item.id)} aria-haspopup="dialog" className={button}>View details</button>{!item.readAt && <button disabled={busy} onClick={() => void action({ action: 'mark-notification-read', id: item.id }, 'Notification marked as read.')} className={button}>Mark read</button>}</div>
      </article>)}
    </div>
    {selected && createPortal(<div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-3 text-slate-100 sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedId(null); }}>
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="notification-title" tabIndex={-1} className="flex max-h-[calc(100dvh-1.5rem)] w-full min-w-0 max-w-2xl flex-col border border-white/20 bg-[#102622] shadow-2xl sm:max-h-[calc(100dvh-3rem)]">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-white/15 p-4 sm:px-6"><span className="flex items-center gap-2 font-bold text-[#ffcf70]"><Bell size={19}/>Notification details</span><button ref={closeRef} type="button" onClick={() => setSelectedId(null)} aria-label="Close notification details" className="grid size-11 shrink-0 place-items-center border border-white/20 hover:bg-white/10"><X size={20}/></button></div>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6">
          <h2 id="notification-title" className="text-xl font-bold [overflow-wrap:anywhere]">{selected.title}</h2>
          <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-sm"><div><dt className="text-white/50">Received</dt><dd className="mt-1">{new Date(selected.createdAt).toLocaleString()}</dd></div><div><dt className="text-white/50">Status</dt><dd className="mt-1 text-[#ffcf70]">{selected.readAt ? 'Read' : 'Unread'}</dd></div></dl>
          <h3 className="mt-6 font-bold">Full message</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-white/80 [overflow-wrap:anywhere]">{selected.body}</p>
          {readError && <p role="alert" className="mt-4 text-sm text-red-300">{readError}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-white/15 p-4 sm:px-6"><button type="button" className={button} onClick={() => setSelectedId(null)}>Close</button>{!selected.readAt && <button type="button" disabled={busy} className={button} onClick={async () => { setReadError(''); if (!await action({ action: 'mark-notification-read', id: selected.id }, 'Notification marked as read.')) setReadError('Could not mark this notification as read. Please try again.'); }}>{busy ? 'Saving...' : 'Mark read'}</button>}</div>
      </div>
    </div>, document.body)}
  </div>;
}
