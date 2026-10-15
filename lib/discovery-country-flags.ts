import { countryFlagCodes } from './country-flag-codes.ts';

/** Use exact country identities, never infer a flag from a country's English name. */
export function discoveryCountryFlag(code: string): string | null {
  if (code === 'WD-Q34754') return '/discovery/flags/somaliland.svg';
  if (code === 'WD-Q23681') return '/discovery/flags/northern-cyprus.svg';
  // Antarctica and other geographic features have no national flag. Do not invent one.
  if (code === 'AQ' || !countryFlagCodes.has(code)) return null;
  return '/flags/' + code.toLowerCase() + '.svg';
}

const flags = new Map<string, Promise<HTMLImageElement | null>>();
export function loadCountryFlag(code: string, name: string): Promise<HTMLImageElement | null> {
  const src = discoveryCountryFlag(code);
  if (!src) return Promise.resolve(null);
  const cached = flags.get(code);
  if (cached) return cached;
  const flag = new window.Image();
  flag.alt = 'Flag of ' + name;
  flag.dataset.flagCountry = code;
  flag.width = 24; flag.height = 18;
  flag.src = src;
  const request = flag.decode().then(() => flag).catch(() => { flags.delete(code); return null; });
  flags.set(code, request);
  return request;
}
