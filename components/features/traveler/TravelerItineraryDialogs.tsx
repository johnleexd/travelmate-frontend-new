'use client';

import Image from 'next/image';
import { useState, type FormEvent, type RefObject } from 'react';
import { BedDouble, BusFront, ChevronLeft, ChevronRight, Clock3, MapPin, RefreshCw, X } from 'lucide-react';
import { ReferenceAmount } from '@/components/common/ReferenceAmount';
import { formatMoney, ZERO_DECIMAL_CURRENCIES, type CurrencyCode } from '@/lib/domain';
import type { ExchangeRateQuote } from '@/lib/contracts';
import type { DayActivity, ItineraryResponse } from '@/services/api.service';
import { verifiedPlaceImage } from '@/lib/place-image';

type ActivityEditor = { dayIndex: number; activityIndex: number | null };

type ActivityEditorDialogProps = {
  editor: ActivityEditor;
  day: ItineraryResponse['days'][number];
  activity?: DayActivity;
  currency: CurrencyCode;
  modalRef: RefObject<HTMLDivElement | null>;
  titleRef: RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onSubmit: (form: HTMLFormElement) => void;
};

export function ActivityEditorDialog({ editor, day, activity, currency, modalRef, titleRef, onClose, onSubmit }: ActivityEditorDialogProps) {
  return (
    <div ref={modalRef} className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="activity-editor-title" aria-describedby="activity-editor-description" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form key={`${editor.dayIndex}-${editor.activityIndex ?? 'new'}`} onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); onSubmit(event.currentTarget); }} className="mx-auto mt-8 max-w-xl rounded-2xl border border-slate-700 bg-[#0b1626] p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-amber-300">Day {day.day} · {day.date}</p><h2 id="activity-editor-title" className="mt-1 text-xl font-bold">{activity ? 'Edit activity' : 'Add custom activity'}</h2><p id="activity-editor-description" className="mt-1 text-sm text-slate-400">Costs are entered for the whole group and totals update automatically.</p></div><button type="button" onClick={onClose} aria-label="Close activity editor" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"><X size={18}/></button></div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2 text-xs font-medium text-slate-300">Activity title<input ref={titleRef} required maxLength={160} name="title" defaultValue={activity?.title || ''} placeholder="e.g. Visit the National Museum" className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-600 focus:border-amber-400"/></label>
          <label className="text-xs font-medium text-slate-300">Time<input required maxLength={30} name="time" defaultValue={activity?.time || '09:00 AM'} placeholder="09:00 AM" className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-amber-400"/></label>
          <label className="text-xs font-medium text-slate-300">Category<select required name="category" defaultValue={activity?.category || 'activity'} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-amber-400"><option value="activity">Activity</option><option value="food">Food</option><option value="transport">Transport</option><option value="accommodation">Accommodation</option><option value="misc">Miscellaneous</option></select></label>
          <label className="sm:col-span-2 text-xs font-medium text-slate-300">Estimated group cost ({currency})<input required type="number" min="0" max="10000000" step={ZERO_DECIMAL_CURRENCIES.includes(currency) ? '1' : '0.01'} name="estimatedCost" defaultValue={activity?.estimatedCost ?? 0} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-amber-400"/></label>
          <label className="sm:col-span-2 text-xs font-medium text-slate-300">Description<textarea maxLength={1000} name="description" defaultValue={activity?.description || ''} rows={4} placeholder="Add helpful details, location, or reminders." className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-600 focus:border-amber-400"/></label>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-800">Cancel</button><button type="submit" className="min-h-11 rounded-lg bg-amber-400 px-5 py-2 text-sm font-extrabold text-slate-950 hover:bg-amber-300">{activity ? 'Save activity' : 'Add activity'}</button></div>
      </form>
    </div>
  );
}

type DayDetailsDialogProps = {
  day: ItineraryResponse['days'][number];
  itinerary: ItineraryResponse;
  travelers: number;
  referenceCurrency: CurrencyCode;
  exchangeQuotes: Partial<Record<CurrencyCode, ExchangeRateQuote>>;
  photoRefreshDay: number | null;
  modalRef: RefObject<HTMLDivElement | null>;
  closeRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onRefreshPhotos: (day: ItineraryResponse['days'][number]) => void;
};

