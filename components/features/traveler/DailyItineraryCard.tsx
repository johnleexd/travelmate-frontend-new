import { ArrowLeft, BedDouble, Clock3, MapPin, Utensils, ChevronDown, ChevronRight, ChevronUp, CloudSun, Eye, Pencil, Plus, Trash2, TriangleAlert, WalletCards } from 'lucide-react';
import { Fragment, type RefObject } from 'react';
import { RecoverableActivityPhoto as ActivityPhoto } from '@/components/common/RecoverableActivityPhoto';
import { ActivityPhotoCredit } from '@/components/common/ActivityPhotoCredit';
import { ReferenceAmount } from '@/components/common/ReferenceAmount';
import type { DayActivity } from '@/lib/contracts';
import { formatMoney, partyEstimateLabel } from '@/lib/domain';
import { dailyCardEntries, itineraryCostPresentation } from '@/lib/itinerary-day-presentation';
import { existingDestinationPhoto, savedDayTheme, storedActivityImage } from '@/lib/stored-trip-photos';
import { timelineDuration, timelineSchedule } from '@/lib/trip-map-timeline';
import { PlaceActions } from './PlaceActions';
import type { ItineraryWorkspaceProps } from './ItineraryWorkspace';
import styles from './DailyItineraryCard.module.css';

type Props = Omit<ItineraryWorkspaceProps, 'manualDirty' | 'editingTripId' | 'onSave'> & { dayIndex: number; detail?: boolean; onViewItinerary?: (button: HTMLButtonElement) => void; onBack?: () => void; headingRef?: RefObject<HTMLHeadingElement | null> };

function priceLabel(item: DayActivity) {
  const evidence = item.priceEvidence;
  return !evidence ? 'Estimated cost — price unconfirmed' : evidence.status === 'provider-quote' ? 'Provider quote — recheck before booking' : evidence.status === 'unavailable' ? 'Price: Not available' : evidence.source === 'budget-allowance' ? 'Budget allowance — market price not available' : evidence.source === 'user-entered' ? 'User-entered estimate — not a confirmed price' : 'Estimate — not a confirmed price';
}

export function formatItineraryDate(value: string) {
  const date = new Date(value + 'T00:00:00');
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : value || 'Date unavailable';
}

