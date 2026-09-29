'use client';

import { useState, type FormEvent } from 'react';
import { Flag } from 'lucide-react';

export function ReportProblem({ busy, onSubmit }: { busy: boolean; onSubmit: (title: string, details: string) => void | Promise<unknown> }) {
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const input = 'mt-2 min-h-12 w-full border border-white/20 bg-[#071a16] px-4 py-3 text-base text-white';
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await onSubmit(title.trim(), details.trim());
    if (result === true) { setTitle(''); setDetails(''); }
  }
  return <form onSubmit={event => void submit(event)}>
    <Flag size={25} className="text-[#ffcf70]"/><h3 className="mt-5 text-2xl font-bold">Report a problem</h3>
    <p className="mt-3 text-sm leading-6 text-white/60">Tell the admin what went wrong so they can investigate. Please do not include passwords or payment details.</p>
    <label className="mt-6 block text-sm font-semibold">Subject<input required minLength={5} maxLength={120} value={title} onChange={event => setTitle(event.target.value)} className={input} placeholder="What do you need help with?"/></label>
    <label className="mt-5 block text-sm font-semibold">Details<textarea required minLength={10} maxLength={2000} rows={6} value={details} onChange={event => setDetails(event.target.value)} className={input} placeholder="Describe the issue and the steps that led to it."/></label>
    <button disabled={busy} className="mt-6 min-h-12 border border-white/30 px-5 py-3 text-sm font-bold hover:bg-white/10 disabled:opacity-50">{busy ? 'Sending…' : 'Send report'}</button>
  </form>;
}
