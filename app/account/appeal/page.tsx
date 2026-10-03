'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { handleResponse, isAuthenticationError } from '@/services/api.service';
import type { ModerationItem, Notification, PublicUser } from '@/lib/contracts';
import { AccountDetailsSkeleton } from '@/components/common/ContentSkeletons';

type AppealData = { user: PublicUser; appeals: ModerationItem[]; notifications: Notification[] };

export default function AppealPage() {
  const router = useRouter();
  const [data, setData] = useState<AppealData | null>(null);
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    const response = await fetch('/api/account/appeal', { cache: 'no-store' });
    setData(await handleResponse<AppealData>(response));
  }, []);
  const handleLoadError = useCallback((error: unknown) => {
    if (isAuthenticationError(error)) router.replace('/?auth_error=unauthenticated');
    else setLoadError(error instanceof Error ? error.message : 'Could not load your appeal.');
  }, [router]);
  useEffect(() => {
    const load = () => { void refresh().then(() => setLoadError('')).catch(handleLoadError); };
    load();
    const interval = window.setInterval(load, 30_000);
    window.addEventListener('focus', load);
    return () => { window.clearInterval(interval); window.removeEventListener('focus', load); };
  }, [refresh, handleLoadError]);
  const pending = data?.appeals.some(appeal => appeal.status === 'pending');
  return <main className="min-h-screen bg-[#0b1d1a] px-4 py-8 text-white sm:px-6">
    <div className="mx-auto max-w-3xl">
      <header className="flex items-center justify-between gap-4 border-b border-white/15 pb-5"><Link href="/" className="text-xl font-bold text-[#ffcf70]">TravelMate</Link><button type="button" className="min-h-11 border border-white/20 px-4 text-sm" onClick={async () => { await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) }); router.replace('/'); }}>Sign out</button></header>
      <h1 className="mt-8 text-3xl font-bold">{data?.user.accountStatus === 'active' ? 'Your account access is restored' : 'Account suspension & appeal'}</h1>
      <p className="mt-3 text-sm leading-6 text-white/65">{data?.user.accountStatus === 'active' ? 'You can return to trip planning. Your appeal history and account notices are below.' : 'Your trip-planning access is paused. Your saved trips are preserved. Read your account notices and explain why you believe your account should be restored.'}</p>
      {message && <p role="status" className="mt-5 border-l-2 border-[#ffcf70] bg-white/5 p-4 text-sm">{message}</p>}
      {loadError && <div role="alert" className="mt-6 border border-red-300/30 bg-[#102622] p-5"><p className="text-sm text-red-200">{loadError}</p><button type="button" className="mt-4 min-h-11 bg-[#ffcf70] px-5 text-sm font-bold text-[#102824]" onClick={() => { setLoadError(''); void refresh().catch(handleLoadError); }}>Try again</button></div>}
      {!data ? !loadError && <AccountDetailsSkeleton /> : <>
        {data.user.accountStatus === 'active' ? <Link href="/dashboard" className="mt-6 inline-block bg-[#ffcf70] px-5 py-3 font-bold text-[#102824]">Return to dashboard</Link> : pending ? <div className="mt-6 border border-[#ffcf70]/40 bg-[#102622] p-5"><h2 className="font-bold text-[#ffcf70]">Appeal awaiting review</h2><p className="mt-2 text-sm text-white/70">An admin will review your message. Their decision will appear here. You already have a pending appeal.</p></div> : <form className="mt-6 border border-white/15 bg-[#102622] p-5" onSubmit={async event => {
          event.preventDefault(); if (busy) return;
          if (details.trim().length < 10) { setMessage('Enter at least 10 characters.'); return; }
          setBusy(true); setMessage('');
          try {
            await handleResponse(await fetch('/api/account/appeal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: details.trim() }) }));
            setDetails(''); setMessage('Your appeal was sent to the admins.');
            await refresh();
          } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not submit your appeal.'); }
          finally { setBusy(false); }
        }}><label className="block font-bold">Your appeal<textarea required minLength={10} maxLength={2000} rows={6} value={details} onChange={event => setDetails(event.target.value)} className="mt-3 block w-full border border-white/25 bg-[#071a16] p-3 text-base font-normal" placeholder="Explain what happened and why your account should be restored."/></label><p className="mt-2 text-right text-xs text-white/50">{details.length}/2000</p><button disabled={busy} className="mt-4 min-h-11 bg-[#ffcf70] px-5 font-bold text-[#102824] disabled:opacity-50">{busy ? 'Sending…' : 'Send appeal'}</button></form>}
        <section className="mt-8"><h2 className="text-xl font-bold">Your appeals</h2>{data.appeals.length === 0 ? <p className="mt-3 text-sm text-white/60">No appeals submitted yet.</p> : data.appeals.map(appeal => <article key={appeal.id} className="mt-3 border border-white/15 bg-[#102622] p-5"><p className="font-bold capitalize text-[#ffcf70]">{appeal.status === 'pending' ? 'Awaiting review' : appeal.status}</p><time className="mt-2 block text-xs text-white/50">{new Date(appeal.createdAt).toLocaleString()}</time><p className="mt-3 whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]">{appeal.details}</p></article>)}</section>
        <section className="mt-8"><h2 className="text-xl font-bold">Account notices & decisions</h2>{data.notifications.map(notice => <details key={notice.id} className="mt-3 border border-white/15 bg-[#102622] p-5" open={notice.title.startsWith('Appeal') || notice.title.startsWith('Account suspended')}><summary className="cursor-pointer font-bold [overflow-wrap:anywhere]">{notice.title}</summary><time className="mt-3 block text-xs text-white/50">{new Date(notice.createdAt).toLocaleString()}</time><p className="mt-3 whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]">{notice.body}</p></details>)}</section>
      </>}
    </div>
  </main>;
}
