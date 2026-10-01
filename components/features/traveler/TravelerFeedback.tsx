'use client';

import { useState, type FormEvent } from 'react';
import { MessageSquareText, Star } from 'lucide-react';
import type { SavedTrip } from '@/lib/contracts';
import { handleResponse } from '@/services/api.service';

const CATEGORIES = ['Budget accuracy', 'Weather information', 'Itinerary quality', 'Route efficiency', 'Travel options', 'Other'] as const;

export function TravelerFeedback({ trips }: { trips: SavedTrip[] }) {
  const [tripId, setTripId] = useState('');
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('Itinerary quality');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage('');
    if (!tripId || rating < 1 || comment.trim().length < 10) { setError('Choose a saved trip and rating, then write at least 10 characters.'); return; }
    setBusy(true);
    try {
      const response = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tripId, rating, category, comment: comment.trim() }) });
      const result = await handleResponse<{ id: string; message: string }>(response);
      setMessage(result.message); setRating(0); setComment('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Feedback could not be submitted.'); }
    finally { setBusy(false); }
  }

  return <section className="grid gap-px border border-white/10 bg-white/10 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.45fr)]">
    <div className="bg-[#efe8d6] p-6 text-[#14231f] sm:p-9"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-[#48655c]"><MessageSquareText size={16}/>Help improve TravelMate</div><h2 className="mt-4 text-3xl font-black tracking-[-0.05em]">Tell us how your plan worked.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-[#52635e]">Rate a saved itinerary and tell the team what was useful or confusing. Your feedback is visible to TravelMate administrators.</p>
      {trips.length === 0 ? <p className="mt-8 border-l-2 border-amber-500 bg-white/60 p-4 text-sm">Save a trip first, then return here to give feedback about its itinerary.</p> : <form onSubmit={submit} className="mt-8 max-w-2xl space-y-5">
        <label className="block text-sm font-bold">Saved itinerary<select required value={tripId} onChange={(event) => setTripId(event.target.value)} className="mt-2 min-h-12 w-full border border-[#14231f]/25 bg-white px-3 outline-none focus-visible:ring-2 focus-visible:ring-amber-400"><option value="">Choose a saved trip</option>{trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.destination} · {trip.startDate} to {trip.endDate}</option>)}</select></label>
        <fieldset><legend className="text-sm font-bold">Overall rating</legend><div className="mt-2 flex gap-1" role="group" aria-label="Overall rating from 1 to 5 stars">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" aria-label={`${value} star${value === 1 ? '' : 's'}`} aria-pressed={rating === value} onClick={() => setRating(value)} className="grid size-11 place-items-center border border-[#14231f]/20 bg-white focus-visible:ring-2 focus-visible:ring-amber-400"><Star size={22} fill={value <= rating ? '#d79a22' : 'none'} className={value <= rating ? 'text-[#a6700d]' : 'text-[#7c8984]'}/></button>)}</div></fieldset>
        <label className="block text-sm font-bold">Category<select value={category} onChange={(event) => setCategory(event.target.value as (typeof CATEGORIES)[number])} className="mt-2 min-h-12 w-full border border-[#14231f]/25 bg-white px-3 outline-none focus-visible:ring-2 focus-visible:ring-amber-400">{CATEGORIES.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="block text-sm font-bold">Your feedback<textarea required minLength={10} maxLength={2000} rows={5} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="What should we keep or improve?" className="mt-2 w-full border border-[#14231f]/25 bg-white p-3 outline-none focus-visible:ring-2 focus-visible:ring-amber-400"/></label>
        {error && <p role="alert" className="text-sm font-semibold text-red-800">{error}</p>}{message && <p role="status" className="text-sm font-semibold text-emerald-800">{message}</p>}
        <button disabled={busy} className="min-h-12 bg-[#14231f] px-6 text-sm font-bold text-white hover:bg-[#31584b] disabled:opacity-50">{busy ? 'Sending feedback…' : 'Send feedback'}</button>
      </form>}
    </div><aside className="relative flex min-h-52 flex-col justify-end overflow-hidden bg-[#102824] p-7 sm:p-9"><div className="absolute inset-0 bg-[url('/mountain-hero-bg.png')] bg-cover bg-center opacity-25"/><div className="relative"><Star size={29} className="text-[#ffcf70]"/><p className="mt-6 max-w-xs text-2xl font-black leading-tight tracking-[-0.04em]">Your experience helps shape the next better trip.</p><p className="mt-3 text-sm leading-6 text-white/65">Feedback is tied to the saved plan you choose, so the team can understand its context.</p></div></aside>
  </section>;
}
