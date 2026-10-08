'use client';

import { useState } from 'react';
import { ArrowRight, Bell, CheckCheck, Flag, HeartPulse, MessageSquare, ShieldCheck } from 'lucide-react';
import type { Notification } from '@/lib/contracts';
import { notificationFeedbackId, notificationCategory, notificationDateGroup, notificationTarget, type NotificationCategory } from '@/lib/admin-notifications';
import type { AdminTab } from './AdminPanels';

type Props = {
  notifications: Notification[];
  unreadCount: number;
  busy: boolean;
  onAction: (body: Record<string, unknown>, onError: (message: string) => void) => Promise<boolean>;
  onOpen: (tab: AdminTab, feedbackId?: string) => void;
};
const filters = [['all', 'All'], ['appeals', 'Appeals'], ['reports', 'Reports'], ['system', 'System'], ['feedback', 'Feedback']] as const;
const categoryIcons = { appeals: ShieldCheck, reports: Flag, system: HeartPulse, feedback: MessageSquare };

export function AdminNotificationsView({ notifications, unreadCount, busy, onAction, onOpen }: Props) {
  const [filter, setFilter] = useState<NotificationCategory | 'all'>('all');
  const [error, setError] = useState('');
  const filtered = [...notifications].filter(item => filter === 'all' || notificationCategory(item) === filter).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  async function openNotification(item: Notification) {
    if (busy) return;
    setError('');
    if (!item.readAt && !await onAction({ action: 'mark-notification-read', id: item.id }, setError)) return;
    onOpen(notificationTarget(item), notificationFeedbackId(item));
  }
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-4"><p role="status" className="text-sm text-white/55">{unreadCount ? unreadCount.toLocaleString() + ' unread administration ' + (unreadCount === 1 ? 'update' : 'updates') : 'You’re all caught up. No unread updates.'}</p><button type="button" disabled={busy || unreadCount === 0} onClick={async () => { setError(''); await onAction({ action: 'mark-all-notifications-read' }, setError); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#ffcf70]/30 px-4 text-sm font-semibold text-[#ffcf70] transition-colors hover:bg-[#ffcf70]/10 focus-visible:outline-2 focus-visible:outline-[#ffcf70] disabled:opacity-40"><CheckCheck size={17}/>{busy ? 'Updating…' : 'Mark all read'}</button></div>
    {error && <p role="alert" className="rounded-xl border border-red-300/20 bg-red-300/10 px-4 py-3 text-sm text-red-200">{error}</p>}
    <section aria-label="Administration notifications" className="min-w-0 rounded-2xl border border-white/10 bg-[#102824] p-4 shadow-[0_8px_28px_rgba(0,0,0,.08)] sm:p-6">
      <div role="group" aria-label="Filter notifications" className="flex flex-wrap gap-2">{filters.map(([id, label]) => <button type="button" key={id} aria-pressed={filter === id} onClick={() => setFilter(id)} className={'min-h-9 rounded-full border px-4 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[#ffcf70] ' + (filter === id ? 'border-[#ffcf70]/50 bg-[#ffcf70]/10 text-[#ffcf70]' : 'border-white/15 text-white/55 hover:border-white/30 hover:text-white')}>{label}</button>)}</div>
      {(['Today', 'Yesterday', 'Earlier'] as const).map(group => {
        const items = filtered.filter(item => notificationDateGroup(item.createdAt) === group);
        if (!items.length) return null;
        return <div key={group} className="mt-6"><h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[.12em] text-white/40">{group}</h2><ul className="divide-y divide-white/10 border-b border-white/10">{items.map(item => {
          const category = notificationCategory(item);
          const Icon = categoryIcons[category];
          const label = filters.find(([id]) => id === category)![1];
          return <li key={item.id}><button type="button" disabled={busy} onClick={() => void openNotification(item)} className={'flex w-full items-center gap-3 rounded-lg px-3 py-4 text-left transition-colors hover:bg-white/[.06] focus-visible:outline-2 focus-visible:outline-[#ffcf70] disabled:opacity-60 sm:gap-4 ' + (!item.readAt ? 'bg-[#2eb3a5]/[.065]' : '')}><span className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#2eb3a5]/10 bg-[#2eb3a5]/10 text-[#73d6c7]"><Icon size={18}/></span><span className="min-w-0 flex-1"><strong className="block text-sm font-semibold leading-6 text-white/90 [overflow-wrap:anywhere]">{item.title}</strong><span className="mt-1 block text-xs leading-6 text-white/50 [overflow-wrap:anywhere]">{item.body}</span><span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]"><span className="text-[#73d6c7]">{label}</span><time dateTime={item.createdAt} className="text-white/35">{new Date(item.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Shanghai' })}</time></span></span>{!item.readAt && <span className="size-1.5 shrink-0 rounded-full bg-[#ffcf70]"><span className="sr-only">Unread</span></span>}<ArrowRight size={17} className="shrink-0 text-white/45"/></button></li>;
        })}</ul></div>;
      })}
      {!filtered.length && <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center"><span className="grid size-12 place-items-center rounded-2xl bg-[#ffcf70]/10 text-[#ffcf70]"><Bell size={24}/></span><h2 className="text-base font-semibold">{filter === 'all' ? 'No notifications yet' : 'No ' + filters.find(([id]) => id === filter)![1].toLowerCase() + ' notifications'}</h2><p className="max-w-sm text-sm leading-6 text-white/45">{filter === 'all' ? 'New reports, appeals, feedback and system updates will appear here.' : 'Choose another category to see more updates.'}</p></div>}
    </section>
    <p className="text-xs text-white/35">Showing the latest {notifications.length} administration updates. Mark all read applies to all your unread notifications.</p>
  </div>;
}
