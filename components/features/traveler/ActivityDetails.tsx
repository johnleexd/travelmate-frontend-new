import type { DayActivity, ItineraryResponse } from '@/lib/contracts';
import { ActivityPhotoCredit } from '@/components/common/ActivityPhotoCredit';
import { ExpenseEstimate } from './ExpenseEstimate';
import styles from './DailyItineraryCard.module.css';

export function ActivityDetails({ item, currency, destination, travelers }: { item: DayActivity; currency: ItineraryResponse['currency']; destination: string; travelers?: number }) {
  return <details className={styles.details} data-activity-details><summary>Details &amp; sources</summary><div className={styles.detailsBody}>
    <section><h4>{item.title}</h4>{item.description && <p className={styles.fullDescription}>{item.description}</p>}
      <p>Saved time: {item.time || 'Not set'}{item.durationMinutes !== undefined ? ` · ${item.durationMinutes} min duration` : ''}</p>
      {item.travelMinutes !== undefined && <p>Scheduling buffer: {item.travelMinutes} min. This is a planning assumption, not a verified route time.</p>}
      <p>{item.place ? [item.place.address, item.place.city, item.place.country].filter(Boolean).join(', ') : item.location || `Location unconfirmed · ${destination}`}</p>
      {item.status && <p>Saved status: {item.status}</p>}
      {item.placeVerification && <p>Location verification: {item.placeVerification}</p>}
    </section>
    <section><h4>Cost estimate</h4><ExpenseEstimate travelers={travelers} item={item} currency={currency}/></section>
    {item.place && <section><h4>Place source</h4><p><a href={item.place.sourceUrl} target="_blank" rel="noreferrer">{item.place.name}</a> · {item.place.placeId} · Retrieved {new Date(item.place.fetchedAt).toLocaleString()}</p><p>Opening hours: {item.place.openingHours || 'Unverified'}</p><p>Coordinates: {item.place.latitude}, {item.place.longitude}</p>
      {item.place.locationScope && <p>Area: {item.place.locationScope}{item.place.selectedCity ? ` · Selected destination: ${item.place.selectedCity}` : ''}{item.place.distanceFromDestinationKm !== undefined ? ` · ${item.place.distanceFromDestinationKm} km straight-line from its centre (not a route distance)` : ''}</p>}
      {item.place.membershipSourceUrl && <a href={item.place.membershipSourceUrl} target="_blank" rel="noreferrer">Area source</a>}
      {item.place.coordinateSourceUrl && <a href={item.place.coordinateSourceUrl} target="_blank" rel="noreferrer">Coordinate source</a>}
    </section>}
    <ActivityPhotoCredit credit={item.imageAttribution} className={styles.credit} cropped={false}/>
  </div></details>;
}
