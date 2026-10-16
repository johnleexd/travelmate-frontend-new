import { Clock3, MapPin } from 'lucide-react';
import type { DayActivity } from '@/lib/contracts';
import { activityPresentation } from '@/lib/activity-presentation';
import { timelineDuration, timelineSchedule } from '@/lib/trip-map-timeline';
import styles from './DailyItineraryCard.module.css';

export function ActivityText({ item, showTime = false, stop }: { item: DayActivity; showTime?: boolean; stop?: number }) {
  const content = activityPresentation(item), schedule = timelineSchedule(item);
  return <div data-activity-text>
    <h4>{item.title}</h4>
    {content.location && <p className={styles.location}><MapPin size={13} aria-hidden="true"/>{content.location}</p>}
    {content.badges.length > 0 && <ul className={styles.qualifications} aria-label="Activity qualifications">{content.badges.map(label=><li key={label}>{label}</li>)}</ul>}
    {content.description && <p className={styles.description} data-short-description>{content.description}</p>}
    <p className={styles.meta}><Clock3 size={13} className="mr-1 inline" aria-hidden="true"/>{showTime && <span>{item.time.toLowerCase() === 'flexible' ? stop ? `Stop ${stop} · ` : 'Flexible visit · ' : `${schedule.label} · `}</span>}{schedule.duration === undefined ? 'Duration unconfirmed' : `${item.time.toLowerCase() === 'flexible' ? 'Suggested ' : ''}${timelineDuration(schedule.duration)}`}</p>
    {item.status && item.status !== 'planned' && <p className={styles.meta}>{item.status}</p>}
  </div>;
}