export function DailyItineraryCard({ itinerary, dayIndex, weather, readOnly = false, busy, visitTripId, referenceCurrency, exchangeQuotes, onReorderActivity, onEditActivity, onRemoveActivity, onOpenDay, detail = false, onViewItinerary, onBack, headingRef, travelers }: Props) {
  const day = itinerary.days[dayIndex];
  const { activities, allowances, entryTotal, remainder, remainderLabel } = dailyCardEntries(itinerary, dayIndex);
  const forecast = weather?.source !== 'unavailable' && weather?.forecastAvailable !== false ? weather?.forecast?.find(item => item.date === day.date) : undefined;
  const alerts = [...new Set([forecast?.weatherAlert, day.weatherAlert].filter((alert): alert is string => Boolean(alert)))];
  const money = (amount: number) => formatMoney(amount, itinerary.currency);
  const photoAttribution = day.imageAttribution || day.activities.find(item => item.imageUrl === day.imageUrl && day.imageUrl)?.imageAttribution;
  const fallbackPhoto = existingDestinationPhoto(itinerary);
  const fallbackSource = storedActivityImage(day.imageUrl, photoAttribution) ? day.imageUrl : fallbackPhoto?.imageUrl;
  const fallbackCredit = fallbackSource === day.imageUrl ? photoAttribution : fallbackPhoto?.imageAttribution;
  const theme = savedDayTheme(day, itinerary.destination);
  const cost = itineraryCostPresentation(itinerary, dayIndex);
  const zone = itinerary.grounding?.timeZone || 'time zone reference unavailable';
  const suggested = !itinerary.manuallyEdited && (day.planningStatus === 'suggested' || day.activities.some(item => item.scheduleLabel === 'Suggested'));
  const localTime = `${itinerary.manuallyEdited ? 'Edited schedule · ' : suggested ? 'Suggested · ' : ''}Local time (${zone})`;
  const reference = (amount: number) => <ReferenceAmount amount={amount} currency={itinerary.currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes}/>;
  const blocks = itinerary.manuallyEdited ? [] : day.scheduleBlocks ?? [];
  const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  const timeBlock = (block: typeof blocks[number]) => <li key={`${block.kind}-${block.startMinutes}`} className={styles.scheduleBlock} data-schedule-block><Utensils size={19} aria-hidden="true"/><time>{clock(block.startMinutes)}–{clock(block.endMinutes)}</time> · {block.label}</li>;
  const controls = (item: DayActivity, index: number) => !readOnly && <div className={styles.controls}>
    {[{ label: 'earlier', direction: -1 as const, Icon: ChevronUp, disabled: index === 0 }, { label: 'later', direction: 1 as const, Icon: ChevronDown, disabled: index === day.activities.length - 1 }].map(control => <button type="button" key={control.label} disabled={busy || control.disabled} onClick={() => onReorderActivity(dayIndex, index, control.direction)} aria-label={`Move ${item.title} ${control.label}`} title={`Move ${control.label}`}><control.Icon size={16}/></button>)}
    <button type="button" disabled={busy} onClick={() => onEditActivity(dayIndex, index)} aria-label={`Edit ${item.title}`} title={`Edit ${item.title}`}><Pencil size={16}/></button>
    <button type="button" disabled={busy} onClick={() => onRemoveActivity(dayIndex, index)} aria-label={`Remove ${item.title}`} title={`Remove ${item.title}`} className={styles.delete}><Trash2 size={16}/></button>
  </div>;

  const activitySources = (item: DayActivity, index: number) => <details className={styles.details}><summary>Details &amp; sources</summary><div className={styles.detailsBody}><section key={`${item.title}-${index}`}><h4>{item.title} — details</h4><p>{amount(item)} · {priceLabel(item)}</p><p>{item.description}</p>{item.time && <p>Saved schedule: {item.time}</p>}{item.travelMinutes !== undefined && <p>{item.travelMinutes} min travel estimate</p>}
        <p>{item.place ? [item.place.address !== 'Not available' ? item.place.address : '', item.place.city, item.place.country].filter(Boolean).join(', ') : item.location || (item.category === 'activity' ? `Location unverified · ${itinerary.destination}` : 'Daily planning allowance')}</p>
        {item.priceEvidence && <><p>{item.priceEvidence.status === 'unavailable' ? 'Price unavailable - no provider quote recorded' : item.priceEvidence.quantity === 0 ? 'Included once in selected activity costs' : item.priceEvidence.unit === 'shared-fare' ? `${formatMoney(item.priceEvidence.unitAmount, item.priceEvidence.currency)} shared fare` : item.priceEvidence.unit === 'group' ? 'Whole-group amount' : `${formatMoney(item.priceEvidence.unitAmount, item.priceEvidence.currency)} per person × ${item.priceEvidence.participants} participant${item.priceEvidence.participants === 1 ? '' : 's'}`}</p><p>Cost basis: {item.priceEvidence.unit} · quantity {item.priceEvidence.quantity} · {item.priceEvidence.needsConfirmation ? 'needs confirmation' : 'recorded provider evidence'}</p><p>{item.priceEvidence.basis}</p><p>Source: {item.priceEvidence.source} · {new Date(item.priceEvidence.fetchedAt).toLocaleString()} · {item.priceEvidence.currency}</p>{item.priceEvidence.sourceUrl && <a href={item.priceEvidence.sourceUrl} target="_blank" rel="noreferrer">Price source</a>}</>}
        {item.place && <p><a href={item.place.sourceUrl} target="_blank" rel="noreferrer">{item.place.name}</a> · {item.place.city}, {item.place.country} · {item.place.placeId} · retrieved {new Date(item.place.fetchedAt).toLocaleString()}<br/>Opening hours: {item.place.openingHours}<br/>Address: {item.place.address}<br/>Coordinates: {item.place.latitude}, {item.place.longitude}</p>}
        <ActivityPhotoCredit credit={item.imageAttribution} className={styles.credit} cropped={false}/>
        {!detail && <><PlaceActions activity={item} destination={itinerary.destination} tripId={visitTripId} dayIndex={dayIndex} activityIndex={index} canRecord={!readOnly}/>{controls(item, index)}</>}
      </section></div></details>;
  const weatherLine = <span className={styles.weatherLine}><CloudSun size={20} aria-hidden="true"/><span>{forecast ? <>Forecast · {forecast.tempMin}°–{forecast.tempMax}°C{detail && <> · {forecast.description} · Rain {forecast.precipitationProbability}%</>}</> : <>Weather unavailable for {day.date}.</>}</span></span>;
  const amount = (item: DayActivity) => item.priceEvidence?.status === 'unavailable' || !Number.isFinite(item.estimatedCost) ? 'Price unavailable' : money(item.estimatedCost);
  const count = itinerary.travelers ?? travelers;
  const dayScope = `for ${count} traveler${count === 1 ? '' : 's'}`;
  const categories = [...new Set(day.activities.map(item => item.category))];

  return <article className={detail ? styles.detailPage : styles.card} aria-label={`Day ${day.day} ${detail ? 'details' : 'itinerary'}`} data-itinerary-day={day.day} data-daily-card={detail ? undefined : true} data-day-details={detail ? true : undefined}>
    {detail ? <><button type="button" onClick={onBack} data-itinerary-back="explicit-overview" className={styles.backButton}><ArrowLeft size={16}/>Back to itinerary</button><div className={styles.heading}><div><h2 ref={headingRef} tabIndex={-1}>Day {day.day}{theme ? `: ${theme}` : ''}</h2><time dateTime={day.date}>{formatItineraryDate(day.date)}</time></div><p className={styles.scheduleBadge}><Clock3 size={14}/>{localTime}</p></div></> : <div className={styles.heading}><div className={styles.dayTitle}><span className={styles.dayBadge} aria-hidden="true">{day.day}</span><div><h3>Day {day.day}</h3>{theme && <p>{theme}</p>}</div></div><div className={styles.dayMeta}><time dateTime={day.date}>{formatItineraryDate(day.date)}</time><span>{activities.length} {activities.length === 1 ? 'activity' : 'activities'}{allowances.length ? ` · ${allowances.length} budget entries` : ''}</span></div></div>}
    {!detail && <ul className={styles.activityGrid} aria-label={`Day ${day.day} activity summary`} data-overview-activities data-day-photos>{activities.length ? activities.map(({ activity: item, index }) => {
      const attribution = item.imageAttribution || (item.imageUrl === day.imageUrl ? photoAttribution : undefined);
      const activityImage = storedActivityImage(item.imageUrl, attribution);
      const schedule = timelineSchedule(item);
      return <li key={item.id || index} data-overview-activity-index={index} className={styles.overviewActivity}>
        <figure><ActivityPhoto fit="contain" day={day.day} activityIndex={index} fallbackSrc={existingDestinationPhoto(itinerary, [item.imageUrl || ''])?.imageUrl} fallbackAttribution={existingDestinationPhoto(itinerary, [item.imageUrl || ''])?.imageAttribution} uncertainLocation={!!activityImage && !item.place?.name && attribution?.photoType !== 'place' && !attribution?.illustrative} frameClassName={styles.overviewPhoto} creditClassName={styles.credit} src={activityImage || fallbackPhoto?.imageUrl} attribution={activityImage ? attribution : fallbackPhoto?.imageAttribution ? { ...fallbackPhoto.imageAttribution, photoType: 'destination' } : undefined} alt={activityImage ? item.place?.name || item.title : `Destination photo: ${itinerary.destination}`} sizes="(max-width: 640px) 100vw, (max-width: 1100px) 45vw, 33vw" emptyMessage="Activity photo unavailable" caption={<figcaption className={styles.overviewCaption}><h4>{item.title}</h4><p><MapPin size={15} aria-hidden="true"/>{item.place ? [item.place.city, item.place.country].filter(Boolean).join(', ') : item.location || `Location unverified · ${itinerary.destination}`}</p><p><Clock3 size={15} aria-hidden="true"/><span>{item.scheduleLabel && !itinerary.manuallyEdited ? `${item.scheduleLabel} · ` : suggested ? 'Suggested · ' : ''}{schedule.label}</span></p>{item.place && (!item.place.openingHours?.trim() || /confirmation|unavailable|not available|unknown/i.test(item.place.openingHours)) && <small>Opening hours need confirmation</small>}{!activityImage && fallbackPhoto && <small>Destination photo · Activity photo unavailable</small>}</figcaption>}/></figure>
        {activitySources(item, index)}
      </li>;
    }) : <li className={styles.empty}>No activities scheduled{day.planningReason && <p>{day.planningReason}</p>}</li>}</ul>}
    {detail && !activities.length && fallbackSource && <figure><ActivityPhoto fit="contain" frameClassName={styles.photo} creditClassName={styles.credit} src={fallbackSource} attribution={fallbackCredit} alt={`Destination photo: ${itinerary.destination}`} sizes="100vw" emptyMessage="No saved photo available for this day."/></figure>}
    {alerts.map(alert => <p key={alert} className={styles.alert}><TriangleAlert size={16}/><span>{alert}</span></p>)}
    {day.planningStatus && (detail || day.planningStatus !== 'suggested') && <p className={day.planningStatus === 'incomplete' && !itinerary.manuallyEdited ? styles.priceLabel : styles.meta}>{itinerary.manuallyEdited ? 'Edited schedule · Destination-local time' : day.planningStatus === 'incomplete' ? 'Incomplete itinerary — more places needed' : day.planningStatus === 'rest' ? 'Rest day selected by you' : day.planningStatus === 'travel' ? 'Travel day — arrival/departure time reserved' : `Suggested · Destination-local time${itinerary.grounding?.timeZone ? ` (${itinerary.grounding.timeZone})` : ' (time zone reference unavailable)'}`}</p>}
    {day.planningStatus === 'incomplete' && !itinerary.manuallyEdited && <p className={styles.meta}>{day.planningReason}</p>}
    <div className={styles.overviewFooter}>{weatherLine}<span className={styles.localTime}><Clock3 size={18} aria-hidden="true"/>{localTime}</span><div className={styles.total}><WalletCards size={18} aria-hidden="true"/><div>{cost.amount === undefined ? <p>Costs not confirmed</p> : <p>{cost.amountLabel}: <strong>{money(cost.amount)}</strong>{reference(cost.amount)}</p>}{cost.unpriced > 0 && <small>{cost.unpriced} {cost.unpriced === 1 ? 'expense' : 'expenses'} unpriced · costs need confirmation</small>}</div></div>{!detail && <button type="button" className={styles.viewButton} onClick={event => onViewItinerary?.(event.currentTarget)}>View day itinerary<ChevronRight size={17} aria-hidden="true"/></button>}</div>
    {!detail && (allowances.length > 0 || blocks.length > 0 || day.travelNote || day.theme && day.theme !== theme) && <details className={styles.overviewExtra}><summary>Daily allowances &amp; day notes</summary>{day.theme && day.theme !== theme && <p>Recorded day theme: {day.theme}</p>}{day.travelNote && <p>{day.travelNote}</p>}{blocks.map(block => <p key={`${block.kind}-${block.startMinutes}`}>{clock(block.startMinutes)}–{clock(block.endMinutes)} · {block.label}</p>)}{allowances.map(({ activity: item, index }) => <div key={item.id || index}><strong>{item.title}</strong><p>{item.time} · {amount(item)}</p>{activitySources(item, index)}</div>)}</details>}
    {detail && <>
    <h4 className={styles.sectionTitle}>Your activities</h4>
    {!activities.length ? <div className={styles.empty}><strong>No activities scheduled</strong>{day.planningStatus === 'rest' || day.planningStatus === 'travel' ? <p>{day.planningReason}</p> : /confirm|unsupported|no additional supported/i.test(day.theme + ' ' + (day.travelNote || '')) && <p>Places still need confirmation before visits can be scheduled.</p>}</div> : <ol className={styles.list} aria-label={`Day ${day.day} activities`}>{activities.map(({ activity: item, index }, displayIndex) => {
      const schedule = timelineSchedule(item);
      const previousStart = displayIndex ? timelineSchedule(activities[displayIndex - 1].activity).start ?? -1 : -1;
      const activityAttribution = item.imageAttribution || (item.imageUrl === day.imageUrl ? photoAttribution : undefined);
      return <Fragment key={item.id || `${item.title}-${index}`}>
      {blocks.filter(block => block.endMinutes <= (schedule.start ?? -1) && block.endMinutes > previousStart).map(timeBlock)}
      <li className={styles.activityCard} data-activity-index={index}>
        <span className={styles.time}>{item.scheduleLabel && !itinerary.manuallyEdited ? item.scheduleLabel + ' · ' : ''}{schedule.label}</span>
        <figure className={styles.activityPhoto}><ActivityPhoto day={day.day} activityIndex={index} fallbackSrc={existingDestinationPhoto(itinerary, [item.imageUrl || ""])?.imageUrl} fallbackAttribution={existingDestinationPhoto(itinerary, [item.imageUrl || ""])?.imageAttribution} uncertainLocation={!!storedActivityImage(item.imageUrl, activityAttribution) && !item.place?.name && activityAttribution?.photoType !== 'place' && !activityAttribution?.illustrative} fit="contain" frameClassName={styles.photo} creditClassName={styles.credit} src={storedActivityImage(item.imageUrl, activityAttribution) ? item.imageUrl : fallbackPhoto?.imageUrl} attribution={storedActivityImage(item.imageUrl, activityAttribution) ? activityAttribution : fallbackPhoto?.imageAttribution} caption={!storedActivityImage(item.imageUrl, activityAttribution) && fallbackPhoto ? <figcaption>Destination photo</figcaption> : undefined} alt={storedActivityImage(item.imageUrl, activityAttribution) ? item.place?.name || item.title : `Destination photo: ${itinerary.destination}`} sizes="(max-width: 600px) 100vw, 150px" emptyMessage="No saved photo available."/></figure>
        <div className={styles.activityMain}><h4>{item.title}</h4><p className={styles.location}><MapPin size={13} aria-hidden="true"/>{item.place ? [item.place.city, item.place.country].filter(Boolean).join(', ') : item.location || 'Location unverified'}</p>
          {item.description && <p className={styles.description}>{item.description}</p>}
          {schedule.duration !== undefined && <p className={styles.meta}><Clock3 size={13} className="mr-1 inline"/> {item.scheduleLabel && !itinerary.manuallyEdited ? 'Suggested duration: ' : 'Duration: '}{timelineDuration(schedule.duration)}</p>}
          {item.status && <p className={styles.meta}>{item.status}</p>}
          {item.travelMinutes !== undefined && item.travelMinutes > 0 && <p className={styles.meta}>Allow {item.travelMinutes} min travel from the previous stop (estimate).</p>}
          <div className={styles.placeActions}><PlaceActions activity={item} destination={itinerary.destination} tripId={visitTripId} dayIndex={dayIndex} activityIndex={index} canRecord={!readOnly}/></div>
          {activitySources(item, index)}
        </div>
        <div className={styles.activityCost}><div className={styles.priceBadge}><strong>{amount(item)}</strong><small>{item.priceEvidence?.status === 'provider-quote' ? 'Provider quote · recheck' : item.priceEvidence?.status === 'unavailable' ? 'Price unavailable' : 'Estimate · unverified'}</small></div><p className={styles.meta}>{item.priceEvidence ? 'group amount' : partyEstimateLabel(itinerary.partyType || 'solo')}</p>{item.priceEvidence?.status !== 'unavailable' && reference(item.estimatedCost)}{controls(item, index)}</div>
      </li></Fragment>;
    })}{blocks.filter(block => block.endMinutes > (timelineSchedule(activities.at(-1)!.activity).start ?? Infinity)).map(timeBlock)}</ol>}
    <section className={styles.budget} aria-label={`Day ${day.day} daily budget`}><div className={styles.budgetHeading}><h4><WalletCards size={18}/>Daily budget <small>(estimates {dayScope})</small></h4><p>Estimates are unverified and may vary.</p></div><dl className={styles.budgetSummary}>{categories.map(category => {
      const items = day.activities.filter(item => item.category === category);
      const available = items.filter(item => Number.isFinite(item.estimatedCost) && item.priceEvidence?.status !== 'unavailable');
      return <div key={category}><dt>{category === 'activity' ? 'Activities' : category === 'misc' ? 'Other costs' : category}</dt><dd>{available.length ? money(available.reduce((sum, item) => sum + item.estimatedCost, 0)) : 'Price unavailable'}</dd></div>;
    })}{remainder !== 0 && <div><dt>{remainderLabel}</dt><dd>{money(remainder)}</dd></div>}<div className={styles.budgetTotal}><dt>Total</dt><dd>{cost.amount === undefined ? 'Costs not confirmed' : money(day.totalCost)}</dd></div></dl><details className={styles.budgetEntries}><summary>Budget entries &amp; controls</summary><ul>{allowances.map(({ activity: item, index }) => <li key={`${item.title}-${index}`} className={styles.entry} data-budget-index={index}>
      <div className={styles.budgetLine}><span>{item.title}</span><strong>{amount(item)}</strong></div>{item.priceEvidence?.status !== 'unavailable' && reference(item.estimatedCost)}<p className={styles.priceLabel}>{priceLabel(item)}</p>
      <PlaceActions activity={item} destination={itinerary.destination} tripId={visitTripId} dayIndex={dayIndex} activityIndex={index} canRecord={!readOnly}/>{controls(item, index)}{activitySources(item, index)}
    </li>)}{remainder !== 0 && <li className={styles.entry}><div className={styles.budgetLine}><span>{remainderLabel}</span><strong>{money(remainder)}</strong></div><p className={styles.priceLabel}>Estimated allocation · see Details &amp; sources</p></li>}{!allowances.length && remainder === 0 && <li className={styles.entry}><p className={styles.meta}>No separate daily allowances recorded.</p></li>}</ul></details></section>
    <details className={styles.details}><summary>Details &amp; sources</summary><div className={styles.detailsBody}>
      {day.travelNote && <p>{day.travelNote}</p>}
      {itinerary.manuallyEdited && day.scheduleBlocks?.length ? <div><h4>Original suggested breaks</h4><p>These blocks describe the generated schedule and may differ from your edits.</p>{day.scheduleBlocks.map(block => <p key={`${block.kind}-${block.startMinutes}`}>{clock(block.startMinutes)}–{clock(block.endMinutes)} · {block.label}</p>)}</div> : null}
      {day.crowdLevel && <div><p>Estimated crowd: <strong className="capitalize">{day.crowdLevel}</strong> · {day.crowdConfidence || 'low'} confidence · not live data</p>{day.crowdNote && <p>{day.crowdNote}</p>}{day.crowdRecommendation && <p>{day.crowdRecommendation}</p>}{day.crowdFetchedAt && <p>Estimated {new Date(day.crowdFetchedAt).toLocaleString()}</p>}{day.crowdRefreshAfter && <p>Refresh after {new Date(day.crowdRefreshAfter).toLocaleString()}</p>}</div>}
      {weather && <div><h4>Weather sources</h4><p>{weather.source} · retrieved {new Date(weather.fetchedAt).toLocaleString()} · refresh after {new Date(weather.refreshAfter).toLocaleString()}</p>{weather.forecastMessage && <p>{weather.forecastMessage}</p>}</div>}
      <div><h4>Daily total calculation</h4><p>Activity and allowance entries: {money(entryTotal)}{remainder !== 0 && <> + {remainderLabel}: {money(remainder)}</>} = {money(day.totalCost)}.</p>{remainder !== 0 && <p>{remainderLabel === 'Accommodation allocation' ? 'Allocated from the recorded stay total across its nights.' : 'Difference between the saved daily total and its itemized entries; the record does not identify a more precise basis. Confirm this amount before relying on it.'}</p>}{day.rideFare !== undefined && <p>Recorded ride/boat fare: {money(day.rideFare)}. This summary is not added again to the daily total.</p>}</div>

    </div></details>
    {day.returnToStayAt && itinerary.accommodation && <p className={styles.meta}><BedDouble size={14} className="mr-1 inline"/>Return to {itinerary.accommodation.name} by {day.returnToStayAt}</p>}
    {!readOnly && <div className={styles.footer}><button disabled={day.activities.length >= 8} onClick={() => onEditActivity(dayIndex, null)} className="flex items-center justify-center gap-2 rounded-md border border-amber-500/40 px-3 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-400/10 disabled:opacity-40"><Plus size={15}/>Add activity</button><button onClick={() => onOpenDay(day)} className="flex items-center justify-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-sm font-semibold hover:bg-slate-800"><Eye size={15}/>Full details</button></div>}
    </>}
  </article>;
}
