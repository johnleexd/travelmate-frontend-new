'use client';

import { Bell } from 'lucide-react';
import type { PlatformResponse } from '@/lib/contracts';
type Action = (body: Record<string, unknown>, message: string) => Promise<boolean>;

export function TravelerNotifications({ data, busy, action }: { data: PlatformResponse; busy: boolean; action: Action }) {
  return <div className="space-y-5"><div className="flex items-center justify-between gap-4 bg-amber-300 p-6 text-[#14231f]"><div><Bell size={22}/><strong className="mt-3 block text-3xl font-black">{data.notifications.filter((item) => !item.readAt).length} unread</strong></div><button disabled={busy} onClick={() => void action({ action: 'mark-all-notifications-read' }, 'All notifications marked as read.')} className="min-h-11 bg-[#14231f] px-4 text-sm font-black text-white">Mark all read</button></div><div className="divide-y divide-white/10 border border-white/10 bg-[#102622]">{data.notifications.length === 0 ? <p className="p-8 text-sm text-white/42">No notifications yet.</p> : data.notifications.map((item) => <article key={item.id} className={`flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between ${item.readAt ? 'opacity-55' : ''}`}><div><strong>{item.title}</strong><p className="mt-1 text-sm text-white/48">{item.body}</p><time className="mt-2 block text-xs text-white/30">{new Date(item.createdAt).toLocaleString()}</time></div>{!item.readAt && <button disabled={busy} onClick={() => void action({ action: 'mark-notification-read', id: item.id }, 'Notification marked as read.')} className="min-h-10 border border-white/20 px-4 text-xs font-bold">Mark read</button>}</article>)}</div></div>;
}
