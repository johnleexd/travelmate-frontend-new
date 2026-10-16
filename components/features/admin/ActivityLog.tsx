'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ChevronLeft, ChevronRight, Clock3, LogIn, RefreshCw, Search, ShieldCheck, UserRound, XCircle } from 'lucide-react';
import type { ActivityLogEntry, ActivityLogResponse } from '@/lib/contracts';
import { handleResponse, isAuthenticationError } from '@/services/api.service';
import { UserAvatar } from '@/components/common/UserAvatar';
import styles from './ActivityLog.module.css';

function Actor({ entry }: { entry: ActivityLogEntry }) {
  if (!entry.actor) return <div className={styles.actor}><span className={styles.unknownIcon}><UserRound size={18} aria-hidden="true"/></span><div className={styles.identity}><strong>{entry.actorUnavailableReason === 'not-recorded' ? 'Actor not recorded' : 'Account unavailable'}</strong><small>Name and role unavailable</small></div></div>;
  return <div className={styles.actor}><UserAvatar user={entry.actor}/><div className={styles.identity}><strong>{entry.actor.name}</strong><span className={entry.actor.role === 'admin' ? styles.adminRole : styles.travelerRole}>{entry.actor.role === 'admin' && <ShieldCheck size={11} aria-hidden="true"/>}{entry.actor.role === 'admin' ? 'Admin' : 'Traveler'}</span></div></div>;
}

function ActionLabel({ entry }: { entry: ActivityLogEntry }) {
  const Icon = /login/i.test(entry.actionLabel) ? LogIn : entry.tone === 'success' ? CheckCircle2 : entry.tone === 'danger' ? XCircle : Clock3;
  return <span className={`${styles.action} ${styles[entry.tone]}`}><Icon size={14} aria-hidden="true"/>{entry.actionLabel}</span>;
}

export function ActivityLog({ search, onSearch, refreshKey }: { search: string; onSearch: (value: string) => void; refreshKey: string }) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<ActivityLogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    const timer = setTimeout(() => {
      setLoading(true); setError(''); setData(null);
      const params = new URLSearchParams({ page: String(page) });
      if (search.trim()) params.set('q', search.trim());
      void fetch(`/api/platform/activity?${params}`, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) })
        .then(handleResponse<ActivityLogResponse>)
        .then(result => {
          if (!Array.isArray(result.entries) || !Number.isSafeInteger(result.total) || !Number.isSafeInteger(result.page) || !Number.isSafeInteger(result.pageSize) || result.pageSize < 1) throw new Error('Activity log returned an invalid response. Please try again.');
          if (current) { setData(result); setLoading(false); }
        })
        .catch((failure: unknown) => {
          if (!current || controller.signal.aborted) return;
          if (isAuthenticationError(failure)) { router.replace('/'); return; }
          setError(failure instanceof Error && failure.name !== 'TimeoutError' ? failure.message : 'Activity log did not respond. Please try again.');
          setLoading(false);
        });
    }, search.trim() ? 250 : 0);
    return () => { current = false; clearTimeout(timer); controller.abort(); };
  }, [page, search, revision, refreshKey, router]);

  function changePage(next: number) { setLoading(true); setData(null); setPage(next); }
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return <section data-admin-card className={styles.panel} aria-labelledby="activity-log-title">
    <header className={styles.header}><div><h2 id="activity-log-title">Activity Log</h2><p>Track account and platform actions.</p></div><button type="button" className={styles.refresh} disabled={loading} aria-label="Refresh activity log" onClick={() => setRevision(value => value + 1)}><RefreshCw size={16} aria-hidden="true"/></button></header>
    <label className={styles.search}><span className="sr-only">Search activity</span><Search size={17} aria-hidden="true"/><input type="search" maxLength={200} value={search} onChange={event => { setPage(1); setLoading(true); setData(null); onSearch(event.target.value); }} placeholder="Search actor name, action, or record ID" aria-describedby="activity-log-help"/></label>
    <p id="activity-log-help" className={styles.help}>Search all recorded activity. Names and roles reflect current accounts.</p>
    <div aria-busy={loading} className={styles.results}>
      {loading && <p role="status" className={styles.state}>Loading activity…</p>}
      {error && <div role="alert" className={styles.error}><p>{error}</p><button type="button" onClick={() => setRevision(value => value + 1)}>Try again</button></div>}
      {!loading && !error && data && <>
        <table className={styles.table} role="table" aria-label="Activity log entries">
          <thead role="rowgroup"><tr role="row">{['Date & Time', 'Performed By', 'Action', 'Target / Record ID'].map(label => <th key={label} scope="col" role="columnheader">{label}</th>)}</tr></thead>
          <tbody role="rowgroup">{data.entries.map(entry => <tr key={entry.id} role="row">
            <td role="cell" data-label="Date & Time"><time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time></td>
            <td role="cell" data-label="Performed By"><Actor entry={entry}/></td>
            <td role="cell" data-label="Action"><ActionLabel entry={entry}/></td>
            <td role="cell" data-label="Target / Record ID"><span className={styles.targetType}>{entry.targetType}</span><span className={styles.record}>{entry.targetId || 'Record unavailable'}</span></td>
          </tr>)}</tbody>
        </table>
        {data.entries.length === 0 && <p role="status" className={styles.state}>{search.trim() ? 'No matching activity. Try another name, action, or record ID.' : 'No activity recorded yet.'}</p>}
        <footer className={styles.footer}>
          <p role="status">{data.total ? `Showing ${(data.page - 1) * data.pageSize + 1}–${(data.page - 1) * data.pageSize + data.entries.length} of ${data.total} activities` : '0 activities'}</p>
          <nav aria-label="Activity log pages"><button type="button" disabled={data.page <= 1} onClick={() => changePage(data.page - 1)}><ChevronLeft size={15} aria-hidden="true"/>Previous</button><span>Page {data.page} of {totalPages}</span><button type="button" disabled={data.page >= totalPages} onClick={() => changePage(data.page + 1)}>Next<ChevronRight size={15} aria-hidden="true"/></button></nav>
        </footer>
      </>}
    </div>
  </section>;
}