export function DayDetailsDialog({ day, itinerary, travelers, referenceCurrency, exchangeQuotes, photoRefreshDay, modalRef, closeRef, onClose, onRefreshPhotos }: DayDetailsDialogProps) {
  const [activeActivityIndex, setActiveActivityIndex] = useState(0);
  const activeActivity = day.activities[activeActivityIndex];
  const heroImage = verifiedPlaceImage(activeActivity?.imageUrl);
  const heroAttribution = heroImage ? activeActivity?.imageAttribution : undefined;
  const goToActivity = (direction: -1 | 1) => {
    const activityCount = day.activities.length;
    if (activityCount === 0) return;
    setActiveActivityIndex((current) => (current + direction + activityCount) % activityCount);
  };

  return (
    <div ref={modalRef} className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-black/80 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="day-dialog-title" aria-describedby="day-dialog-description" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="mx-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-md border border-slate-700 bg-[#07111f] shadow-2xl sm:max-h-[calc(100dvh-3rem)]">
        <div className="relative h-[38dvh] max-h-[420px] min-h-[200px] shrink-0 bg-slate-950">
          {heroImage ? <Image src={heroImage} alt={`${activeActivity?.title || day.theme} in ${itinerary.destination}`} fill sizes="(max-width: 900px) 100vw, 900px" className="object-contain" /> : <div className="grid h-full place-items-center text-center text-sm text-slate-500"><span><MapPin className="mx-auto mb-2"/>No verified place photo available.</span></div>}
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close day details" title="Close details" className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-md bg-slate-950/90 hover:bg-slate-800"><X size={20}/></button>
          <span className="absolute left-3 top-3 bg-slate-950/90 px-3 py-2 text-sm font-bold text-amber-300">DAY {day.day}</span>
          <button type="button" disabled={day.activities.length < 2} onClick={() => goToActivity(-1)} aria-label="Previous activity" title="Previous activity" className="absolute left-3 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center bg-slate-950/90 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-35"><ChevronLeft size={21}/></button>
          <button type="button" disabled={day.activities.length < 2} onClick={() => goToActivity(1)} aria-label="Next activity" title="Next activity" className="absolute right-3 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center bg-slate-950/90 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-35"><ChevronRight size={21}/></button>
          <span className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-950/90 px-3 py-1 text-xs text-white" aria-live="polite">{day.activities.length ? `Activity ${activeActivityIndex + 1} of ${day.activities.length}` : 'No activities'}</span>
          {heroAttribution && <a href={heroAttribution.sourceUrl} target="_blank" rel="noreferrer" title={`${heroAttribution.creator} · ${heroAttribution.license}`} className="absolute right-3 top-14 max-w-[65%] truncate rounded bg-slate-950/85 px-2 py-1 text-[10px] text-slate-200">Photo: {heroAttribution.creator} · {heroAttribution.license}</a>}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          {activeActivity && <div aria-live="polite" className="mb-5 border-b border-slate-700 pb-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-200 sm:text-xs">{activeActivity.time} · {activeActivity.category}</p>
                <h3 className="mt-1 break-words text-base font-bold text-white sm:text-lg">{activeActivity.title}</h3>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-300">{activeActivity.description}</p>
              </div>
              <div className="shrink-0 sm:text-right">
                <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400 sm:text-[10px]">Estimated price</span>
                <p className="font-mono text-xs font-semibold text-white sm:text-sm">{travelers > 1 && activeActivity.unitCost !== undefined ? `${formatMoney(activeActivity.unitCost, itinerary.currency)}/person` : formatMoney(activeActivity.estimatedCost, itinerary.currency)}</p>
                {travelers > 1 && activeActivity.unitCost !== undefined && <p className="font-mono text-[9px] text-slate-400 sm:text-[10px]">{formatMoney(activeActivity.estimatedCost, itinerary.currency)} group</p>}
                <ReferenceAmount amount={activeActivity.estimatedCost} currency={itinerary.currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes} className="block text-[9px] font-normal text-cyan-200/75 sm:text-[10px]" />
              </div>
            </div>
          </div>}
          <div className="flex flex-wrap justify-between gap-3"><div><h2 id="day-dialog-title" className="text-xl font-bold">Day {day.day}: {day.theme}</h2><p id="day-dialog-description" className="text-sm text-slate-400">{day.date} · {itinerary.destination}</p></div><div className="text-right"><strong className="font-mono text-lg">{formatMoney(day.totalCost, itinerary.currency)}</strong><ReferenceAmount amount={day.totalCost} currency={itinerary.currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes}/><p className="flex items-center justify-end gap-1 text-xs text-emerald-200"><BusFront size={13}/>Ride/boat fare {formatMoney(day.rideFare || 0, itinerary.currency)}</p><ReferenceAmount amount={day.rideFare || 0} currency={itinerary.currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes}/><button type="button" disabled={photoRefreshDay === day.day} onClick={() => onRefreshPhotos(day)} className="mt-2 inline-flex items-center gap-1.5 rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-cyan-500 hover:text-cyan-200 disabled:opacity-50"><RefreshCw size={13} className={photoRefreshDay === day.day ? 'animate-spin' : ''}/>{photoRefreshDay === day.day ? 'Refreshing photos...' : 'Refresh activity photos'}</button></div></div>
          {day.travelNote && <p className="mt-4 flex items-start gap-2 border-l-2 border-cyan-400 pl-3 text-sm text-cyan-100"><Clock3 size={16} className="mt-0.5 shrink-0"/>{day.travelNote}</p>}
          {day.crowdLevel && <div className="mt-3 rounded-md border border-violet-900 bg-violet-950/30 px-3 py-3 text-xs leading-5 text-violet-200"><p><strong className="capitalize">{day.crowdLevel} estimated crowd.</strong> {day.crowdNote}</p>{day.crowdRecommendation && <p className="mt-2 border-t border-violet-800/50 pt-2 text-white/65"><strong>Planning recommendation:</strong> {day.crowdRecommendation}</p>}{day.crowdFetchedAt && <p className="mt-2 text-[10px] text-white/35">Estimated {new Date(day.crowdFetchedAt).toLocaleString()} · refresh after {day.crowdRefreshAfter ? new Date(day.crowdRefreshAfter).toLocaleString() : 'not recorded'}</p>}</div>}
          <div className="mt-6 divide-y divide-slate-800 border-y border-slate-800">{day.activities.map((item, index) => <article key={`${item.time}-${index}`} className={`grid grid-cols-[88px_1fr] gap-3 border-l-2 py-4 pl-3 transition-colors sm:grid-cols-[128px_1fr_auto] sm:items-center ${activeActivityIndex === index ? 'border-amber-300 bg-amber-300/[0.045]' : 'border-transparent'}`}>
            <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-slate-900">{verifiedPlaceImage(item.imageUrl) ? <Image src={verifiedPlaceImage(item.imageUrl)!} alt={`${item.title} in ${itinerary.destination}`} fill sizes="128px" className="object-cover" /> : <div className="grid h-full place-items-center px-2 text-center text-[10px] text-slate-500">Photo unavailable</div>}{item.imageAttribution && <a href={item.imageAttribution.sourceUrl} target="_blank" rel="noreferrer" title={`${item.imageAttribution.creator} · ${item.imageAttribution.license}`} className="absolute bottom-1 right-1 rounded bg-slate-950/85 px-1 text-[8px] text-slate-200">Photo info</a>}</div>
            <div><p className="text-xs uppercase text-cyan-300">{item.time} · {item.category}</p><h3 className="font-semibold">{item.title}</h3><p className="mt-1 text-xs leading-relaxed text-slate-400">{item.description}</p><p className="mt-2 font-mono text-sm sm:hidden">Estimated price: {travelers > 1 && item.unitCost !== undefined ? `${formatMoney(item.unitCost, itinerary.currency)}/person · ${formatMoney(item.estimatedCost, itinerary.currency)} group` : formatMoney(item.estimatedCost, itinerary.currency)}</p><ReferenceAmount amount={item.estimatedCost} currency={itinerary.currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes} className="sm:hidden block text-[10px] font-normal text-cyan-200/70"/></div>
            <p className="hidden text-right font-mono text-sm sm:block"><span className="text-xs uppercase tracking-wide text-slate-500">Estimated price</span><br/>{travelers > 1 && item.unitCost !== undefined ? <>{formatMoney(item.unitCost, itinerary.currency)}/person<small className="block text-slate-500">{formatMoney(item.estimatedCost, itinerary.currency)} group</small></> : <>{formatMoney(item.estimatedCost, itinerary.currency)}</>}<ReferenceAmount amount={item.estimatedCost} currency={itinerary.currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes}/></p>
          </article>)}</div>
          {itinerary.accommodation && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm"><div className="flex items-start gap-2 text-amber-200"><BedDouble size={17}/><span>{itinerary.accommodation.name} · {formatMoney(itinerary.accommodation.nightlyRate, itinerary.currency)}/night<ReferenceAmount amount={itinerary.accommodation.nightlyRate} currency={itinerary.currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes}/></span></div>{day.returnToStayAt && <strong>Return by {day.returnToStayAt}</strong>}</div>}
        </div>
      </div>
    </div>
  );
}
