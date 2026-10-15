'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Compass, Globe2, Pause, Play } from 'lucide-react';
import { indexCountries, type Country, type CountryIndex } from '@/lib/discovery-countries';
import { loadCountryPhotoManifest } from '@/lib/discovery-country-photos';
import styles from './TravelDiscovery.module.css';
import DiscoveryCinematicBackground from './DiscoveryCinematicBackground';

const DiscoveryGlobe = dynamic(() => import('./DiscoveryGlobeCanvas'), {
  ssr: false,
  loading: () => <div className={styles.loading} role="status"><Globe2 size={40} /><p>Preparing your globe…</p></div>,
});

let countryRequest: Promise<CountryIndex> | null = null;
function loadCountries() {
  if (!countryRequest) countryRequest = fetch('/discovery/countries-10m.v5.1.2.json', { cache: 'no-cache' })
    .then(response => { if (!response.ok) throw new Error('Country dataset unavailable'); return response.json(); })
    .then((countries: Country[]) => indexCountries(countries))
    .catch(error => { countryRequest = null; throw error; });
  return countryRequest;
}

function subscribeMotion(change: () => void) {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  query.addEventListener('change', change);
  return () => query.removeEventListener('change', change);
}
function readReducedMotion() { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }

export default function TravelDiscoverySection() {
  const reducedMotion = useSyncExternalStore(subscribeMotion, readReducedMotion, () => false);
  const section = useRef<HTMLElement>(null);
  const globeFrame = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [active, setActive] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [paused, setPaused] = useState(false);
  const [countries, setCountries] = useState<CountryIndex | null>(null);
  const [countryFailed, setCountryFailed] = useState(false);
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);
  const selectCountry = useCallback((country: Country) => { setSelectedCountryId(country.id); }, []);
  const reportUnavailable = useCallback(() => setUnavailable(true), []);

  useEffect(() => {
    const element = section.current;
    if (!element) return;
    if (!('IntersectionObserver' in window)) {
      // No renderer polling in old browsers: country discovery remains independent of WebGL.
      return;
    }
    const approach = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setEnabled(true); approach.disconnect(); }
    }, { rootMargin: '250px' });
    const visibility = new IntersectionObserver(entries => {
      setActive(entries.some(entry => entry.isIntersecting));
    }, { threshold: 0 });
    approach.observe(element);
    if (globeFrame.current) visibility.observe(globeFrame.current);
    return () => { approach.disconnect(); visibility.disconnect(); };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void loadCountryPhotoManifest().catch(() => undefined);
    let mounted = true;
    loadCountries().then(value => { if (mounted) setCountries(value); }).catch(() => { if (mounted) setCountryFailed(true); });
    return () => { mounted = false; };
  }, [enabled]);

  return (
    <section ref={section} id="discovery" className={styles.section} aria-labelledby="discovery-heading">
      <DiscoveryCinematicBackground enabled={enabled} reducedMotion={reducedMotion} />
      <div className={styles.inner}>
        <p className={styles.eyebrow}>Explore the World · Interactive Travel Discovery</p>
        <div className={styles.layout}>
          <div className={styles.intro}>
            <span className={styles.compass}><Compass size={26} aria-hidden="true" /></span>
            <h2 id="discovery-heading">Discover real destinations across the globe.</h2>
            <p>Explore destinations around the world through an interactive globe. Select a location to discover its highlights and get inspired for your next adventure.</p>
            <label className={styles.countryPicker}>Discover a country or territory
              <select aria-label="Discover a country or territory" value={selectedCountryId || ""} disabled={!countries}
                onChange={event => { const country = countries?.countries.find(item => item.id === event.target.value); if (country) selectCountry(country); else setSelectedCountryId(null); }}>
                <option value="">Choose a country</option>
                {countries?.countries.map(country => <option key={country.id} value={country.id}>{country.name}</option>)}
              </select>
            </label>
            <p className={styles.countryHint} role="status">{countryFailed ? "Country discovery unavailable. Please try again later." : countries ? "Hover a country for a destination photo. Click to explore." : "Country discovery loads when this section is in view."}</p>
          </div>
          <div className={styles.globeColumn}>
            <div ref={globeFrame} className={styles.globeFrame}>
              {enabled && !unavailable ?
                <DiscoveryGlobe active={active} paused={paused}
                  onUnavailable={reportUnavailable} countries={countries} selectedCountryId={selectedCountryId} onCountrySelect={selectCountry} /> :
                <div className={styles.fallback}>
                  <Globe2 size={112} strokeWidth={0.8} aria-hidden="true" />
                  <p>{unavailable ? 'Interactive globe unavailable in this browser.' : 'Your next adventure starts with a destination.'}</p>
                  <span>You can still select a country using the dropdown.</span>
                </div>}
            </div>
            <div className={styles.globeControls}>
              <span>{enabled && !unavailable ? 'Drag to rotate · Click a country' : 'Explore destinations using the country dropdown.'}</span>
              {enabled && !unavailable && reducedMotion && <span>Rotation paused for reduced motion</span>}
              {enabled && !unavailable && !reducedMotion && <button type="button" aria-pressed={paused}
                onClick={() => setPaused(value => !value)}>
                {paused ? <Play size={14} /> : <Pause size={14} />}
                {paused ? 'Resume rotation' : 'Pause rotation'}
              </button>}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
