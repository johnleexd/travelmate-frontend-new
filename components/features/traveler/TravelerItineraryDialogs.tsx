'use client';

import { activityExpense } from '@/lib/generated/expense-ledger';
import { itineraryCostPresentation } from '@/lib/itinerary-day-presentation';
import { ExpenseEstimate } from './ExpenseEstimate';
import { ActivityText } from './ActivityText';
import { ActivityDetails } from './ActivityDetails';
import { shortWeatherWarning } from '@/lib/activity-presentation';
import styles from './DailyItineraryCard.module.css';

import { PlaceActions } from './PlaceActions';
import { NextStopCard } from './NextStopCard';
import { RecoverableActivityPhoto as ActivityPhoto } from '@/components/common/RecoverableActivityPhoto';
import { ActivityPhotoRecovery } from '@/components/common/ActivityPhotoRecovery';
import { GoogleActivityPhotos } from '@/components/common/GoogleActivityPhoto';
import { usePlacesPhotoView } from '@/components/common/PlacesPhotoMapBoundary';
import { mapStoredActivity } from '@/lib/generated/stored-trip-media';
import { Fragment, useMemo, useState, type FormEvent, type RefObject } from 'react';
import { BedDouble, BusFront, ChevronLeft, ChevronRight, RefreshCw, X } from 'lucide-react';
import { ReferenceAmount } from '@/components/common/ReferenceAmount';
import { formatMoney, currencyStep, type CurrencyCode } from '@/lib/domain';
import type { ExchangeRateQuote, WeatherData } from '@/lib/contracts';
import type { DayActivity, ItineraryResponse } from '@/services/api.service';
import { existingDestinationPhoto, savedDayTheme, storedActivityImage } from '@/lib/stored-trip-photos';
import { dailyCardEntries } from '@/lib/itinerary-day-presentation';
import { useActivityPhotoFallback } from '@/hooks/use-activity-photo-fallback';
import { photoPatches } from '@/services/activity-photo.service';

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
  nested?: boolean;
  error?: string;
};

