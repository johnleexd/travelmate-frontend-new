'use client';
import { useEffect, useState, type KeyboardEvent } from 'react';
import type { AreaComparisonResponse, AreaInterestProfile, LocationSuggestion } from '@/lib/contracts';
import { useDestinationAreas } from '@/hooks/use-destination-areas';
import { destinationAreaClient } from '@/services/destination-area-client';
import { formatMoney, type CurrencyCode } from '@/lib/domain';

function interestScore(profile: AreaInterestProfile | undefined, interests: string) {
  if (!profile) return 0;
  const groups = [/food|cuisine|dining|restaurant|cafe|market/i, /culture|histor|museum|art|sightseeing/i, /nature|park|hiking|outdoor|beach/i];
  const counts = [profile.foodPlaces, profile.culturePlaces, profile.naturePlaces];
  return counts.reduce((sum, count, index) => sum + (groups[index].test(interests) ? count : 0), 0);
}
type Props = { location: Pick<LocationSuggestion,'id' | 'countryCode' | 'label'>; budget: number; currency: CurrencyCode; currencyResolved: boolean; travelers: number; days: number; interests: string; onSelect: (location: LocationSuggestion) => void };
export function DestinationAreaPicker({ location, budget, currency, currencyResolved, travelers, days, interests, onSelect }: Props) {
  const areas = useDestinationAreas(location);
  const [open, setOpen] = useState(true);
  const [active, setActive] = useState(-1);
  const [help, setHelp] = useState(false);
  const [comparison, setComparison] = useState<{ key: string; result?: AreaComparisonResponse; error?: string }>({ key: '' });
  const ids = areas.areas.slice(0,4).map(city => city.id).join(',');
  const parentId = location.id, countryCode = location.countryCode;
  const comparisonKey = `${parentId}:${countryCode}:${ids}`;
  useEffect(() => {
    if (!help || !ids) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setComparison({ key: comparisonKey });
      void destinationAreaClient.compare({ id: parentId, countryCode }, ids.split(',').map(Number), controller.signal)
        .then(result => { if (!controller.signal.aborted) setComparison({ key: comparisonKey, result }); })
        .catch(error => { if (!controller.signal.aborted) setComparison({ key: comparisonKey, error: error instanceof Error ? error.message : 'Mapped interests are unavailable.' }); });
    }, 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [help, ids, parentId, countryCode, comparisonKey]);
  const profileFor = (id: number) => comparison.key === comparisonKey ? comparison.result?.profiles.find(profile => profile.cityId === id) : undefined;
  const choices = [...areas.areas.slice(0,4)].sort((a,b) => interestScore(profileFor(b.id), interests) - interestScore(profileFor(a.id), interests));
  function keyboard(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); setOpen(true);
      setActive(value => event.key === 'ArrowDown' ? Math.min(value + 1, areas.areas.length - 1) : Math.max(0,value - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault(); if (active >= 0 && areas.areas[active]) onSelect(areas.areas[active]);
    } else if (event.key === 'Escape') { event.preventDefault(); setOpen(false); setActive(-1); }
  }
  return <div className="mt-3 space-y-2 text-xs text-slate-300" data-area-state={areas.status}>
    <label className="block" htmlFor="destination-area-search">Suggested cities and towns within {location.label}</label>
    <input id="destination-area-search" role="combobox" aria-label="City or town within selected destination" aria-autocomplete="list" aria-expanded={open && areas.areas.length > 0} aria-controls="destination-area-options" aria-activedescendant={active >= 0 ? `destination-area-${active}` : undefined} aria-describedby="destination-area-status" value={areas.query} maxLength={80} onFocus={() => setOpen(true)} onChange={event => { areas.search(event.target.value); setActive(-1); setOpen(true); }} onKeyDown={keyboard} placeholder="Search suggested cities or towns" autoComplete="off" className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-white placeholder:text-slate-500 focus:border-cyan-400" />
    {open && areas.areas.length > 0 && <ul id="destination-area-options" role="listbox" aria-label="Suggested cities in this area" className="max-h-60 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950/80 p-1">
      {areas.areas.map((city,index) => <li key={city.id} id={`destination-area-${index}`} role="option" aria-selected={active === index}><button type="button" onClick={() => onSelect(city)} onMouseEnter={() => setActive(index)} className={`min-h-11 w-full rounded-lg px-3 py-2 text-left hover:bg-slate-800 focus:bg-slate-800 ${active === index ? 'bg-slate-800' : ''}`} aria-label={`Choose ${city.name}`}><strong className="block text-white">{city.name}</strong><span className="block text-[11px] text-slate-400">{city.description}</span></button></li>)}
    </ul>}
    <p id="destination-area-status" role="status" className="text-[11px] text-slate-400">{areas.status === 'loading' ? 'Loading suggested cities and towns...' : areas.message}</p>
    {areas.status === 'error' && <button type="button" onClick={areas.retry} className="border border-amber-300/40 px-3 py-2 font-bold text-amber-200">Retry area suggestions</button>}
    <div className="flex flex-wrap gap-2">
      {!open && areas.areas.length > 0 && <button type="button" onClick={() => setOpen(true)} className="px-3 py-2 font-bold text-cyan-300">Show suggested cities</button>}
      {areas.nextOffset !== null && <button type="button" disabled={areas.loadingMore} onClick={areas.showMore} className="border border-cyan-700/60 px-3 py-2 font-bold text-cyan-300 disabled:opacity-50">{areas.loadingMore ? 'Loading more cities...' : 'Show more cities and towns'}</button>}
      <button type="button" disabled={areas.areas.length === 0} aria-expanded={help} onClick={() => setHelp(value => !value)} className="border border-amber-300/40 px-3 py-2 font-bold text-amber-200 disabled:opacity-50">{help ? 'Close comparison' : 'Help me choose'}</button>
    </div>
    {areas.sourceUrls.length > 0 && <p className="text-[10px] text-slate-500">Geography: <a href="https://www.geonames.org/" target="_blank" rel="noreferrer" className="underline">GeoNames</a>{areas.sourceUrls.some(url => url.includes('openstreetmap.org')) && <> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">© OpenStreetMap contributors</a></>} · checked {new Date(areas.fetchedAt).toLocaleDateString()}</p>}
    {help && <section aria-label="Compare suggested areas" className="space-y-3 rounded-xl border border-amber-300/30 bg-slate-950/50 p-3">
      <h3 className="font-bold text-amber-200">Compare areas before choosing</h3>
      <p>{currencyResolved && budget > 0 && days > 0 && travelers > 0 ? `Your budget allows ${formatMoney(budget / days / travelers,currency)} per person per day across all expenses (${travelers} ${travelers === 1 ? 'traveler' : 'travelers'}, ${days} days).` : 'Enter a budget, dates and traveler count to compare your daily allowance.'}</p>
      <p className="text-[11px] text-slate-400">This is a budget allowance, not a price estimate. Accommodation affordability is not confirmed; choosing a city loads its mapped stays and any available quotes.</p>
      <p className="text-[11px] text-cyan-200">Interests: {interests.trim() || 'No preferences entered'}. Compare up to four current suggestions; no city is selected automatically.</p>
      <p className="text-[10px] text-slate-400">Areas with more mapped matches for your interests appear first; mapping coverage can affect this order.</p>
      {comparison.key !== comparisonKey || !comparison.result && !comparison.error ? <p role="status">Loading mapped interest information...</p> : comparison.error ? <p role="status" className="text-amber-200">{comparison.error}</p> : <p className="text-[10px] text-slate-400">{comparison.result?.disclaimer} <a href="https://www.openstreetmap.org/copyright" className="underline" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a> · retrieved {new Date(comparison.result!.fetchedAt).toLocaleString()}</p>}
      {choices.map(city => { const profile = profileFor(city.id); return <article key={city.id} className="rounded-lg border border-slate-700 p-3"><strong className="text-white">{city.name}</strong><p className="mt-1 text-[11px] text-slate-400">{city.description}</p>{profile ? <p className="mt-1 text-[11px] text-cyan-200">Mapped sample within {comparison.result?.radiusKm} km: {profile.foodPlaces} food places · {profile.culturePlaces} cultural places · {profile.naturePlaces} nature places.</p> : <p className="mt-1 text-[11px] text-slate-400">Mapped interest details: Not available.</p>}<button type="button" onClick={() => onSelect(city)} className="mt-2 border border-cyan-700/60 px-3 py-2 font-bold text-cyan-300">Choose {city.name} and find stays</button></article>; })}
    </section>}
  </div>;
}
