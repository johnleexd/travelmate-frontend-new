'use client';
import { useEffect, useRef, useState } from 'react';
import { Star } from 'lucide-react';
import type { FeedbackCategory, FeedbackSubmissionResponse } from '@/lib/contracts';
import { FEEDBACK_CATEGORY_LABELS } from '@/lib/feedback';
import { handleResponse } from '@/services/api.service';

export function TripFeedbackButton({ itineraryId, destination }: { itineraryId: string; destination: string }) {
  const [open, setOpen] = useState(false);
  return <section className="mb-5 w-full"><button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)} className="min-h-11 border border-[#ffcf70]/50 px-4 py-2 text-sm font-bold text-[#ffcf70] hover:bg-[#ffcf70]/10">Rate this trip</button>{open && <TripFeedbackForm key={itineraryId} itineraryId={itineraryId} destination={destination}/>}</section>;
}

export function TripFeedbackForm({ itineraryId, destination }: { itineraryId: string; destination: string }) {
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState<FeedbackCategory>('budget_accuracy');
  const [comment, setComment] = useState('');
  const [existing, setExisting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const sending = useRef(false);
  const input = 'mt-2 min-h-11 w-full border border-[#17332c]/25 bg-white px-3 py-2 text-base text-[#102622] focus:outline-[#b78016]';
  useEffect(() => {
    const controller = new AbortController(); let current = true;
    void fetch(`/api/feedback/itinerary/${encodeURIComponent(itineraryId)}`, { cache: 'no-store', signal: controller.signal }).then(handleResponse<{ result: FeedbackSubmissionResponse['result'] | null }>).then(({ result }) => {
      if (!current) return;
      if (result) { setRating(result.rating); setCategory(result.category); setComment(result.comment); setExisting(true); }
      setLoaded(true); setLoading(false);
    }).catch((error: unknown) => { if (current && !controller.signal.aborted) { setError(error instanceof Error ? error.message : 'Could not load your feedback.'); setLoading(false); } });
    return () => { current = false; controller.abort(); };
  }, [itineraryId, revision]);
  return <form aria-label={`Feedback for ${destination}`} className="mt-4 border border-[#17332c]/20 bg-[#f2efe5] p-5 text-[#102622] sm:p-6" onSubmit={async event => {
    event.preventDefault(); if (sending.current || !loaded) return;
    setError(''); setMessage('');
    if (!rating) { setError('Rating: choose between 1 and 5 stars.'); return; }
    if (comment.trim().length < 10) { setError('Comment: enter at least 10 characters.'); return; }
    sending.current = true; setBusy(true);
    try {
      await handleResponse<FeedbackSubmissionResponse>(await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itineraryId, rating, category, comment: comment.trim() }) }));
      setExisting(true); setMessage('Your feedback is saved and available to the admin. You can update it here.');
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save feedback. Please try again.'); }
    finally { sending.current = false; setBusy(false); }
  }}>
    <h4 className="text-lg font-bold">{existing ? 'Your trip feedback' : 'Rate this trip'}</h4>
    <p className="mt-2 text-sm text-[#4f6862]">{destination}. Share what worked and what could improve. Please omit sensitive personal details.</p>
    {loading && <p role="status" className="mt-4 text-sm">Loading your feedback…</p>}
    {loaded && <fieldset disabled={busy} className="mt-4 space-y-4">
      <fieldset><legend className="text-sm font-bold">Rating</legend><div role="radiogroup" aria-label="Rating" className="mt-2 flex flex-wrap gap-1">{[1,2,3,4,5].map(value => <label key={value} className="relative grid h-11 w-11 cursor-pointer place-items-center hover:bg-[#ffcf70]/20"><input type="radio" name="rating" aria-label={`${value} star${value === 1 ? '' : 's'}`} value={value} checked={rating === value} onChange={() => setRating(value)} className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"/><Star aria-hidden="true" size={30} fill={value <= rating ? '#ffcf70' : 'none'} className="pointer-events-none text-[#6a571c] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2"/></label>)}</div><p className="mt-1 text-xs text-[#4f6862]">{rating ? `${rating} out of 5 stars` : 'Choose a star rating.'}</p></fieldset>
      <label className="block text-sm font-bold">Category<select aria-label="Category" required value={category} onChange={event => setCategory(event.target.value as FeedbackCategory)} className={input}>{Object.entries(FEEDBACK_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="block text-sm font-bold">Feedback comment<textarea required minLength={10} maxLength={2000} rows={4} value={comment} onChange={event => setComment(event.target.value)} className={input}/></label>
      <p className="text-xs text-[#4f6862]">10–2000 characters. One feedback entry per saved trip.</p>
    </fieldset>}
    {error && <p role="alert" className="mt-3 text-sm text-[#9b2929]">{error}</p>}
    {!loaded && !loading && <button type="button" className="mt-4 min-h-11 border border-[#17332c]/25 px-4" onClick={() => { setError(''); setLoading(true); setRevision(value => value + 1); }}>Retry feedback</button>}
    {message && <p role="status" className="mt-3 text-sm text-[#145646]">{message}</p>}
    {loaded && <button disabled={busy} className="mt-4 min-h-11 bg-[#102622] px-5 py-3 text-sm font-bold text-[#f2efe5] hover:bg-[#24483e] disabled:opacity-50">{busy ? 'Saving…' : existing ? 'Update Feedback' : 'Submit Feedback'}</button>}
  </form>;
}
