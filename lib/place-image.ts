import { straightLineDistanceKm, tripMapDestination } from './trip-map.ts';
import type { ImageAttribution } from './contracts.ts';

const COUNTRY_CODE = /^[A-Z]{2}$/;
export interface SavedTripPhotoDestination {
  destination: string;
  itinerary?: unknown;
  destinationCity?: string;
  destinationRegion?: string;
  destinationCountry?: string;
  destinationCountryCode?: string;
  latitude?: number;
  longitude?: number;
}
export interface SavedTripCoverImage {
  id?: string;
  provider?: 'unsplash';
  src: string;
  kind: 'destination-photo';
  city: string;
  countryCode: string;
  label: string;
  scope: 'destination' | 'country';
  attribution: { creator: string; license: string; licenseUrl?: string; sourceUrl: string; photographerUrl?: string };
}

export function verifiedPlaceImage(source: string | undefined): string | null {
  if (!source) return null;
  if (source.startsWith('https://upload.wikimedia.org/') || source.startsWith('https://thumb.wikimedia.org/')) return source;
  return null;
}

/** Activity Unsplash images require the stored provider identity and credit. */
export function verifiedActivityImage(source: string | undefined, credit?: ImageAttribution): string | null {
  const commons = verifiedPlaceImage(source);
  if (commons) {
    const verified = attribution(credit);
    if (!verified || credit?.provider === 'unsplash') return null;
    try {
      const url = new URL(commons);
      return !url.username && !url.password && url.pathname.startsWith('/wikipedia/commons/') && /\.(?:jpe?g|png|webp|avif)$/i.test(url.pathname) ? commons : null;
    } catch { return null; }
  }
  const unsplash = savedCoverUnsplashSource(source);
  if (!unsplash || credit?.provider !== 'unsplash' || !/^[\w-]{1,100}$/.test(credit.photoId || '') || credit.license !== 'Unsplash' || !credit.creator?.trim() || typeof credit.illustrative !== 'boolean' || (credit.illustrative ? !['destination', 'activity'].includes(credit.match || '') : credit.match !== 'place')) return null;
  try {
    for (const [value, prefix] of [[credit.sourceUrl, '/photos/'], [credit.photographerUrl, '/@']] as const) {
      const url = new URL(value || '');
      if (url.protocol !== 'https:' || url.hostname !== 'unsplash.com' || url.username || url.password || !url.pathname.startsWith(prefix) || url.searchParams.get('utm_source') !== 'travelmate' || url.searchParams.get('utm_medium') !== 'referral') return null;
    }
  } catch { return null; }
  return unsplash;
}

/** A Commons thumbnail can fail while the original public photo is available. */
export function placePhotoCandidates(source: string | undefined): string[] {
  const verified = verifiedPlaceImage(source);
  if (!verified) return [];
  if (verified.startsWith('/')) return [verified];
  try {
    const url = new URL(verified);
    const match = url.pathname.match(/^\/wikipedia\/commons\/thumb\/([^/]+)\/([^/]+)\/([^/]+)\/[^/]+$/);
    if (!match || !/\.(?:jpe?g|png|webp|gif|avif)$/i.test(match[3])) return [verified];
    return [verified, `https://upload.wikimedia.org/wikipedia/commons/${match[1]}/${match[2]}/${match[3]}`];
  } catch { return []; }
}


