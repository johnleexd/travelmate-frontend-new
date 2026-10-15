'use client';

import { useState } from 'react';
import { loadCountryPhotoManifest, type CountryPhotoManifest } from '@/lib/discovery-country-photos';

export default function DiscoveryCredits() {
  const [manifest, setManifest] = useState<CountryPhotoManifest | null>(null);
  const [failed, setFailed] = useState(false);
  return (
    <details className="mx-auto mt-6 max-w-[1380px] text-xs leading-6 text-white/60"
      onToggle={event => { if (event.currentTarget.open && !manifest) void loadCountryPhotoManifest().then(setManifest).catch(() => setFailed(true)); }}>
      <summary className="w-fit cursor-pointer underline underline-offset-4">Image and map credits</summary>
      <div className="mt-3 max-w-3xl space-y-2 [&_a]:underline [&_a]:underline-offset-2">
        <p>Earth: Reto Stöckli / <a href="https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/" target="_blank" rel="noreferrer">NASA Earth Observatory, Blue Marble: Next Generation</a> (July 2004). Resized and encoded as WebP. Boundaries: <a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noreferrer">Natural Earth</a>, public domain, 1:10m map units. Small countries and islands have invisible enlarged hit targets.</p>
        <p>Country names and codes contain information from <a href="https://github.com/mledoze/countries" target="_blank" rel="noreferrer">mledoze/countries</a>, available under the <a href="/discovery/country-registry-LICENSE.txt">Open Database License</a>. The modified registry is available in the <a href="/discovery/countries-10m.v5.1.2.json">country dataset</a>. Wikidata identity and photo associations: CC0. Photographs retain their individual licenses below.</p>
        <p>Country and territory flags: flag-icons, MIT. <a href="/discovery/flags/NOTICE.md">Flag sources and licenses</a>. Northern Cyprus SVG: Mike Rohsopht and Commons contributors, <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>, unmodified. Areas without a national flag show only their name.</p>
        {failed && <p>Country photo credits and coverage could not be loaded. Please try again later.</p>}
        {manifest && <>
          <p>Country photo coverage: {manifest.countries.filter(country => country.status === 'ready').length} of {manifest.total} geographic areas. <a href="/discovery/country-photos.v2.json">Source and coverage catalog</a>.</p>
          {manifest.unresolved.length > 0 && <p>Unresolved photographs: {manifest.unresolved.map(country => country.name + ' (' + country.code + ')').join(', ')}. No substitute from another country is displayed.</p>}
          <ul className="space-y-2">
            {manifest.countries.flatMap(country => country.photos.map(photo => (
              <li key={country.code + photo.src}>
                {country.name}{' — '}<a href={photo.sourceUrl} target="_blank" rel="noreferrer">{photo.title}</a>
                {' — '}{photo.creator}{' · '}<a href={photo.licenseUrl} target="_blank" rel="noreferrer">{photo.license}</a>
                {' · '}{photo.changes}{' '}<a href={photo.evidence} target="_blank" rel="noreferrer">Country reference</a>
              </li>
            )))}
          </ul>
        </>}
      </div>
    </details>
  );
}
