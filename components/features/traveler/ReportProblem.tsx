'use client';

import { useRef, useState, type FormEvent } from 'react';
import { Flag } from 'lucide-react';

export function ReportProblem({ busy, onSubmit }: { busy: boolean; onSubmit: (title: string, details: string) => void | Promise<unknown> }) {
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);
  const input = 'mt-2 min-h-12 w-full border border-white/20 bg-[#071a16] px-4 py-3 text-base text-white';
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || inFlight.current) return;
    setFeedback(''); setFailed(false);
    inFlight.current = true; setSending(true);
    try {
      const result = await onSubmit(title.trim(), details.trim());
      if (result !== true) throw new Error('Your report could not be sent. Please try again.');
      setTitle(''); setDetails('');
      setFeedback('Your report was sent to the admin.');
    } catch (error) {
      setFailed(true);
      setFeedback(error instanceof Error ? error.message : 'Your report could not be sent. Please try again.');
    } finally { inFlight.current = false; setSending(false); }
  }
  return <form onSubmit={event => void submit(event)}>
    <Flag size={25} className="text-[#ffcf70]"/><h3 className="mt-5 text-2xl font-bold">Report a problem</h3>
    <p className="mt-3 text-sm leading-6 text-white/60">Tell the admin what went wrong so they can investigate. Please do not include passwords or payment details.</p>
    <label className="mt-6 block text-sm font-semibold">Subject<input required minLength={5} maxLength={120} value={title} onChange={event => setTitle(event.target.value)} className={input} placeholder="What do you need help with?"/></label>
    <label className="mt-5 block text-sm font-semibold">Details<textarea required minLength={10} maxLength={2000} rows={6} value={details} onChange={event => setDetails(event.target.value)} className={input} placeholder="Describe the issue and the steps that led to it."/></label>
    <button type="submit" disabled={busy || sending} className="mt-6 min-h-12 border border-white/30 px-5 py-3 text-sm font-bold hover:bg-white/10 disabled:opacity-50">{sending ? 'Sending…' : 'Send report'}</button>
    {feedback && <p role={failed ? 'alert' : 'status'} className={`mt-4 border-l-2 px-4 py-3 text-sm ${failed ? 'border-red-300 text-red-200' : 'border-emerald-300 text-emerald-200'}`}>{feedback}</p>}
  </form>;
}