function normalized(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
function coverCoordinates(destination: SavedTripPhotoDestination) {
  const plan = destination.itinerary as { grounding?: { destination?: { latitude?: unknown; longitude?: unknown } } } | null | undefined;
  return tripMapDestination(destination, plan?.grounding?.destination);
}
export function savedTripPhotoQuery(destination: SavedTripPhotoDestination): string {
  const parts = destination.destination.split(',').map(part => part.trim());
  const params = new URLSearchParams({ city: destination.destinationCity || parts[0] });
  const country = destination.destinationCountry || (parts.length > 1 ? parts.at(-1) : undefined);
  const code = destination.destinationCountryCode?.trim().toUpperCase();
  if (country) params.set('country', country);
  if (code && COUNTRY_CODE.test(code)) params.set('countryCode', code);
  const region = destination.destinationRegion || (parts.length > 2 ? parts.slice(1, -1).join(', ') : undefined);
  if (region) params.set('region', region);
  const point = coverCoordinates(destination);
  if (point) { params.set('latitude', String(point.latitude)); params.set('longitude', String(point.longitude)); }
  return params.toString();
}
export function commonsPhotoLicenseUrl(license: string, suppliedUrl?: string): string | null {
  const cc = license.match(/^CC (BY(?:-SA)?) (1\.0|2\.0|2\.5|3\.0|4\.0)$/i);
  const canonical = cc ? `https://creativecommons.org/licenses/${cc[1].toLowerCase()}/${cc[2]}/`
    : /^CC0(?: 1\.0)?$/i.test(license) ? 'https://creativecommons.org/publicdomain/zero/1.0/'
    : /^public domain$/i.test(license) ? 'https://creativecommons.org/publicdomain/mark/1.0/'
    : license === 'KOGL Type 1' ? 'https://www.kogl.or.kr/info/licenseType1.do' : null;
  if (!canonical || license === 'KOGL Type 1' && !suppliedUrl) return null;
  if (!suppliedUrl) return canonical;
  try {
    const url = new URL(suppliedUrl), expected = new URL(canonical);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) return null;
    // Commons also supplies slashless links and localized deeds for the same license.
    const pathname = url.pathname.replace(/\/(?:deed(?:\.[a-z_-]+)?|legalcode(?:\.[a-z_-]+)?)\/?$/i, '/').replace(/\/$/, '');
    return url.hostname.replace(/^www\./, '') === expected.hostname.replace(/^www\./, '') && pathname === expected.pathname.replace(/\/$/, '') ? canonical : null;
  } catch { return null; }
}
function attribution(value: unknown): SavedTripCoverImage['attribution'] | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (typeof item.creator !== 'string' || !item.creator.trim() || typeof item.license !== 'string'
    || typeof item.sourceUrl !== 'string' || !item.sourceUrl.startsWith('https://commons.wikimedia.org/')) return null;
  const licenseUrl = commonsPhotoLicenseUrl(item.license, typeof item.licenseUrl === 'string' ? item.licenseUrl : undefined);
  if (!licenseUrl) return null;
  return { creator: item.creator, license: item.license, sourceUrl: item.sourceUrl, licenseUrl };
}
/** Validate an Unsplash hotlink; consumers separately require appropriate metadata. */
export function savedCoverUnsplashSource(value: unknown): string | null {
  try {
    if (typeof value !== 'string') return null;
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'images.unsplash.com' && !url.username && !url.password && url.pathname.startsWith('/photo-') ? value : null;
  } catch { return null; }
}
function unsplashAttribution(value: unknown): SavedTripCoverImage['attribution'] | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (typeof item.creator !== 'string' || !item.creator.trim() || item.license !== 'Unsplash' ||
    typeof item.sourceUrl !== 'string' || typeof item.photographerUrl !== 'string') return null;
  try {
    const source = new URL(item.sourceUrl), photographer = new URL(item.photographerUrl);
    if ([source, photographer].some(url => url.protocol !== 'https:' || url.hostname !== 'unsplash.com' ||
      url.username || url.password || url.searchParams.get('utm_source') !== 'travelmate' || url.searchParams.get('utm_medium') !== 'referral') ||
      !source.pathname.startsWith('/photos/') || !photographer.pathname.startsWith('/@')) return null;
  } catch { return null; }
  return { creator: item.creator, license: 'Unsplash', sourceUrl: item.sourceUrl, photographerUrl: item.photographerUrl };
}

