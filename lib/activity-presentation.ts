import type { DayActivity } from './contracts';

const uncertain = /unconfirmed|unverified|unknown|unavailable|not available|need(?:s)? confirmation|confirm (?:address|location|hours|opening)/i;
const shorten = (text: string, limit: number) => text.length <= limit ? text : text.slice(0, limit - 1).replace(/\s+\S*$/, '') + '…';

/** Presentation only. Older descriptions embed planning assumptions alongside
 * venue text; the original remains available in Details & sources. */
export function activityPresentation(activity: DayActivity) {
  const place = activity.place;
  const locationUnconfirmed = !place || !place.city?.trim() || uncertain.test(place.city)
    || !place.country?.trim() || uncertain.test(place.country);
  const outside = place?.locationScope === 'nearby' || /\boutside (?:the )?(?:selected |chosen )?(?:destination|city|[A-Z][\p{L}'-]+)/u.test(activity.description)
    && /nearby attraction|selected city|selected destination/i.test(activity.description);
  const hoursUnverified = activity.category === 'activity' && (!place?.openingHours?.trim() || uncertain.test(place.openingHours) || /confirm.*(?:opening|hours)/i.test(place.openingHours));
  const routeUnverified = /straight[- ]line|confirm[^.]*\broute|\broute[^.]*confirm|route unverified/i.test(activity.description);
  const paragraphs = activity.description.split(/\bAddress\s*:/i)[0].split(/(?<=[.!?])\s+|\n+/u);
  const description = paragraphs.filter(sentence => !/^(?:Nearby attraction\s*[:—–-]|Opening hours\s*:|Opening hours need|Suggested\s+\d+[- ]minute|Allow at least\s+\d+|Address\s*:|Return time is reserved|Travel to and from this attraction needs)/i.test(sentence.trim())
    && !/straight[- ]line|assumed\s+\d+\s*km\/h|from the previous stop.*(?:estimate|buffer)/i.test(sentence))
    .join(' ').replace(/\s+/g,' ').trim();
  return {
    description: shorten(description, 180),
    location: locationUnconfirmed ? activity.location?.trim() ? `Entered location: ${shorten(activity.location.trim(),80)}` : '' : [place!.city,place!.country].filter(Boolean).join(', '),
    badges: [outside ? 'Outside selected destination' : '', locationUnconfirmed ? 'Location unconfirmed' : '', hoursUnverified ? 'Hours unverified' : '', routeUnverified ? 'Route unverified' : ''].filter(Boolean),
  };
}

export function shortWeatherWarning(alerts: string[]) {
  const unique = [...new Set(alerts.map(text=>text.trim()).filter(Boolean))];
  const topics = [ [/storm|thunder|typhoon|hurricane/i,'Storm risk'], [/rain|flood/i,'Rain risk'], [/heat|hot|high temperature/i,'Heat risk'], [/snow|ice|freezing/i,'Snow or ice risk'], [/wind|gust/i,'Strong winds'] ] as const;
  const labels = topics.filter(([pattern])=>unique.some(text=>pattern.test(text))).map(([,label])=>label);
  return labels.length ? `${labels.join(' · ')}. Check weather details.` : shorten(unique[0]?.split(/(?<=[.!?])\s/)[0] || '',120);
}