export function ActivityEditorDialog({ editor, day, activity: rawActivity, currency, modalRef, titleRef, onClose, onSubmit, nested = false, error }: ActivityEditorDialogProps) {
  const activity = rawActivity ? mapStoredActivity(rawActivity as unknown as Record<string, unknown>) as unknown as DayActivity : undefined;
  return (
    <div ref={modalRef} className={`fixed inset-0 ${nested ? 'z-[110]' : 'z-50'} overflow-y-auto bg-black/80 p-3 sm:p-6`} role="dialog" aria-modal="true" aria-labelledby="activity-editor-title" aria-describedby="activity-editor-description" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form key={`${editor.dayIndex}-${editor.activityIndex ?? 'new'}`} onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); onSubmit(event.currentTarget); }} className="mx-auto mt-8 max-w-xl rounded-2xl border border-slate-700 bg-[#0b1626] p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-amber-300">Day {day.day} · {day.date}</p><h2 id="activity-editor-title" className="mt-1 text-xl font-bold">{activity ? 'Edit activity' : 'Add custom activity'}</h2><p id="activity-editor-description" className="mt-1 text-sm text-slate-400">Enter the total covering the recorded trip party (one traveler for Solo). Shared costs are counted once.</p></div><button type="button" onClick={onClose} aria-label="Close activity editor" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"><X size={18}/></button></div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2 text-xs font-medium text-slate-300">Activity title<input ref={titleRef} required maxLength={160} name="title" defaultValue={activity?.title || ''} placeholder="e.g. Visit the National Museum" className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-600 focus:border-amber-400"/></label>
          <label className="text-xs font-medium text-slate-300">Time<input required maxLength={30} name="time" defaultValue={activity?.time || '09:00 AM'} placeholder="09:00 AM" className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-amber-400"/></label>
          <label className="text-xs font-medium text-slate-300">Duration (minutes)<input type="number" min="15" max="720" step="1" name="durationMinutes" required={!activity || activity.durationMinutes !== undefined} defaultValue={activity ? activity.durationMinutes ?? '' : 60} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white"/></label><label className="text-xs font-medium text-slate-300">Travel buffer (minutes)<input type="number" min="0" max="480" step="1" name="travelMinutes" defaultValue={activity?.travelMinutes ?? 15} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white"/></label><label className="sm:col-span-2 text-xs font-medium text-slate-300">Location (optional, entered by you)<input name="location" maxLength={200} defaultValue={activity?.location || ''} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white"/></label><p className="sm:col-span-2 text-xs leading-5 text-slate-400">Times use the destination’s local clock. Scheduling buffers are unverified. Check actual routes and travel times; the schedule keeps a minimum planning buffer. Use Flexible for an unscheduled item.</p><label className="text-xs font-medium text-slate-300">Category<select required name="category" defaultValue={activity?.category || 'activity'} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-amber-400"><option value="activity">Activity</option><option value="food">Food</option><option value="transport">Transport</option><option value="accommodation">Accommodation</option><option value="misc">Miscellaneous</option></select></label>
          <label className="sm:col-span-2 text-xs font-medium text-slate-300">Estimated total for the recorded party ({currency})<input required type="number" min="0" max="10000000" step={currencyStep(currency)} name="estimatedCost" defaultValue={activity?.estimatedCost ?? 0} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-amber-400"/></label>
          <label className="sm:col-span-2 text-xs font-medium text-slate-300">Description<textarea maxLength={1000} name="description" defaultValue={activity?.description || ''} rows={4} placeholder="Add helpful details, location, or reminders." className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-600 focus:border-amber-400"/></label>
        </div>
        {error && <p role="alert" className="mt-4 rounded-lg border border-red-300/25 bg-red-300/10 p-3 text-sm text-red-200">{error}</p>}
        <p className="mt-4 text-xs leading-5 text-slate-400">Photos are optional and load separately. Use the exact place name in the title and its address in Location. Generic activities use a labeled illustrative photo when available. You can always save without a photo.</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-800">Cancel</button><button type="submit" className="min-h-11 rounded-lg bg-amber-400 px-5 py-2 text-sm font-extrabold text-slate-950 hover:bg-amber-300">{activity ? 'Save activity' : 'Add activity'}</button></div>
      </form>
    </div>
  );
}

type DayDetailsDialogProps = {
  weather?: WeatherData | null;
  draft?: boolean;
  visitTripId?: string | null;
  day: ItineraryResponse['days'][number];
  itinerary: ItineraryResponse;
  travelers: number;
  referenceCurrency: CurrencyCode;
  exchangeQuotes: Partial<Record<CurrencyCode, ExchangeRateQuote>>;
  photoRefreshDay: number | null;
  retryingDay: number | null;
  busy: boolean;
  modalRef: RefObject<HTMLDivElement | null>;
  closeRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onRefreshPhotos: (day: ItineraryResponse['days'][number]) => void;
  onFindActivities: (dayIndex: number) => void;
};