/** Saved-card photos require both geographic identity and license evidence. */
export function verifiedSavedTripCover(value: unknown, destination: SavedTripPhotoDestination): SavedTripCoverImage | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const params = new URLSearchParams(savedTripPhotoQuery(destination));
  const unsplash = item.provider === 'unsplash';
  const credit = unsplash ? unsplashAttribution(item.attribution) : attribution(item.attribution);
  const source = unsplash ? savedCoverUnsplashSource(item.src) : verifiedPlaceImage(typeof item.src === 'string' ? item.src : undefined);
  if (unsplash && (typeof item.id !== 'string' || !/^[\w-]{1,100}$/.test(item.id))) return null;
  if (!source || !credit || typeof item.city !== 'string' || typeof item.countryCode !== 'string'
    || !COUNTRY_CODE.test(item.countryCode) || (params.has('countryCode') && item.countryCode !== params.get('countryCode'))
    || (item.scope !== 'destination' && item.scope !== 'country') || typeof item.label !== 'string') return null;
  try {
    const name = decodeURIComponent(new URL(source).pathname).replace(/_/g, ' ');
    if (!unsplash && (!/\/wikipedia\/commons\//.test(new URL(source).pathname) || !/\.(jpe?g|png|webp|avif)(?:$|\?)/i.test(source)
      || /\.(svg|pdf|eps)(?:\.|$)/i.test(name) || /\b(flag|map|logo|drawing|illustration|ai[- ]generated)\b/i.test(name + ' ' + item.label))) return null;
  } catch { return null; }
  if (item.scope === 'destination' && normalized(item.city) !== normalized(params.get('city') || '')) return null;
  if (item.scope === 'country' && !item.label.startsWith('Country photo: ')) return null;
  return { ...(unsplash ? { id: item.id as string, provider: 'unsplash' as const } : {}), src: source, kind: 'destination-photo', city: item.city, countryCode: item.countryCode,
    label: item.label, scope: item.scope, attribution: credit };
}

export function savedTripCoverImage(itinerary: unknown, destination: SavedTripPhotoDestination): SavedTripCoverImage | null {
  if (!itinerary || typeof itinerary !== 'object') return null;
  const days = (itinerary as { days?: unknown }).days;
  if (!Array.isArray(days)) return null;
  for (const day of days) {
    if (!day || typeof day !== 'object') continue;
    const activities = (day as { activities?: unknown }).activities;
    if (!Array.isArray(activities)) continue;
    for (const activity of activities) {
      if (!activity || typeof activity !== 'object') continue;
      const item = activity as Record<string, unknown>;
      const place = item.place as Record<string, unknown> | undefined;
      if (!place || place.provider !== 'wikidata' || typeof place.city !== 'string' || typeof place.countryCode !== 'string') continue;
      const params = new URLSearchParams(savedTripPhotoQuery(destination));
      if ((!params.has('countryCode') && !params.has('country')) || (params.has('country') && (typeof place.country !== 'string' || normalized(place.country) !== normalized(params.get('country')!)))) continue;
      const point = coverCoordinates({ ...destination, itinerary });
      const placePoint = tripMapDestination(place);
      if (point && (!placePoint || straightLineDistanceKm(placePoint, point) > 15)) continue;
      const photo = verifiedSavedTripCover({ src: item.imageUrl, attribution: item.imageAttribution, city: place.city, countryCode: place.countryCode,
        label: String(place.name || item.title || place.city) + ', ' + place.city + ', ' + String(place.country || place.countryCode), scope: 'destination' }, destination);
      if (photo) return photo;
    }
  }
  return null;
}

const coverCache = new Map<string, { expires: number; photo: SavedTripCoverImage | null }>();
const pendingCovers = new Map<string, Promise<SavedTripCoverImage | null>>();
/** Deduplicate cards for the same destination and reuse resolved URLs across tab switches. */
export function resolveSavedTripCover(destination: SavedTripPhotoDestination, fetcher: typeof fetch = fetch): Promise<SavedTripCoverImage | null> {
  const key = savedTripPhotoQuery(destination);
  const cached = coverCache.get(key);
  if (cached && cached.expires > Date.now()) return Promise.resolve(cached.photo);
  const pending = pendingCovers.get(key);
  if (pending) return pending;
  const request = (async () => {
    let photo: SavedTripCoverImage | null = null;
    try {
      const response = await fetcher('/api/destination-context/photo?' + key, { signal: AbortSignal.timeout(90000) });
      if (response.ok) photo = verifiedSavedTripCover((await response.json()).photo, destination);
    } catch { /* Cover lookup failures never affect saved-trip actions. */ }
    if (coverCache.size >= 200) coverCache.delete(coverCache.keys().next().value!);
    coverCache.set(key, { expires: Date.now() + (photo ? 3600000 : 60000), photo });
    return photo;
  })().finally(() => pendingCovers.delete(key));
  pendingCovers.set(key, request);
  return request;
}
