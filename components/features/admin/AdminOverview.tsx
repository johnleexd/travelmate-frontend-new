'use client';

import { ArrowUpRight, ChartNoAxesCombined, ChevronRight, CircleCheck, Clock3, Flag, ShieldCheck, Star, Users } from 'lucide-react';
import type { PlatformResponse } from '@/lib/contracts';
import type { AdminTab } from './AdminPanels';

const card = 'min-w-0 rounded-2xl border border-white/10 bg-[#102824] p-5 shadow-[0_8px_28px_rgba(0,0,0,.08)] sm:p-6';
const dateLabel = (date: string) => new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Shanghai' });
const activityLabels: Record<string, string> = {
  'submit-report': 'Traveler report received', 'resolve-report': 'Report marked resolved',
  'submit-appeal': 'Suspension appeal received', 'appeal-approved': 'Appeal approved · access restored',
  'appeal-rejected': 'Suspension appeal rejected', 'admin-user-warning': 'Account warning sent',
  'admin-user-status': 'Traveler account status updated', 'save-trip': 'New trip saved',
  'update-trip': 'Saved itinerary updated', 'regenerate-trip': 'Itinerary regenerated',
};

export function Overview({ data, onOpen }: { data: PlatformResponse; onOpen: (tab: AdminTab) => void }) {
  const summary = data.adminOverview;
  const travelers = data.directory.filter(user => user.role === 'traveler');
  const pending = data.moderation.filter(item => (item.kind === 'report' || item.kind === 'appeal') && item.status === 'pending').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const appeals = data.moderation.filter(item => item.kind === 'appeal');
  const resolvedAppeals = appeals.filter(item => item.status === 'approved' || item.status === 'rejected').length;
  const activity = [...data.audit].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4);
  const metrics = [
    { label: 'Traveler accounts', value: travelers.length.toLocaleString(), note: 'Registered travelers', icon: Users, tab: 'users' as const, color: 'bg-emerald-300/10 text-emerald-200' },
    { label: 'Open reports & appeals', value: pending.length.toLocaleString(), note: pending.length ? 'Awaiting admin review' : 'No open reports', icon: Flag, tab: 'reports' as const, color: 'bg-rose-300/10 text-rose-200' },
    { label: 'Generated plans', value: summary?.generatedPlans.toLocaleString() ?? '—', note: 'Successful generations · all time', icon: ChartNoAxesCombined, tab: 'health' as const, color: 'bg-sky-300/10 text-sky-200' },
    { label: 'Average traveler rating', value: summary?.averageRating != null ? summary.averageRating.toFixed(1) + ' / 5' : '—', note: summary ? (summary.feedbackCount ? summary.feedbackCount.toLocaleString() + ' traveler ratings' : 'No ratings yet') : 'Ratings unavailable', icon: Star, tab: 'feedback' as const, color: 'bg-amber-300/10 text-amber-200' },
  ];
  const health = [
    { label: 'Active travelers', count: travelers.filter(user => user.accountStatus === 'active').length, total: travelers.length, tab: 'users' as const },
    { label: 'Email verified', count: travelers.filter(user => user.emailVerified).length, total: travelers.length, tab: 'users' as const },
    { label: 'Verified profiles', count: travelers.filter(user => user.profileStatus === 'verified').length, total: travelers.length, tab: 'users' as const },
    { label: 'Appeals resolved', count: resolvedAppeals, total: appeals.length, tab: 'reports' as const },
  ];
  const days = summary?.generationDays ?? [];
  const max = Math.max(4, Math.ceil((Math.max(0, ...days.map(day => day.completed)) + 1) / 4) * 4);
  const attempts = (summary?.recentCompleted ?? 0) + (summary?.recentFailed ?? 0);
  return <div className="space-y-5">
    <section aria-label="Administration summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map(({ label, value, note, icon: Icon, tab, color }) => <button type="button" data-admin-card key={label} onClick={() => onOpen(tab)} className={card + ' group flex items-start gap-4 text-left transition-colors hover:border-[#ffcf70]/40 focus-visible:outline-2 focus-visible:outline-[#ffcf70]'}>
        <span className={'grid size-11 shrink-0 place-items-center rounded-xl ' + color}><Icon size={21}/></span>
        <span className="min-w-0 flex-1"><span className="block text-xs font-medium leading-5 text-white/55">{label}</span><strong className="mt-1 block text-3xl font-semibold tracking-tight text-white">{value}</strong><span className="mt-2 block text-[11px] leading-5 text-white/45">{note}</span></span><ArrowUpRight size={15} className="shrink-0 text-white/30 transition-colors group-hover:text-[#ffcf70]"/>
      </button>)}
    </section>

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
      <section data-admin-card className={card} aria-labelledby="generation-activity-title">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="generation-activity-title" className="text-base font-semibold text-white">Itinerary generation activity</h2><p className="mt-1.5 text-xs leading-5 text-white/45">Successful plans over the last 7 days · Philippine time</p></div><span className={'rounded-full px-3 py-1.5 text-[10px] font-semibold ' + (!summary ? 'bg-white/5 text-white/50' : summary.recentFailed ? 'bg-amber-300/10 text-amber-200' : 'bg-emerald-300/10 text-emerald-200')}>{!summary ? 'Unavailable' : !attempts ? 'No activity yet' : summary.recentFailed ? 'Needs attention' : 'Healthy'}</span></div>
        {summary ? <>
          <div className="mt-8 flex gap-3" role="img" aria-label={'Successful itinerary generations for the last seven days: ' + days.map(day => day.date + ': ' + day.completed).join(', ')}>
            <div aria-hidden="true" className="flex h-44 shrink-0 flex-col justify-between pb-0 text-[10px] text-white/30 sm:h-48"><span>{max}</span><span>{Math.round(max / 2)}</span><span>0</span></div>
            <div className="min-w-0 flex-1"><div className="grid h-44 grid-cols-7 items-end gap-3 border-b border-white/15 bg-[linear-gradient(to_top,transparent_calc(100%-1px),rgba(255,255,255,.06)_1px)] bg-[length:100%_25%] px-2 sm:h-48 sm:gap-6 sm:px-4">
              {days.map(day => <div key={day.date} className="relative flex h-full min-w-0 flex-col items-center justify-end"><span className="mb-2 text-[10px] font-medium text-white/65">{day.completed}</span><div title={day.date + ': ' + day.completed + ' completed plans'} className="w-full max-w-10 rounded-t-md bg-gradient-to-t from-[#0d827a] to-[#34b5a7]" style={{ height: day.completed ? (day.completed / max * 100) + '%' : '2px', opacity: day.completed ? 1 : 0.25 }}/></div>)}
            </div><div aria-hidden="true" className="mt-3 grid grid-cols-7 gap-3 px-2 text-center text-[10px] text-white/45 sm:gap-6 sm:px-4">{days.map(day => <span key={day.date}>{new Date(day.date + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}<span className="mt-1 block text-[9px] text-white/30">{new Date(day.date + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</span></span>)}</div></div>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4 text-[11px] text-white/45"><span><span className="mr-2 inline-block size-2 rounded-full bg-[#34b5a7]"/>{summary.recentCompleted.toLocaleString()} successful · {summary.recentFailed.toLocaleString()} failed</span><button type="button" onClick={() => onOpen('health')} className="inline-flex min-h-8 items-center gap-1 font-semibold text-[#73d6c7] hover:text-white">System health <ChevronRight size={13}/></button></div>
        </> : <p className="flex min-h-64 items-center justify-center text-sm text-white/45">Generation activity is currently unavailable.</p>}
      </section>

      <section data-admin-card className={card} aria-labelledby="account-health-title"><h2 id="account-health-title" className="text-base font-semibold text-white">Account health</h2><p className="mt-1.5 text-xs text-white/45">Traveler access and verification overview</p><div className="mt-5 divide-y divide-white/10">{health.map((item, index) => {
        const percent = item.total ? Math.round(item.count / item.total * 100) : null;
        return <button type="button" key={item.label} onClick={() => onOpen(item.tab)} className="grid min-h-20 w-full grid-cols-[18px_minmax(0,1fr)] items-center gap-3 py-4 text-left sm:grid-cols-[18px_minmax(100px,1fr)_minmax(70px,1fr)_36px] sm:gap-4"><span className="text-[10px] text-white/30">{String(index + 1).padStart(2, '0')}</span><span><span className="block text-xs font-semibold text-white/85">{item.label}</span><span className="mt-1 block text-[10px] text-white/40">{item.count} of {item.total} {item.tab === 'reports' ? 'appeals' : 'travelers'}</span></span><span className="col-start-2 h-1.5 overflow-hidden rounded-full bg-white/10 sm:col-start-auto"><span className="block h-full rounded-full bg-[#2eb3a5]" style={{ width: (percent ?? 0) + '%' }}/></span><span className="col-start-2 text-[11px] font-semibold text-white/70 sm:col-start-auto sm:text-right">{percent == null ? '—' : percent + '%'}</span></button>;
      })}</div></section>

      <section data-admin-card className={card} aria-labelledby="attention-title"><div className="flex items-start justify-between gap-4"><div><h2 id="attention-title" className="text-base font-semibold text-white">Reports needing attention</h2><p className="mt-1.5 text-xs text-white/45">Latest traveler reports and suspension appeals</p></div><button type="button" onClick={() => onOpen('reports')} className="inline-flex min-h-8 shrink-0 items-center gap-2 text-xs font-semibold text-[#73d6c7] hover:text-white">View all <ArrowUpRight size={15}/></button></div>
        <div className="mt-5 divide-y divide-white/10">{pending.slice(0, 3).map(report => <button type="button" key={report.id} onClick={() => onOpen('reports')} className="flex min-h-20 w-full items-center gap-3 py-4 text-left"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#2eb3a5]/10 text-[#73d6c7]"><Flag size={18}/></span><span className="min-w-0 flex-1"><strong className="block truncate text-xs font-semibold text-white/85">{report.title}</strong><span className="mt-1.5 block text-[10px] leading-5 text-white/40">{data.directory.find(user => user.id === report.subjectId)?.name ?? 'Former account'} · {dateLabel(report.createdAt)}</span></span><span className={'shrink-0 rounded-lg px-2.5 py-2 text-[10px] font-semibold ' + (report.kind === 'appeal' ? 'bg-amber-300/10 text-amber-200' : 'bg-emerald-300/10 text-emerald-200')}>{report.kind === 'appeal' ? 'Appeal' : 'Report'}</span></button>)}</div>
        {!pending.length && <div className="flex min-h-44 flex-col items-center justify-center gap-3 text-center"><CircleCheck size={26} className="text-[#73d6c7]"/><p className="text-sm text-white/65">You’re all caught up.</p><p className="text-xs text-white/40">No reports or appeals are awaiting review.</p></div>}
      </section>

      <section data-admin-card className={card} aria-labelledby="recent-activity-title"><div className="flex items-start justify-between gap-3"><div><h2 id="recent-activity-title" className="text-base font-semibold text-white">Recent activity</h2><p className="mt-1.5 text-xs text-white/45">Administration and platform activity log</p></div><Clock3 size={17} className="text-white/30"/></div><div className="mt-5 divide-y divide-white/10">{activity.map(item => <div key={item.id} className="flex min-h-20 items-center gap-3 py-4"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#2eb3a5]/10 text-[#73d6c7]"><ShieldCheck size={18}/></span><div className="min-w-0"><p className="text-xs font-semibold leading-5 text-white/85">{activityLabels[item.action] ?? item.action.replaceAll('-', ' ').replaceAll('_', ' ')}</p><p className="mt-1 text-[10px] leading-5 text-white/40">{data.directory.find(user => user.id === item.actorId)?.name ?? 'Former account'} · {dateLabel(item.createdAt)}</p></div></div>)}</div>{!activity.length && <p className="flex min-h-44 items-center justify-center text-sm text-white/45">No activity recorded yet.</p>}</section>
    </div>
  </div>;
}
