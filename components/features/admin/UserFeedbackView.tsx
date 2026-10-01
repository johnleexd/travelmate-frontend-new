'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, MessageSquareText, Star } from 'lucide-react';
import { handleResponse } from '@/services/api.service';

type Feedback = {
  id: string;
  rating: number;
  sentiment: 'Negative' | 'Neutral' | 'Positive';
  category: string;
  comment: string;
  createdAt: string;
  user: { id: string; name: string; email: string };
  trip: { id: string; destination: string; startDate: string; endDate: string };
};
type FeedbackPage = { total: number; page: number; pageSize: number; items: Feedback[] };

const selectClass = 'min-h-11 border border-[#14231f]/20 bg-white px-3 text-sm font-semibold text-[#14231f] outline-none focus-visible:ring-2 focus-visible:ring-amber-400';

export function UserFeedbackView() {
  const [rating, setRating] = useState('all');
  const [sentiment, setSentiment] = useState('all');
  const [range, setRange] = useState('all');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<FeedbackPage | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ rating, sentiment, range, page: String(page) });
    fetch(`/api/feedback?${query}`, { signal: controller.signal, cache: 'no-store' })
      .then((response) => handleResponse<FeedbackPage>(response))
      .then((data) => { setResult(data); setError(''); })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Feedback could not be loaded.'); });
    return () => controller.abort();
  }, [rating, sentiment, range, page]);

  const changeFilter = (setter: (value: string) => void, value: string) => { setter(value); setPage(1); setResult(null); setSelected(null); };
  const first = result && result.total > 0 ? (result.page - 1) * result.pageSize + 1 : 0;
  const last = result ? Math.min(result.page * result.pageSize, result.total) : 0;
  const chosen = result?.items.find((item) => item.id === selected);

  return <section data-admin-card className="border border-white/10 bg-[#efe8d6] text-[#14231f]">
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#14231f]/15 p-5 sm:p-7">
      <div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#48655c]"><MessageSquareText size={16}/>Traveler voices</div><h2 className="mt-2 text-2xl font-black tracking-[-0.04em] sm:text-3xl">User feedback</h2><p className="mt-2 text-sm text-[#52635e]">Ratings and comments about saved TravelMate itineraries. Sentiment follows the selected rating.</p></div>
      <span className="border border-[#14231f]/20 px-3 py-2 text-sm font-bold">{result?.total.toLocaleString() ?? '—'} entries</span>
    </div>
    <div className="flex flex-wrap gap-3 border-b border-[#14231f]/15 p-5 sm:px-7">
      <label className="grid gap-1 text-xs font-bold text-[#48655c]">Rating<select aria-label="Filter by rating" className={selectClass} value={rating} onChange={(event) => changeFilter(setRating, event.target.value)}><option value="all">All ratings</option>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} stars</option>)}</select></label>
      <label className="grid gap-1 text-xs font-bold text-[#48655c]">Sentiment<select aria-label="Filter by sentiment" className={selectClass} value={sentiment} onChange={(event) => changeFilter(setSentiment, event.target.value)}><option value="all">All sentiment</option><option value="positive">Positive</option><option value="neutral">Neutral</option><option value="negative">Negative</option></select></label>
      <label className="grid gap-1 text-xs font-bold text-[#48655c]">Date range<select aria-label="Filter by date range" className={selectClass} value={range} onChange={(event) => changeFilter(setRange, event.target.value)}><option value="all">All time</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option></select></label>
    </div>
    {error && <div role="alert" className="m-5 border-l-2 border-red-600 bg-red-50 p-4 text-sm text-red-900">{error}<button className="ml-3 underline" onClick={() => { setResult(null); setPage((value) => value); }}>Try again</button></div>}
    {!result && !error && <p role="status" className="p-7 text-sm text-[#52635e]">Loading feedback…</p>}
    {result && result.items.length === 0 && <div className="p-10 text-center"><MessageSquareText size={28} className="mx-auto text-[#48655c]"/><h3 className="mt-4 text-lg font-bold">No feedback matches these filters.</h3><p className="mt-2 text-sm text-[#52635e]">Travelers can leave feedback from their dashboard after saving a trip.</p></div>}
    {result && result.items.length > 0 && <>
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-[#14231f] text-[11px] uppercase tracking-[0.1em] text-white/75"><tr><th className="px-5 py-4">Feedback ID</th><th className="px-4 py-4">User</th><th className="px-4 py-4">Itinerary</th><th className="px-4 py-4">Rating</th><th className="px-4 py-4">Sentiment</th><th className="px-4 py-4">Category</th><th className="px-4 py-4">Comment</th><th className="px-4 py-4">Date</th></tr></thead><tbody>{result.items.map((item) => <tr key={item.id} className="border-b border-[#14231f]/12 align-top hover:bg-white/45"><td className="px-5 py-4 font-mono text-xs font-bold">FB-{item.id.slice(0, 8).toUpperCase()}</td><td className="px-4 py-4"><strong className="block">{item.user.name}</strong><span className="block max-w-36 truncate text-xs text-[#52635e]" title={item.user.email}>{item.user.email}</span></td><td className="px-4 py-4"><button type="button" aria-expanded={selected === item.id} onClick={() => setSelected(selected === item.id ? null : item.id)} className="max-w-40 text-left font-semibold text-[#31584b] underline underline-offset-4 hover:text-[#14231f]">{item.trip.destination}</button></td><td className="px-4 py-4"><span aria-label={`${item.rating} out of 5 stars`} className="inline-flex items-center gap-1 whitespace-nowrap font-bold text-[#8d6300]"><Star size={14} fill="currentColor"/>{item.rating}/5</span></td><td className="px-4 py-4"><span className={`inline-block px-2 py-1 text-xs font-bold ${item.sentiment === 'Positive' ? 'bg-emerald-100 text-emerald-900' : item.sentiment === 'Negative' ? 'bg-red-100 text-red-900' : 'bg-stone-200 text-stone-800'}`}>{item.sentiment}</span></td><td className="px-4 py-4">{item.category}</td><td className="max-w-72 px-4 py-4"><span className="line-clamp-2">{item.comment}</span></td><td className="whitespace-nowrap px-4 py-4 text-xs text-[#52635e]">{new Date(item.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table></div>
      {chosen && <aside className="border-t border-[#14231f]/15 bg-white/55 p-5 sm:p-7"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#52635e]">Itinerary context · {chosen.trip.id.slice(0, 8)}</p><h3 className="mt-2 text-xl font-black">{chosen.trip.destination}</h3><p className="mt-1 text-sm text-[#52635e]">{chosen.trip.startDate} to {chosen.trip.endDate} · Feedback from {chosen.user.name}</p><p className="mt-4 whitespace-pre-wrap text-sm leading-6">{chosen.comment}</p></aside>}
    </>}
    {result && <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#14231f]/15 p-5 text-sm sm:px-7"><span>Showing {first}–{last} of {result.total.toLocaleString()} feedback entries</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => { setResult(null); setPage(page - 1); }} className="inline-flex min-h-10 items-center gap-1 border border-[#14231f]/20 px-3 font-bold disabled:opacity-40"><ChevronLeft size={16}/>Previous</button><button type="button" disabled={last >= result.total} onClick={() => { setResult(null); setPage(page + 1); }} className="inline-flex min-h-10 items-center gap-1 border border-[#14231f]/20 px-3 font-bold disabled:opacity-40">Next<ChevronRight size={16}/></button></div></div>}
  </section>;
}
