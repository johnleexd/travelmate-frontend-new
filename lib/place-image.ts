const COUNTRY_CODE = /^[A-Z]{2}$/;

export interface SavedTripCoverImage {
  src: string;
  kind: 'destination-photo' | 'country-flag';
  attribution?: {
    creator: string;
    license: string;
    sourceUrl: string;
  };
}

export function verifiedPlaceImage(source: string | undefined): string | null {
  if (!source) return null;
  if (source.startsWith('https://upload.wikimedia.org/') || source.startsWith('https://thumb.wikimedia.org/')) return source;
  return null;
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

function verifiedAttribution(value: unknown): SavedTripCoverImage['attribution'] | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.creator !== 'string'
    || typeof candidate.license !== 'string'
    || typeof candidate.sourceUrl !== 'string'
    || !candidate.sourceUrl.startsWith('https://')
  ) return undefined;
  return { creator: candidate.creator, license: candidate.license, sourceUrl: candidate.sourceUrl };
}

/** Pick a trusted destination photo, then fall back to the saved ISO country's flag. */
export function savedTripCoverImage(itinerary: unknown, countryCode: string | undefined): SavedTripCoverImage | null {
  if (itinerary && typeof itinerary === 'object') {
    const days = (itinerary as { days?: unknown }).days;
    if (Array.isArray(days)) {
      for (const day of days) {
        if (!day || typeof day !== 'object') continue;
        const candidate = day as Record<string, unknown>;
        const source = verifiedPlaceImage(typeof candidate.imageUrl === 'string' ? candidate.imageUrl : undefined);
        if (source) return { src: source, kind: 'destination-photo', attribution: verifiedAttribution(candidate.imageAttribution) };
      }
    }
  }

  const normalizedCountryCode = countryCode?.trim().toUpperCase();
  if (!normalizedCountryCode || !COUNTRY_CODE.test(normalizedCountryCode)) return null;
  return { src: `https://flagcdn.com/w1280/${normalizedCountryCode.toLowerCase()}.png`, kind: 'country-flag' };
}
