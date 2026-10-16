'use client';
import { MapPin } from 'lucide-react';
import { useEffect, useState, type KeyboardEvent } from 'react';
import type { AreaComparisonResponse, AreaInterestProfile, LocationCandidate } from '@/lib/contracts';
import { useDestinationAreas } from '@/hooks/use-destination-areas';
import { destinationAreaClient } from '@/services/destination-area-client';
import { fetchDestinationContext } from '@/services/destination-planning.service';
import { formatMoney, type CurrencyCode } from '@/lib/domain';
import { isDestinationLocality, needsDestinationArea } from '@/lib/generated/location-scope';

function interestScore(profile: AreaInterestProfile | undefined, interests: string) {
  if (!profile) return 0;
  const groups = [/food|cuisine|dining|restaurant|cafe|market/i, /culture|histor|museum|art|sightseeing/i, /nature|park|hiking|outdoor|beach/i];
  const counts = [profile.foodPlaces, profile.culturePlaces, profile.naturePlaces];
  return counts.reduce((sum, count, index) => sum + (groups[index].test(interests) ? count : 0), 0);
}
type Props = { location: LocationCandidate; budget: number; currency: CurrencyCode; currencyResolved: boolean; travelers: number; days: number; interests: string; inModal?: boolean; onDirectSearch?: () => void; onSelect: (location: LocationCandidate) => void; onBrowse: (location: LocationCandidate) => void; onClear: () => void; onVerify: (label: string) => void };
export function DestinationAreaPicker({ location, budget, currency, currencyResolved, travelers, days, interests, inModal = false, onDirectSearch, onSelect, onBrowse, onClear, onVerify }: Props) {
  const [parents, setParents] = useState<Array<Props['location']>>([location]);
  const parent = parents.at(-1)!;
  const [previewCurrency, setPreviewCurrency] = useState<{ key: string; currency?: CurrencyCode }>({ key: '' });
  const areas = useDestinationAreas(parent);
  const [open, setOpen] = useState(true);
  const [active, setActive] = useState(-1);
  const [help, setHelp] = useState(false);
  const [comparison, setComparison] = useState<{ key: string; result?: AreaComparisonResponse; error?: string }>({ key: '' });
  const localities = areas.areas.filter(isDestinationLocality);
  const canSelectParent = isDestinationLocality(parent);
  const ids = localities.slice(0,4).map(city => city.id).join(',');
  const parentId = parent.id, countryCode = parent.countryCode;
  const currencyKey = `${parentId}:${countryCode}`;
  useEffect(()=>{if(inModal)document.getElementById('destination-area-search')?.focus();},[parentId,inModal]);
  const previewKey = previewCurrency.key;
  const parentName = parent.name;
  useEffect(() => {
    if (!help || currencyResolved || previewKey === currencyKey) return;
    const controller = new AbortController();
    void fetchDestinationContext({name:parentName,countryCode},controller.signal)
      .then(context=>{if(!controller.signal.aborted)setPreviewCurrency({key:currencyKey,currency:context.currency || undefined});})
      .catch(()=>{if(!controller.signal.aborted)setPreviewCurrency({key:currencyKey});});
    return ()=>controller.abort();
  }, [help,currencyResolved,currencyKey,previewKey,parentName,countryCode]);
  const allowanceCurrency = currencyResolved ? currency : previewCurrency.key === currencyKey ? previewCurrency.currency : undefined;
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
  const choices = [...localities.slice(0,4)].sort((a,b) => interestScore(profileFor(b.id), interests) - interestScore(profileFor(a.id), interests));
  function browse(city: LocationCandidate) { areas.search(''); setActive(-1); setOpen(true); setHelp(false); setParents(current => [...current,city]); onBrowse(city); }
  function choose(city: LocationCandidate) { if (needsDestinationArea(city)) browse(city); else onSelect(city); }
  function back() {
    if (parents.length === 1) { onClear(); return; }
    const previous = parents.at(-2)!; areas.search(''); setActive(-1); setHelp(false); setOpen(true);
    setParents(current=>current.slice(0,-1)); onBrowse(previous);
  }
  function keyboard(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); setOpen(true);
      setActive(value => event.key === 'ArrowDown' ? Math.min(value + 1, areas.areas.length - 1) : Math.max(0,value - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault(); if (active >= 0 && areas.areas[active]) choose(areas.areas[active]);
    } else if (event.key === 'Escape' && !inModal) { event.preventDefault(); setOpen(false); setActive(-1); }
  }
  return <div className={inModal?'space-y-2 text-xs text-slate-300':'mt-3 space-y-2 rounded-xl border border-slate-700 p-3 text-xs text-slate-300'} data-area-state={areas.status}>
    {inModal && <><button type="button" aria-label="Back" onClick={back} className="min-h-11 rounded-lg px-2 py-2 font-bold text-cyan-300 focus-visible:outline-2">← Back{parents.length>1?` to ${parents.at(-2)!.name}`:' to countries'}</button><nav aria-label="Current browsing selection" className="flex flex-wrap items-center gap-1 text-[11px] text-slate-400"><span>Countries</span>{(parent.locationPath?.length ? parent.locationPath.map(part=>part.name) : parents.map(part=>part.name)).map((name,index,all)=><span key={`${index}:${name}`} className="min-w-0 break-words"><span aria-hidden="true"> › </span><span aria-current={index===all.length-1?'location':undefined}>{name}</span></span>)}</nav></>}
    <div className="flex flex-wrap items-center justify-between gap-2"><label className="block font-bold" htmlFor="destination-area-search">Places within {parent.label}</label>{!inModal && <button type="button" onClick={onClear} className="min-h-11 px-2 py-2 font-bold text-cyan-300 focus-visible:outline-2">Change or clear area</button>}</div>
    {canSelectParent && <section aria-label="Use current destination" className="rounded-xl border border-[#D8E1D7] bg-[#E5EDDF] p-3 text-[#20352D]">
      <p className="font-semibold">{parent.contextLabel}</p>
      <p className="mt-1 text-[11px]">You can choose this place for your trip. Browsing smaller places is optional.</p>
      <button type="button" onClick={() => onSelect(parent)} className="mt-2 min-h-11 rounded-lg bg-[#ffcf70] px-3 py-2 font-bold text-white focus-visible:outline-2">Use {parent.name} as destination</button>
    </section>}
    {!inModal && <p className="text-[11px] text-slate-400">Choose a province, state, or region to browse further, or select a city or town directly. Choosing a city finishes destination selection.</p>}
    {!inModal && parents.length > 1 && <button type="button" onClick={back} className="min-h-11 px-3 py-2 font-bold text-cyan-300">← Back to {parents.at(-2)!.label}</button>}
    {location.countryCode === 'PH' && location.placeType === 'Island' && <p className="text-[11px] text-slate-400">An island is separate from a province. For the complete province list, choose its Province result in Destination.</p>}
    {areas.status === 'ready' && areas.total !== undefined && <p className="text-[11px] text-slate-400">{areas.areas.length} of {areas.total} available matches shown.</p>}
    <input id="destination-area-search" role="combobox" aria-label="City or town within selected destination" aria-autocomplete="list" aria-expanded={open && areas.areas.length > 0} aria-controls="destination-area-options" aria-activedescendant={active >= 0 && active < areas.areas.length ? `destination-area-${active}` : undefined} aria-describedby="destination-area-status" value={areas.query} maxLength={80} onFocus={() => setOpen(true)} onChange={event => { areas.search(event.target.value); setActive(-1); setOpen(true); }} onKeyDown={keyboard} placeholder="Search all available places within this area" autoComplete="off" className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-white placeholder:text-slate-500 focus:border-cyan-400" />
    {open && areas.areas.length > 0 && <ul id="destination-area-options" role="listbox" aria-label="Suggested cities in this area" className="max-h-60 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950/80 p-1">
      {areas.areas.map((city,index) => <li key={city.id} id={`destination-area-${index}`} role="option" aria-selected={active === index}><button type="button" onClick={() => choose(city)} onMouseEnter={() => setActive(index)} className={`min-h-11 w-full rounded-lg px-3 py-2 text-left hover:bg-slate-800 focus:bg-slate-800 focus-visible:outline-2 ${active === index ? 'bg-slate-800' : ''}`} aria-label={`Choose ${city.name}`}><span className="flex items-start gap-3"><MapPin aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-cyan-300"/><span className="min-w-0"><strong className="block text-white">{city.name}</strong><span className="block text-[11px] text-slate-400">{city.contextLabel}</span></span></span>{city.coordinateStatus === 'unresolved' && <span className="block text-[11px] text-amber-200">Select to verify this location.</span>}</button>{city.canBrowse && isDestinationLocality(city) && <button type="button" onClick={() => browse(city)} className="min-h-11 px-3 py-2 font-bold text-cyan-300">Browse within {city.name}</button>}</li>)}
    </ul>}
    <p id="destination-area-status" role="status" className="text-[11px] text-slate-400">{areas.status === 'loading' ? 'Loading suggested cities and towns...' : areas.status === 'error' ? 'Places could not be loaded. This is a provider error, not an empty list. Use Back or retry.' : areas.status === 'empty' ? areas.query.trim() ? `No search matches for "${areas.query.trim()}" within ${parent.name}. Clear the search or go back.` : `No child places are recorded within ${parent.name}. ${canSelectParent ? 'Select this place above, or go back.' : 'Go back to choose another place; lower-level coverage may be unavailable.'}` : inModal ? 'Search checks all available records within this area.' : areas.message}</p>
    {areas.status === 'empty' && <div className="flex flex-wrap gap-2">{areas.query.trim() && <button type="button" onClick={() => { areas.search(''); setActive(-1); }} className="min-h-11 rounded-lg border border-current/30 px-3 py-2 font-bold">Clear place search</button>}<button type="button" onClick={back} className="min-h-11 rounded-lg border border-current/30 px-3 py-2 font-bold">{parents.length > 1 ? `Back to ${parents.at(-2)!.name}` : 'Back to countries'}</button></div>}
    {(areas.status === 'error' || areas.status === 'empty' && areas.coverage === 'partial-geographic') && <p className="text-[11px] text-slate-400">{areas.message}</p>}
    {areas.status === 'error' && <button type="button" onClick={areas.retry} className="border border-amber-300/40 px-3 py-2 font-bold text-amber-200">Retry area suggestions</button>}
    {areas.query.trim().length >= 2 && areas.status !== 'loading' && <button type="button" onClick={() => onVerify(`${areas.query.trim()}, ${parent.label}`)} className="min-h-11 px-3 py-2 font-bold text-cyan-300">Verify “{areas.query.trim()}” within {parent.label} with OpenStreetMap</button>}
    <div className="flex flex-wrap gap-2">
      {!open && areas.areas.length > 0 && <button type="button" onClick={() => setOpen(true)} className="px-3 py-2 font-bold text-cyan-300">Show suggested cities</button>}
      {areas.nextOffset !== null && <button type="button" disabled={areas.loadingMore} onClick={areas.showMore} className="border border-cyan-700/60 px-3 py-2 font-bold text-cyan-300 disabled:opacity-50">{areas.loadingMore ? 'Loading more...' : 'Load more'}</button>}
      <button type="button" disabled={localities.length === 0} aria-expanded={help} onClick={() => setHelp(value => !value)} className="border border-amber-300/40 px-3 py-2 font-bold text-amber-200 disabled:opacity-50">{help ? 'Close comparison' : 'Help me choose'}</button>
    </div>
    {areas.coverage === 'partial-geographic' && <button type="button" onClick={() => {if(inModal)onDirectSearch?.();else document.getElementById('destination-search')?.focus();}} className="px-3 py-2 font-bold text-cyan-300">Search another verified place in Destination</button>}
    {areas.sourceUrls.length > 0 && <p className="text-[10px] text-slate-500">Geography: {areas.coverage === 'complete-administrative' ? <a href="https://psa.gov.ph/classification/psgc" target="_blank" rel="noreferrer" className="underline">PSA PSGC{areas.catalogueAsOf ? ` · checked against ${areas.catalogueAsOf}` : ''}</a> : <a href="https://www.geonames.org/" target="_blank" rel="noreferrer" className="underline">GeoNames</a>}{areas.sourceUrls.some(url => url.includes('openstreetmap.org')) && <> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">© OpenStreetMap contributors</a></>} · checked {new Date(areas.fetchedAt).toLocaleDateString()}</p>}
    {help && <section aria-label="Compare suggested areas" className="space-y-3 rounded-xl border border-amber-300/30 bg-slate-950/50 p-3">
      <h3 className="font-bold text-amber-200">Compare areas before choosing</h3>
      <p>{allowanceCurrency && budget > 0 && days > 0 && travelers > 0 ? `Your budget allows ${formatMoney(budget / days / travelers,allowanceCurrency)} per person per day across all expenses (${travelers} ${travelers === 1 ? 'traveler' : 'travelers'}, ${days} days).` : 'Enter a budget, dates and traveler count to compare your daily allowance.'}</p>
      {!currencyResolved && allowanceCurrency && <p className="text-[11px] text-slate-400">Preview assumes your entered budget is in {allowanceCurrency}, the supported currency for this area. Confirm a destination to set your trip currency.</p>}
      <p className="text-[11px] text-slate-400">This is a budget allowance, not a price estimate. Accommodation affordability is not confirmed; choosing a city loads its mapped stays and any available quotes.</p>
      <p className="text-[11px] text-cyan-200">Compare up to four current suggestions using mapped attractions and your trip budget; no city is selected automatically.</p>
      {interests.trim() && <p className="text-[10px] text-slate-400">Areas with more mapped matches for your saved preferences appear first; mapping coverage can affect this order.</p>}
      {comparison.key !== comparisonKey || !comparison.result && !comparison.error ? <p role="status">Loading mapped interest information...</p> : comparison.error ? <p role="status" className="text-amber-200">{comparison.error}</p> : <p className="text-[10px] text-slate-400">{comparison.result?.disclaimer} <a href="https://www.openstreetmap.org/copyright" className="underline" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a> · retrieved {new Date(comparison.result!.fetchedAt).toLocaleString()}</p>}
      {choices.map(city => { const profile = profileFor(city.id); return <article key={city.id} className="rounded-lg border border-slate-700 p-3"><strong className="text-white">{city.name}</strong><p className="mt-1 text-[11px] text-slate-400">{city.description}</p>{profile ? <p className="mt-1 text-[11px] text-cyan-200">Mapped sample within {comparison.result?.radiusKm} km: {profile.foodPlaces} food places · {profile.culturePlaces} cultural places · {profile.naturePlaces} nature places.</p> : <p className="mt-1 text-[11px] text-slate-400">Mapped interest details: Not available.</p>}<button type="button" onClick={() => onSelect(city)} className="mt-2 border border-cyan-700/60 px-3 py-2 font-bold text-cyan-300">Choose {city.name} and find stays</button></article>; })}
    </section>}
  </div>;
}
