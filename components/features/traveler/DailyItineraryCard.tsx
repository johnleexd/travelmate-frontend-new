import { ArrowLeft, BedDouble, Clock3, Utensils, ChevronDown, ChevronRight, ChevronUp, CloudSun, Eye, Pencil, Plus, Trash2, TriangleAlert, WalletCards } from 'lucide-react';
import { Fragment, type RefObject } from 'react';
import { RecoverableActivityPhoto as ActivityPhoto } from '@/components/common/RecoverableActivityPhoto';
import { ActivityText } from './ActivityText';
import { ActivityDetails } from './ActivityDetails';
import { shortWeatherWarning } from '@/lib/activity-presentation';
import { ReferenceAmount } from '@/components/common/ReferenceAmount';
import type { DayActivity } from '@/lib/contracts';
import { formatMoney } from '@/lib/domain';
import { dailyCardEntries, itineraryCostPresentation } from '@/lib/itinerary-day-presentation';
import { existingDestinationPhoto, savedDayTheme, storedActivityImage } from '@/lib/stored-trip-photos';
import { timelineSchedule } from '@/lib/trip-map-timeline';
import { PlaceActions } from './PlaceActions';
import { ExpenseEstimate } from './ExpenseEstimate';
import { expenseLedger, activityExpense } from '@/lib/generated/expense-ledger';
import { NextStopCard } from './NextStopCard';
import { RetryDayActivities } from './RetryDayActivities';
import type { ItineraryWorkspaceProps } from './ItineraryWorkspace';
import styles from './DailyItineraryCard.module.css';

type Props = Omit<ItineraryWorkspaceProps, 'manualDirty' | 'editingTripId' | 'onSave'> & { dayIndex: number; detail?: boolean; onViewItinerary?: (button: HTMLButtonElement) => void; onBack?: () => void; headingRef?: RefObject<HTMLHeadingElement | null> };


export function formatItineraryDate(value: string) {
  const date = new Date(value + 'T00:00:00');
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : value || 'Date unavailable';
}

