export type CountryPhoto = {
  src: string; providerUrl: string; title: string; alt: string; creator: string;
  license: string; licenseUrl: string; sourceUrl: string; evidence: string;
  origin: string; description: string; changes: string;
  place?: string; focus?: [number, number]; sourceDimensions?: [number, number];
  crop?: { left: number; top: number; width: number; height: number };
};
export type CountryPhotoEntry = {
  code: string; id: string; name: string; wikidataId: string;
  status: 'ready' | 'unresolved'; photos: CountryPhoto[];
};
export type CountryPhotoManifest = {
  version: number; preparedAt: string; provider: string; total: number;
  curationVersion?: number;
  isoCodes: string[]; countries: CountryPhotoEntry[];
  unresolved: { code: string; name: string; reason: string }[];
};

let manifestRequest: Promise<CountryPhotoManifest> | null = null;
const images = new Map<string, Promise<HTMLImageElement | null>>();

export function loadCountryPhotoManifest(): Promise<CountryPhotoManifest> {
  if (!manifestRequest) manifestRequest = fetch('/discovery/country-photos.v2.json?curation=1', { cache: 'no-cache' })
    .then(response => { if (!response.ok) throw new Error('Country photo cache unavailable'); return response.json() as Promise<CountryPhotoManifest>; })
    .catch(error => { manifestRequest = null; throw error; });
  return manifestRequest;
}

/** Exact stable identity only. Successful decodes are shared; hover races never swap countries. */
export function loadCountryPhoto(code: string): Promise<HTMLImageElement | null> {
  const existing = images.get(code);
  if (existing) return existing;
  const request = loadCountryPhotoManifest().then(async manifest => {
    const entry = manifest.countries.find(country => country.code === code);
    if (!entry || entry.status !== 'ready') return null;
    for (const photo of entry.photos) {
      const image = new window.Image();
      image.alt = photo.alt;
      image.dataset.photoCountry = code;
      image.width = 432; image.height = 270;
      image.decoding = 'async';
      image.src = photo.src;
      try { await image.decode(); return image; } catch { /* Try only a verified fallback for this same country. */ }
    }
    return null;
  }).catch(() => null);
  images.set(code, request);
  // A temporary network failure may retry on a later hover; valid photos stay cached.
  void request.then(image => { if (!image) images.delete(code); });
  return request;
}