export function DayDetailsDialog({ weather, draft = false, visitTripId, day: storedDay, itinerary: storedItinerary, referenceCurrency, exchangeQuotes, photoRefreshDay, retryingDay, busy, modalRef, closeRef, onClose, onRefreshPhotos, onFindActivities }: DayDetailsDialogProps) {
  const photoDays = useMemo(() => [storedDay.day], [storedDay.day]);
  const selectedPlan = useMemo(() => ({ ...storedItinerary, days: storedItinerary.days.map(candidate => {
    if (candidate.day !== storedDay.day || candidate.date !== storedDay.date) return candidate;
    // storedDay is the workspace's already selected photo view. Retain those
    // photo-only replacements when opening the dialog, without searching again.
    const replacements = candidate.activities.flatMap((activity, index) => activity.imageUrl && activity.imageUrl !== storedDay.activities[index]?.imageUrl ? [{ index, imageUrl: activity.imageUrl }] : []);
    const patches = photoPatches(candidate, storedDay, replacements);
    return patches.length ? { ...candidate, imageUrl: storedDay.imageUrl || candidate.imageUrl, imageAttribution: storedDay.imageAttribution || candidate.imageAttribution, activities: candidate.activities.map((activity, index) => {
      const patch = patches.find(item => item.index === index);
      return patch ? { ...activity, imageUrl: patch.imageUrl, imageAttribution: patch.imageAttribution } : activity;
    }) } : candidate;
  }) }), [storedItinerary, storedDay]);
  const { itinerary, onPhotoFailure, googlePhotos, onGooglePhotoFailure } = useActivityPhotoFallback(selectedPlan, photoDays, visitTripId, draft);
  usePlacesPhotoView(Object.keys(googlePhotos).length > 0);
  const day = itinerary.days.find(candidate => candidate.day === storedDay.day) || storedDay;
  const [activeActivityIndex, setActiveActivityIndex] = useState(0);
  const dayIndex = itinerary.days.findIndex(candidate => candidate.day === day.day);
  const { activities: visits, allowances } = dailyCardEntries(itinerary, dayIndex);
  const activeActivity = visits[activeActivityIndex]?.activity;
  const hasPrice = (item: DayActivity) => activityExpense(item, itinerary.currency) !== null;
  const dayCost = itineraryCostPresentation(itinerary, dayIndex);
  const forecast = weather?.source !== 'unavailable' && weather?.forecastAvailable !== false ? weather?.forecast?.find(item=>item.date === day.date) : undefined;
  const alerts = [...new Set([forecast?.weatherAlert,day.weatherAlert].filter((value):value is string=>Boolean(value)))];
  const destinationPhoto = existingDestinationPhoto(itinerary);
  const heroImage = storedActivityImage(activeActivity?.imageUrl, activeActivity?.imageAttribution);
  const heroAttribution = heroImage ? activeActivity?.imageAttribution : destinationPhoto?.imageAttribution;
  const theme = savedDayTheme(day, itinerary.destination);
  const goToActivity = (direction: -1 | 1) => {
    const activityCount = visits.length;
    if (activityCount === 0) return;
    setActiveActivityIndex((current) => (current + direction + activityCount) % activityCount);
  };

  return (
    <GoogleActivityPhotos.Provider value={{ photos: googlePhotos, onFailure: onGooglePhotoFailure }}><ActivityPhotoRecovery.Provider value={onPhotoFailure}><div ref={modalRef} className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-black/80 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="day-dialog-title" aria-describedby="day-dialog-description" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="mx-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-md border border-slate-700 bg-[#07111f] shadow-2xl sm:max-h-[calc(100dvh-3rem)]">
        <div className="shrink-0"><ActivityPhoto showCredit={false} day={day.day} activityIndex={visits[activeActivityIndex]?.index} fallbackSrc={existingDestinationPhoto(itinerary, [activeActivity?.imageUrl || ""])?.imageUrl} fallbackAttribution={existingDestinationPhoto(itinerary, [activeActivity?.imageUrl || ""])?.imageAttribution} uncertainLocation={!!heroImage && !activeActivity?.place?.name && !heroAttribution?.illustrative} frameClassName="relative h-36 shrink-0 bg-slate-950" creditClassName="bg-slate-950 px-4 text-[10px] text-slate-200" eager src={heroImage || destinationPhoto?.imageUrl} attribution={heroAttribution} alt={heroImage ? `${activeActivity?.title || day.theme} in ${itinerary.destination}` : `Destination photo: ${itinerary.destination}`} sizes="(max-width: 900px) 100vw, 900px" className="object-contain">
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close day details" title="Close details" className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-md bg-slate-950/90 hover:bg-slate-800"><X size={20}/></button>
          {!heroImage && !googlePhotos[`${day.day}:${visits[activeActivityIndex]?.index}`] && destinationPhoto && <span className="absolute bottom-3 left-3 bg-slate-950/90 px-2 py-1 text-xs">Destination photo</span>}
          <span className="absolute left-3 top-3 bg-slate-950/90 px-3 py-2 text-sm font-bold text-amber-300">DAY {day.day}</span>
          <button type="button" disabled={visits.length < 2} onClick={() => goToActivity(-1)} aria-label="Previous activity" title="Previous activity" className="absolute left-3 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center bg-slate-950/90 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-35"><ChevronLeft size={21}/></button>
          <button type="button" disabled={visits.length < 2} onClick={() => goToActivity(1)} aria-label="Next activity" title="Next activity" className="absolute right-3 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center bg-slate-950/90 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-35"><ChevronRight size={21}/></button>
          <span className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-950/90 px-3 py-1 text-xs text-white" aria-live="polite">{visits.length ? `Activity ${activeActivityIndex + 1} of ${visits.length}` : 'No activities'}</span>
        </ActivityPhoto></div>
        <div className={`${styles.modalContent} min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6`}>
          <div className="flex flex-wrap justify-between gap-3"><div><h2 id="day-dialog-title" className="text-xl font-bold">Day {day.day}: {theme}</h2><p id="day-dialog-description" className="text-sm text-slate-400">{day.date} · {itinerary.destination}</p></div><div className="text-right"><strong className="font-mono text-lg">{dayCost.amount === undefined ? "Estimate unavailable" : formatMoney(dayCost.amount, itinerary.currency)}</strong><ReferenceAmount amount={dayCost.amount ?? 0} currency={itinerary.currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes}/><p className="flex items-center justify-end gap-1 text-xs text-emerald-200"><BusFront size={13}/>{dayCost.amountLabel}. Includes {formatMoney(dayCost.allowance,itinerary.currency)} in suggested allowances.</p><button type="button" disabled={photoRefreshDay === day.day} onClick={() => onRefreshPhotos(day)} className="mt-2 inline-flex items-center gap-1.5 rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-cyan-500 hover:text-cyan-200 disabled:opacity-50"><RefreshCw size={13} className={photoRefreshDay === day.day ? 'animate-spin' : ''}/>{photoRefreshDay === day.day ? 'Refreshing photos...' : 'Refresh activity photos'}</button></div></div>
          <div className="mt-3 text-xs leading-5"><p>Local time ({itinerary.grounding?.timeZone || 'Timezone unconfirmed'})</p><p>{forecast ? <>{forecast.description} · {forecast.tempMin}°–{forecast.tempMax}°C · Rain {forecast.precipitationProbability}%</> : 'Weather unavailable'}</p>{alerts.length > 0 && <p>{shortWeatherWarning(alerts)}</p>}</div>
          <details className={styles.details}><summary>Day details &amp; sources</summary><div className={styles.detailsBody}>{day.travelNote && <p>{day.travelNote}</p>}{day.planningReason && <p>{day.planningReason}</p>}{alerts.map(alert=><p key={alert}>{alert}</p>)}{weather && <p>Weather: {weather.source} · Retrieved {new Date(weather.fetchedAt).toLocaleString()}. {weather.forecastMessage}</p>}{day.crowdLevel && <p>Estimated crowd: {day.crowdLevel} · {day.crowdConfidence || "low"} confidence · {day.crowdSource || "estimated"}. {day.crowdNote} {day.crowdRecommendation}{day.crowdFetchedAt ? ' Recorded '+new Date(day.crowdFetchedAt).toLocaleString() : ''}{day.crowdRefreshAfter ? ' Refresh after '+new Date(day.crowdRefreshAfter).toLocaleString() : ''}</p>}</div></details>
          {!visits.length && <section className="mt-6 rounded-md border border-amber-300/30 bg-amber-300/[0.06] p-4" aria-label="Find activities for this day"><h3 className="font-bold text-amber-200">No daily activities yet</h3><p className="mt-2 text-sm leading-6 text-slate-300">Search for verified culture, museum, heritage, and local experience stops that fit this day. Your existing day details are preserved.</p><button type="button" disabled={busy || dayIndex < 0} onClick={() => onFindActivities(dayIndex)} className="mt-4 min-h-11 rounded border border-amber-300/50 px-4 text-sm font-bold text-amber-200 disabled:opacity-50">{retryingDay === dayIndex ? 'Finding culture activities…' : `Find culture activities for Day ${day.day}`}</button></section>}
          <ol className="mt-6 divide-y divide-slate-800 border-y border-slate-800">{visits.map(({ activity: item, index }, displayIndex) => <Fragment key={`${item.time}-${index}`}><li className={`grid grid-cols-[88px_1fr] gap-3 border-l-2 py-4 pl-3 transition-colors sm:grid-cols-[128px_1fr_auto] sm:items-center ${activeActivityIndex === displayIndex ? 'border-amber-300 bg-amber-300/[0.045]' : 'border-transparent'}`}>
            <figure className="min-w-0"><ActivityPhoto showCredit={false} day={day.day} activityIndex={index} fallbackSrc={existingDestinationPhoto(itinerary, [item.imageUrl || ""])?.imageUrl} fallbackAttribution={existingDestinationPhoto(itinerary, [item.imageUrl || ""])?.imageAttribution} frameClassName="relative aspect-[4/3] overflow-hidden rounded-md bg-slate-900" creditClassName="mt-1 text-[10px] text-slate-300 [overflow-wrap:anywhere]" src={storedActivityImage(item.imageUrl, item.imageAttribution) ? item.imageUrl : destinationPhoto?.imageUrl} attribution={storedActivityImage(item.imageUrl, item.imageAttribution) ? item.imageAttribution : destinationPhoto?.imageAttribution} alt={storedActivityImage(item.imageUrl, item.imageAttribution) ? `${item.title} in ${itinerary.destination}` : `Destination photo: ${itinerary.destination}`} sizes="128px" emptyMessage="Photo unavailable">{!storedActivityImage(item.imageUrl, item.imageAttribution) && !googlePhotos[`${day.day}:${index}`] && destinationPhoto && <span className="absolute left-1 top-1 rounded bg-slate-950/85 px-1 text-[8px] text-slate-200">Destination photo</span>}</ActivityPhoto></figure>
            <div><ActivityText item={item} showTime/><PlaceActions activity={item} destination={itinerary.destination} tripId={visitTripId} dayIndex={dayIndex} activityIndex={index}/><ActivityDetails travelers={itinerary.travelers} item={item} currency={itinerary.currency} destination={itinerary.destination}/></div>
            <div><ExpenseEstimate travelers={itinerary.travelers} item={item} currency={itinerary.currency} compact/>{hasPrice(item) && <ReferenceAmount amount={item.estimatedCost} currency={itinerary.currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes}/>}</div>
          </li>{visits[displayIndex + 1] && <NextStopCard from={item} to={visits[displayIndex + 1].activity}/>}</Fragment>)}</ol>
          {allowances.length > 0 && <details aria-label="Budget allowances" className="mt-5 rounded-md border border-slate-700 p-3"><summary className="cursor-pointer font-semibold">Budget allowances</summary>{allowances.map(({ activity: item, index }) => <article key={index} className="mt-3 border-t border-slate-700 pt-3 text-sm"><h4>{item.title}</h4><ExpenseEstimate travelers={itinerary.travelers} item={item} currency={itinerary.currency} compact/><ActivityDetails travelers={itinerary.travelers} item={item} currency={itinerary.currency} destination={itinerary.destination}/>{hasPrice(item) && <ReferenceAmount amount={item.estimatedCost} currency={itinerary.currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes}/>}</article>)}</details>}
          {itinerary.accommodation && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm"><div className="flex items-start gap-2 text-amber-200"><BedDouble size={17}/><span>{itinerary.accommodation.name} · {formatMoney(itinerary.accommodation.nightlyRate, itinerary.currency)}/night<ReferenceAmount amount={itinerary.accommodation.nightlyRate} currency={itinerary.currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes}/></span></div>{day.returnToStayAt && <strong>Return by {day.returnToStayAt}</strong>}</div>}
        </div>
      </div>
    </div></ActivityPhotoRecovery.Provider></GoogleActivityPhotos.Provider>
  );
}
