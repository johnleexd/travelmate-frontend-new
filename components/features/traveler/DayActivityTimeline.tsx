'use client';

import type { DayMapRoute, TripMapActivity } from '@/lib/trip-navigation';
import { timelineCost, timelineDuration, timelineSchedule, timelineTravel } from '@/lib/trip-map-timeline';
import styles from './SavedTripMap.module.css';

export function DayActivityTimeline({ activities, budget, selected, onSelect, currency, timezone, route }: {
  activities: TripMapActivity[]; budget: TripMapActivity[]; selected: number; onSelect: (index: number) => void;
  currency?: string; timezone?: string; route?: DayMapRoute;
}) {
  return <div className={styles.timelineScroll} tabIndex={0} role="region" aria-label="Daily timeline and budget">
    <p className={styles.timelineCaption}>Destination local time{timezone ? ' · ' + timezone : ''}. End times use saved ranges or saved durations.</p>
    {!activities.length && <p className={styles.timelineCaption}>No scheduled activities for this day.</p>}
    <ol className={styles.activityList} aria-label="Day activity list">{activities.map((item, position) => {
      const schedule = timelineSchedule(item), cost = timelineCost(item.estimatedCost, currency), travel = item.status === 'skipped' ? null : timelineTravel(route, item.index, activities.slice(position + 1).find(activity => activity.status !== 'skipped')?.index);
      return <li key={item.index}>
        <button type="button" aria-pressed={selected === item.index} onClick={() => onSelect(item.index)}>
          <span>{item.index + 1}</span><div className={styles.timelineContent}>
            <span className={styles.timelineTime}>{schedule.label}</span>
            <strong>{item.title}</strong><small className={styles.activityStatus}>{item.status ? item.status[0].toUpperCase() + item.status.slice(1) : 'Planned'}</small>
            <small>{item.place?.name || 'Choose an exact place'}</small>
            {(schedule.duration !== undefined || cost !== null) && <small>{schedule.duration !== undefined ? 'Duration: ' + timelineDuration(schedule.duration) : ''}{schedule.duration !== undefined && cost !== null ? ' · ' : ''}{cost !== null ? 'Estimated cost: ' + cost : ''}</small>}
            {item.description && <span className={styles.timelineDescription}>{item.description}</span>}
          </div>
        </button>
        {travel && <p className={styles.timelineTravel}>{Math.ceil(travel.seconds / 60)} min to next stop · {travel.mode} · OSRM estimate</p>}
      </li>;
    })}</ol>
    {budget.length > 0 && <section aria-label="Daily budget" className={styles.dailyBudget}>
      <h4>Daily budget</h4><p>Allowances · not map stops</p>
      <ul>{budget.map(item => <li key={item.index}><span>{item.title}</span><strong>{timelineCost(item.estimatedCost, currency) || 'Cost not set'}</strong></li>)}</ul>
    </section>}
  </div>;
}