export function DailyItineraryCard({ itinerary, dayIndex, weather, readOnly = false, busy, visitTripId, referenceCurrency, exchangeQuotes, onRetryDay, retryingDay, onReorderActivity, onEditActivity, onRemoveActivity, onOpenDay, detail = false, onViewItinerary, onBack, headingRef, travelers }: Props) {
  const day = itinerary.days[dayIndex];
  const ledger = expenseLedger(itinerary);
  const { activities, allowances, entryTotal, remainder, remainderLabel } = dailyCardEntries(itinerary, dayIndex);
  const forecast = weather?.source !== 'unavailable' && weather?.forecastAvailable !== false ? weather?.forecast?.find(item => item.date === day.date) : undefined;
  const alerts = [...new Set([forecast?.weatherAlert, day.weatherAlert].filter((alert): alert is string => Boolean(alert)))];
  const money = (amount: number) => formatMoney(amount, itinerary.currency);
  const photoAttribution = day.imageAttribution || day.activities.find(item => item.imageUrl === day.imageUrl && day.imageUrl)?.imageAttribution;
  const destinationPhoto = existingDestinationPhoto(itinerary);
  const fallbackSource = storedActivityImage(day.imageUrl, photoAttribution) ? day.imageUrl : destinationPhoto?.imageUrl;
  const fallbackCredit = fallbackSource === day.imageUrl ? photoAttribution : destinationPhoto?.imageAttribution;
  const theme = savedDayTheme(day, itinerary.destination);
  const cost = itineraryCostPresentation(itinerary, dayIndex);
  const zone = itinerary.grounding?.timeZone || 'Timezone unconfirmed';
  const localTime = `Flexible stop order · Local timezone (${zone})`;
  const reference = (amount: number) => <ReferenceAmount amount={amount} currency={itinerary.currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes}/>;
  const blocks = itinerary.manuallyEdited ? [] : day.scheduleBlocks ?? [];
  const flexible = activities.every(({ activity }) => activity.time.toLowerCase() === 'flexible');
  const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  const blockTiming = (block: typeof blocks[number]) => flexible ? `Suggested ${block.endMinutes - block.startMinutes} min` : `${clock(block.startMinutes)}–${clock(block.endMinutes)}`;
  const timeBlock = (block: typeof blocks[number]) => <li key={`${block.kind}-${block.startMinutes}`} className={styles.scheduleBlock} data-schedule-block><Utensils size={19} aria-hidden="true"/><span>{blockTiming(block)}</span> · {block.kind === 'meal' ? 'Meal break' : block.kind === 'free-time' ? 'Free time' : 'Unscheduled time'}</li>;
  const controls = (item: DayActivity, index: number) => !readOnly && <div className={styles.controls}>
    {[{ label: 'earlier', direction: -1 as const, Icon: ChevronUp, disabled: index === 0 }, { label: 'later', direction: 1 as const, Icon: ChevronDown, disabled: index === day.activities.length - 1 }].map(control => <button type="button" key={control.label} disabled={busy || control.disabled} onClick={() => onReorderActivity(dayIndex, index, control.direction)} aria-label={`Move ${item.title} ${control.label}`} title={`Move ${control.label}`}><control.Icon size={16}/></button>)}
    <button type="button" disabled={busy} onClick={() => onEditActivity(dayIndex, index)} aria-label={`Edit ${item.title}`} title={`Edit ${item.title}`}><Pencil size={16}/></button>
    <button type="button" disabled={busy} onClick={() => onRemoveActivity(dayIndex, index)} aria-label={`Remove ${item.title}`} title={`Remove ${item.title}`} className={styles.delete}><Trash2 size={16}/></button>
  </div>;

  const activitySources = (item: DayActivity) => <ActivityDetails item={item} currency={itinerary.currency} destination={itinerary.destination}/>;
  const weatherLine = <span className={styles.weatherLine}><CloudSun size={20} aria-hidden="true"/><span>{forecast ? <>Forecast · {forecast.tempMin}°–{forecast.tempMax}°C{detail && <> · {forecast.description} · Rain {forecast.precipitationProbability}%</>}</> : <>Weather unavailable for {day.date}.</>}</span></span>;
  const amount = (item: DayActivity) => activityExpense(item, itinerary.currency) === null ? 'Estimate unavailable' : money(item.estimatedCost);
  const count = itinerary.travelers ?? travelers;
  const dayScope = `for ${count} traveler${count === 1 ? '' : 's'}`;
  const categories = [...new Set(day.activities.map(item => item.category))];

  return <article className={detail ? styles.detailPage : styles.card} aria-label={`Day ${day.day} ${detail ? 'details' : 'itinerary'}`} data-itinerary-day={day.day} data-daily-card={detail ? undefined : true} data-day-details={detail ? true : undefined}>
    {detail ? <><button type="button" onClick={onBack} data-itinerary-back="explicit-overview" className={styles.backButton}><ArrowLeft size={16}/>Back to itinerary</button><div className={styles.heading}><div><h2 ref={headingRef} tabIndex={-1}>Day {day.day}{theme ? `: ${theme}` : ''}</h2><time dateTime={day.date}>{formatItineraryDate(day.date)}</time></div><p className={styles.scheduleBadge}><Clock3 size={14}/>{localTime}</p></div></> : <div className={styles.heading}><div className={styles.dayTitle}><span className={styles.dayBadge} aria-hidden="true">{day.day}</span><div><h3>Day {day.day}</h3>{theme && <p>{theme}</p>}</div></div><div className={styles.dayMeta}><time dateTime={day.date}>{formatItineraryDate(day.date)}</time><span>{activities.length} {activities.length === 1 ? 'activity' : 'activities'}{allowances.length ? ` · ${allowances.length} budget entries` : ''}</span></div></div>}
    {!detail && <ul className={styles.activityGrid} aria-label={`Day ${day.day} activity summary`} data-overview-activities data-day-photos>{activities.length ? activities.map(({ activity: item, index }, stopIndex) => {
      const attribution = item.imageAttribution || (item.imageUrl === day.imageUrl ? photoAttribution : undefined);
      const activityImage = storedActivityImage(item.imageUrl, attribution) && attribution?.photoType !== 'destination' && attribution?.match !== 'destination' ? item.imageUrl : undefined;
      return <li key={item.id || index} data-overview-activity-index={index} className={styles.overviewActivity}>
        <figure><ActivityPhoto showCredit={false} fit="contain" day={day.day} activityIndex={index} uncertainLocation={!!activityImage && !item.place?.name && attribution?.photoType !== 'place' && !attribution?.illustrative} frameClassName={styles.overviewPhoto} creditClassName={styles.credit} src={activityImage} attribution={activityImage ? attribution : undefined} alt={item.place?.name || item.title} sizes="(max-width: 640px) 100vw, (max-width: 1100px) 45vw, 33vw" emptyMessage={`Finding a photo for ${item.place?.name || item.title}.`}/></figure>
        <ActivityText item={item} showTime stop={stopIndex + 1}/>
        <ExpenseEstimate item={item} currency={itinerary.currency} compact/>
        <div className={styles.overviewControls}><PlaceActions activity={item} destination={itinerary.destination} tripId={visitTripId} dayIndex={dayIndex} activityIndex={index} canRecord={!readOnly}/>{controls(item,index)}</div>
        {activitySources(item)}
      </li>;
    }) : <li className={styles.empty}>No activities scheduled{day.planningReason && <p>{day.planningReason}</p>}</li>}</ul>}
    {detail && !activities.length && fallbackSource && <figure><ActivityPhoto showCredit={false} fit="contain" frameClassName={styles.photo} creditClassName={styles.credit} src={fallbackSource} attribution={fallbackCredit} alt={`Destination photo: ${itinerary.destination}`} sizes="100vw" emptyMessage="No saved photo available for this day."/></figure>}
    {alerts.length > 0 && <p className={styles.alert}><TriangleAlert size={16} aria-hidden="true"/><span>{shortWeatherWarning(alerts)}</span></p>}
    {day.planningStatus && day.planningStatus !== 'suggested' && <p className={styles.meta}>{day.planningStatus === 'incomplete' ? 'More activities needed' : day.planningStatus === 'rest' ? 'Rest day' : 'Travel day'}</p>}
    {day.planningStatus === 'incomplete' && !readOnly && itinerary.grounding && onRetryDay && <RetryDayActivities dayIndex={dayIndex} busy={busy} retrying={retryingDay === dayIndex} onRetry={onRetryDay}/>}
    <div className={styles.overviewFooter}>{weatherLine}{!detail && <span className={styles.localTime}><Clock3 size={18} aria-hidden="true"/>{localTime}</span>}<div className={styles.total}><WalletCards size={18} aria-hidden="true"/><div>{cost.amount === undefined ? <p>Estimate unavailable</p> : <p>{cost.amountLabel}: <strong>{money(cost.amount)}</strong>{reference(cost.amount)}</p>}</div></div>{!detail && <button type="button" className={styles.viewButton} onClick={event => onViewItinerary?.(event.currentTarget)}>View day itinerary<ChevronRight size={17} aria-hidden="true"/></button>}</div>
    {!detail && (allowances.length > 0 || blocks.length > 0 || alerts.length > 0 || weather || day.travelNote || day.theme && day.theme !== theme) && <details className={styles.overviewExtra}><summary>Daily allowances &amp; day notes</summary>{alerts.map(alert=><p key={alert}>{alert}</p>)}{weather && <p>Weather: {weather.source} · Retrieved {new Date(weather.fetchedAt).toLocaleString()} · Refresh after {new Date(weather.refreshAfter).toLocaleString()}. {weather.forecastMessage}</p>}{day.theme && day.theme !== theme && <p>Recorded day theme: {day.theme}</p>}{day.travelNote && <p>{day.travelNote}</p>}{blocks.map(block => <p key={`${block.kind}-${block.startMinutes}`}>{blockTiming(block)} · {block.label}</p>)}{allowances.map(({ activity: item, index }) => <div key={item.id || index}><strong>{item.title}</strong><p>{item.time} · {amount(item)}</p>{activitySources(item)}</div>)}</details>}
    {detail && <>
    <h4 className={styles.sectionTitle}>Your activities</h4>
    {!activities.length ? <div className={styles.empty}><strong>No activities scheduled</strong>{day.planningStatus === 'rest' || day.planningStatus === 'travel' ? <p>{day.planningReason}</p> : /confirm|unsupported|no additional supported/i.test(day.theme + ' ' + (day.travelNote || '')) && <p>Places still need confirmation before visits can be scheduled.</p>}</div> : <ol className={styles.list} aria-label={`Day ${day.day} activities`}>{activities.map(({ activity: item, index }, displayIndex) => {
      const schedule = timelineSchedule(item);
      const previousStart = displayIndex ? timelineSchedule(activities[displayIndex - 1].activity).start ?? -1 : -1;
      const activityAttribution = item.imageAttribution || (item.imageUrl === day.imageUrl ? photoAttribution : undefined);
      const activityImage = storedActivityImage(item.imageUrl, activityAttribution) && activityAttribution?.photoType !== 'destination' && activityAttribution?.match !== 'destination' ? item.imageUrl : undefined;
      return <Fragment key={item.id || `${item.title}-${index}`}>
      {blocks.filter(block => block.endMinutes <= (schedule.start ?? -1) && block.endMinutes > previousStart).map(timeBlock)}
      <li className={styles.activityCard} data-activity-index={index}>
        <span className={styles.time} aria-label={item.time.toLowerCase() === 'flexible' ? 'Suggested stop order' : 'Suggested time range'}>{item.time.toLowerCase() === 'flexible' ? `Stop ${displayIndex + 1}` : schedule.label}</span>
        <figure className={styles.activityPhoto}><ActivityPhoto showCredit={false} day={day.day} activityIndex={index} uncertainLocation={!!activityImage && !item.place?.name && activityAttribution?.photoType !== 'place' && !activityAttribution?.illustrative} fit="contain" frameClassName={styles.photo} creditClassName={styles.credit} src={activityImage} attribution={activityImage ? activityAttribution : undefined} alt={item.place?.name || item.title} sizes="(max-width: 600px) 100vw, 150px" emptyMessage={`Finding a photo for ${item.place?.name || item.title}.`}/></figure>
        <div className={styles.activityMain}><ActivityText item={item}/>
          <div className={styles.placeActions}><PlaceActions activity={item} destination={itinerary.destination} tripId={visitTripId} dayIndex={dayIndex} activityIndex={index} canRecord={!readOnly}/></div>
          {activitySources(item)}
        </div>
        <div className={styles.activityCost}><div className={styles.priceBadge}><ExpenseEstimate item={item} currency={itinerary.currency} compact/></div>{item.priceEvidence?.status !== 'unavailable' && reference(item.estimatedCost)}{controls(item, index)}</div>
      </li>{activities[displayIndex + 1] && <NextStopCard from={item} to={activities[displayIndex + 1].activity}/>}</Fragment>;
    })}{blocks.filter(block => block.endMinutes > (timelineSchedule(activities.at(-1)!.activity).start ?? Infinity)).map(timeBlock)}</ol>}
    <section aria-label={`Day ${day.day} daily budget`}><details className={styles.budget}><summary>Daily budget breakdown <span>Includes {money(cost.allowance)} in suggested allowances</span></summary><div className={styles.budgetHeading}><h4><WalletCards size={18}/>Daily budget <small>(estimates {dayScope})</small></h4><p>For planning purposes only. Actual prices may vary.</p></div><dl className={styles.budgetSummary}>{categories.map(category => {
      return <div key={category}><dt>{category === 'activity' ? 'Activities' : category === 'misc' ? 'Other costs' : category}</dt><dd>{(() => { const rows = ledger.days[dayIndex].rows.filter(row => row.item.category === category && row.amount !== null); return rows.length ? money(rows.reduce((sum,row)=>sum+row.amount!,0)) : 'Estimate unavailable'; })()}</dd></div>;
    })}{remainder !== 0 && <div><dt>{remainderLabel}</dt><dd>{money(remainder)}</dd></div>}<div className={styles.budgetTotal}><dt>Total</dt><dd>{cost.amount === undefined ? 'Estimate unavailable' : money(cost.amount)}</dd></div></dl><p className={styles.meta}>Includes {money(cost.allowance)} in suggested allowances.{cost.unpriced ? " Partial estimate; remaining budget is provisional." : ""}</p><details className={styles.budgetEntries}><summary>Budget entries &amp; controls</summary><ul>{allowances.map(({ activity: item, index }) => <li key={`${item.title}-${index}`} className={styles.entry} data-budget-index={index}>
      <div className={styles.budgetLine}><span>{item.title}</span><strong>{amount(item)}</strong></div>{item.priceEvidence?.status !== 'unavailable' && reference(item.estimatedCost)}<ExpenseEstimate item={item} currency={itinerary.currency}/>
      <PlaceActions activity={item} destination={itinerary.destination} tripId={visitTripId} dayIndex={dayIndex} activityIndex={index} canRecord={!readOnly}/>{controls(item, index)}{activitySources(item)}
    </li>)}{remainder !== 0 && <li className={styles.entry}><div className={styles.budgetLine}><span>{remainderLabel}</span><strong>{money(remainder)}</strong></div><p className={styles.priceLabel}>Estimated allocation · see Details &amp; sources</p></li>}{!allowances.length && remainder === 0 && <li className={styles.entry}><p className={styles.meta}>No separate daily allowances recorded.</p></li>}</ul></details></details></section>
    <details className={styles.details}><summary>Details &amp; sources</summary><div className={styles.detailsBody}>
      {day.travelNote && <p>{day.travelNote}</p>}{day.planningReason && <p>{day.planningReason}</p>}
      {day.scheduleBlocks?.length ? <div><h4>Schedule notes</h4>{day.scheduleBlocks.map(block => <p key={`${block.kind}-${block.startMinutes}`}>{blockTiming(block)} · {block.label}</p>)}</div> : null}
      {day.crowdLevel && <div><p>Estimated crowd: <strong className="capitalize">{day.crowdLevel}</strong> · {day.crowdConfidence || 'low'} confidence · not live data</p>{day.crowdNote && <p>{day.crowdNote}</p>}{day.crowdRecommendation && <p>{day.crowdRecommendation}</p>}{day.crowdFetchedAt && <p>Estimated {new Date(day.crowdFetchedAt).toLocaleString()}</p>}{day.crowdRefreshAfter && <p>Refresh after {new Date(day.crowdRefreshAfter).toLocaleString()}</p>}</div>}
      {alerts.map(alert=><p key={alert}>{alert}</p>)}{weather && <div><h4>Weather sources</h4><p>{weather.source} · retrieved {new Date(weather.fetchedAt).toLocaleString()} · refresh after {new Date(weather.refreshAfter).toLocaleString()}</p>{weather.forecastMessage && <p>{weather.forecastMessage}</p>}</div>}
      <div><h4>Daily total calculation</h4><p>Activity and allowance entries: {money(entryTotal)}{remainder !== 0 && <> + {remainderLabel}: {money(remainder)}</>} = {money(day.totalCost)}.</p>{remainder !== 0 && <p>{remainderLabel === 'Accommodation allocation' ? 'Allocated from the recorded stay total across its nights.' : 'Difference between the saved daily total and its itemized entries; the record does not identify a more precise basis. Confirm this amount before relying on it.'}</p>}{day.rideFare !== undefined && <p>Recorded transport estimate: {money(day.rideFare)}. This summary is not added again to the daily total.</p>}</div>

    </div></details>
    {day.returnToStayAt && itinerary.accommodation && <p className={styles.meta}><BedDouble size={14} className="mr-1 inline"/>Return to {itinerary.accommodation.name} by {day.returnToStayAt}</p>}
    {!readOnly && <div className={styles.footer}><button disabled={day.activities.length >= 8} onClick={() => onEditActivity(dayIndex, null)} className="flex items-center justify-center gap-2 rounded-md border border-amber-500/40 px-3 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-400/10 disabled:opacity-40"><Plus size={15}/>Add activity</button><button onClick={() => onOpenDay(day)} className="flex items-center justify-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-sm font-semibold hover:bg-slate-800"><Eye size={15}/>Full details</button></div>}
    </>}
  </article>;
}
