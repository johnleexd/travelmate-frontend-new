'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { LocationCandidate, LocationSearchResponse } from '@/lib/contracts';
import type { CurrencyCode } from '@/lib/domain';
import { searchLocationPage, resolveAdministrativeDestination, resolveManualDestination } from '@/services/destination-planning.service';
import { handleResponse } from '@/services/api.service';
import { DestinationAreaPicker } from './DestinationAreaPicker';
import { Dialog } from 'radix-ui';
import styles from './TravelerDashboard.module.css';
import { MapPin, Check, X } from 'lucide-react';
import { CountryFlag } from './CountryFlag';

type Props = {
  selected: LocationCandidate | null;
  onSelect: (place: LocationCandidate) => Promise<boolean>;
  onClear: () => void;
  budget: number; currency: CurrencyCode; currencyResolved: boolean;
  travelers: number; days: number; interests: string;
};
const area = (place: LocationCandidate) => ['country','area'].includes(place.scopeType || '') || ['Country','Province','Region','Administrative area','Island'].includes(place.placeType);

/** Search and browsing are drafts. Only a verified final choice changes trip state. */
export function DestinationSelector({ selected, onSelect, onClear, ...planning }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const destinationInput = useRef<HTMLInputElement>(null);
  const directDraft = useRef('');
  const request = useRef<AbortController | null>(null);
  const revision = useRef(0);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'search' | 'countries'>('search');
  const [query, setQuery] = useState('');
  const [parent, setParent] = useState<LocationCandidate | null>(null);
  const [results, setResults] = useState<LocationCandidate[]>([]);
  const [offset, setOffset] = useState(0);
  const [next, setNext] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [active, setActive] = useState(-1);
  const [verified, setVerified] = useState(false);
  const [country, setCountry] = useState<LocationCandidate | null>(null);
  const countryRef = useRef<LocationCandidate | null>(null);
  function scopeCountry(place: LocationCandidate | null) { countryRef.current = place; setCountry(place); }
  function clearCountry() { scopeCountry(null); directDraft.current=''; start('search'); }

  function cancel() { revision.current++; request.current?.abort(); }
  function close(returnFocus = false) {
    cancel(); setOpen(false); setParent(null); setResults([]); setBusy(false); setMessage('');
    if (mode === 'countries' || parent) { setMode('search'); setQuery(directDraft.current); }
    if (returnFocus) destinationInput.current?.focus();
  }
  function start(nextMode: 'search' | 'countries', text = '') {
    cancel(); setMode(nextMode); setQuery(text); setOffset(0); setNext(null); setParent(null);
    setResults([]); setActive(-1); setVerified(false); setMessage(''); setBusy(false); setOpen(true);
  }
  function clearDestination() {
    directDraft.current = '';
    cancel(); setQuery(''); setParent(null); setMode('search'); setOffset(0); setNext(null);
    setResults([]); setActive(-1); setVerified(false); setMessage(''); setBusy(false); setOpen(false);
    onClear();
    requestAnimationFrame(()=>destinationInput.current?.focus());
  }
  function editDestination(value: string) {
    directDraft.current = value;
    if (!value.trim() && selected) clearDestination();
    else start('search',value);
  }
  function keyboard(event: KeyboardEvent<HTMLInputElement>) {
    if (!open || parent) return;
    if (event.key==='ArrowDown'||event.key==='ArrowUp') { event.preventDefault(); setActive(index=>event.key==='ArrowDown'?Math.min(index+1,results.length-1):Math.max(0,index-1)); }
    else if (event.key==='Enter') { event.preventDefault(); if (results[active]) void choose(results[active]); }
  }
  useEffect(() => {
    if (!open || mode === 'countries' || parent) return;
    function outside(event: PointerEvent) { if (!root.current?.contains(event.target as Node)) close(); }
    function escape(event: globalThis.KeyboardEvent) { if (event.key === 'Escape') { event.preventDefault(); close(true); } }
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  // Closing invalidates every pending operation; listeners always use current refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open,mode,parent]);
  useEffect(() => {
    if (!open || parent || verified || mode === 'search' && query.trim().length < 2 && !countryRef.current) return;
    const controller = new AbortController(); request.current = controller;
    const token = ++revision.current;
    const timer = setTimeout(() => {
      setBusy(true); setMessage('');
      const task = mode === 'countries'
        ? fetch(`/api/locations?kind=countries&q=${encodeURIComponent(query.trim())}&offset=${offset}`, { signal: controller.signal }).then(handleResponse<LocationSearchResponse>)
        : searchLocationPage(query, offset, controller.signal, countryRef.current?.countryCode);
      void task.then(page => {
        if (controller.signal.aborted || token !== revision.current) return;
        if (mode === 'search' && page.countryScope) scopeCountry(page.countryScope);
        setResults(prior => { const existing = offset ? prior : []; const ids = new Set(existing.map(p => p.id)); return [...existing,...page.locations.filter(p => !ids.has(p.id))]; });
        setNext(page.nextOffset ?? null); setMessage(page.message || (page.locations.length ? '' : 'No catalogue matches. Try verified geocoding.'));
      }).catch(error => { if (!controller.signal.aborted && token === revision.current) setMessage(error instanceof Error ? error.message : 'Search unavailable. Retry.'); })
        .finally(() => { if (!controller.signal.aborted && token === revision.current) setBusy(false); });
    }, query ? 300 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, parent, verified, mode, query, offset]);
  useEffect(() => () => { request.current?.abort(); }, []);

  async function choose(input: LocationCandidate) {
    cancel(); setResults([]); setActive(-1);
    if (area(input)) { if (input.placeType === 'Country') scopeCountry(input); setParent(input); setBusy(false); return; }
    const controller = new AbortController(); request.current = controller;
    const token = revision.current;
    setBusy(true); setMessage('Verifying destination…');
    try {
      const place = input.provider === 'psgc' && (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) ? await resolveAdministrativeDestination(input,controller.signal) : input;
      if (controller.signal.aborted || revision.current !== token) return;
      if (await onSelect(place)) { directDraft.current = place.label; close(true); }
      else setMessage('The destination could not be confirmed. Try again.');
    } catch (error) { if (!controller.signal.aborted && revision.current === token) setMessage(error instanceof Error ? error.message : 'Coordinates could not be verified.'); }
    finally { if (!controller.signal.aborted && revision.current === token) setBusy(false); }
  }
  async function verify(label: string) {
    const inModal = mode === 'countries' || Boolean(parent);
    cancel(); setParent(null); setMode(inModal ? 'countries' : 'search'); setQuery(label); setVerified(true); setResults([]); setNext(null); setBusy(true);
    const controller = new AbortController(); request.current = controller; const token = revision.current;
    try {
      const response = await resolveManualDestination(countryRef.current && !inModal ? `${label}, ${countryRef.current.country}` : label,controller.signal);
      if (controller.signal.aborted || token !== revision.current) return;
      if (response.location && (!countryRef.current || response.location.countryCode === countryRef.current.countryCode)) await choose(response.location);
      else { setResults([...response.candidates,...response.areas].filter((p,i,all)=>(!countryRef.current || p.countryCode === countryRef.current.countryCode) && all.findIndex(other=>other.id===p.id)===i)); setMessage(response.message); setBusy(false); }
    } catch (error) { if (!controller.signal.aborted && token === revision.current) { setBusy(false); setMessage(error instanceof Error ? error.message : 'Verification unavailable.'); } }
  }
  const button = 'min-h-11 rounded-lg px-3 py-2 font-bold text-cyan-300 focus-visible:outline-2';
  const modalOpen = open && (mode === 'countries' || Boolean(parent));
  const inputValue = mode === 'search' && !parent && (open || !selected) ? query : selected?.label || '';
  const renderResults = (countries = false) => <>
    {results.length>0 && <ul id={countries?'destination-country-options':'destination-suggestions'} role="listbox" aria-label={countries?'Countries':'Places matching this name'} className="max-h-64 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-1">{results.map((place,index)=><li key={place.id} id={`destination-option-${index}`} role="option" aria-selected={active===index}><button type="button" onClick={()=>void choose(place)} onMouseEnter={()=>setActive(index)} className={`min-h-11 w-full rounded-lg px-3 py-2 text-left hover:bg-slate-800 focus-visible:outline-2 ${active===index?'bg-slate-800':''}`}><span className="flex items-start gap-3">{place.placeType==='Country'?<CountryFlag code={place.countryCode}/>:<MapPin aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-cyan-300"/>}<span className="min-w-0"><strong className="block text-sm text-white">{place.name}{place.placeType==='Country'?' — Browse places':!countries && place.name!==place.country?`, ${place.country}`:''}</strong><span className="block text-[11px] text-slate-400">{place.contextLabel}</span></span></span></button></li>)}</ul>}
    {next!==null && <button type="button" disabled={busy} onClick={()=>setOffset(next)} className={button}>{countries?'Load more countries':'Load more destinations'}</button>}
    {query.trim().length>=2 && !busy && !countries && <button type="button" onClick={()=>void verify(query)} className={button}>Verify “{query.trim()}” with OpenStreetMap</button>}
    <p role="status" className="text-[11px] text-slate-500">{busy?'Searching destinations…':message}</p>
  </>;
  const attribution = <p className="mt-1 text-[10px] text-slate-500">Destination data: <a href="https://psa.gov.ph/classification/psgc" target="_blank" rel="noreferrer" className="underline">PSA PSGC</a> · <a href="https://www.geonames.org/" target="_blank" rel="noreferrer" className="underline">GeoNames</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">© OpenStreetMap contributors</a></p>;
  return <Dialog.Root open={modalOpen} onOpenChange={value=>{if(value){directDraft.current=inputValue;start('countries');}else close();}}>
    <div ref={root} className="relative sm:col-span-2 text-xs font-medium text-slate-300" data-destination-open={open}>
      <label htmlFor="destination-search">Destination</label>
      {country && <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-[#D8E1D7] bg-[#E5EDDF] px-3 py-1 text-[#24564B]" data-country-filter={country.countryCode}><CountryFlag code={country.countryCode}/><span className="font-semibold">{country.name} only</span><button type="button" aria-label="Clear country filter" onClick={clearCountry} className="ml-auto flex min-h-9 min-w-9 items-center justify-center rounded-lg focus-visible:outline-2"><X aria-hidden="true" size={16}/></button></div>}
      <div className="relative mt-1.5">
        <MapPin aria-hidden="true" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#24564B]" data-search-pin />
        {selected && inputValue===selected.label && <Check aria-label="Destination confirmed" size={16} className="pointer-events-none absolute right-16 top-1/2 -translate-y-1/2 text-[#24564B]" data-destination-confirmed />}
        <input ref={destinationInput} id="destination-search" role="combobox" aria-label="Destination" aria-autocomplete="list" aria-expanded={open && !modalOpen && results.length>0} aria-controls="destination-suggestions" aria-activedescendant={!modalOpen&&active>=0?`destination-option-${active}`:undefined} aria-describedby="destination-status" value={inputValue} maxLength={100} onClick={()=>{if(!selected && !open && query.trim().length>=2)start('search',query);}} onChange={event=>editDestination(event.target.value)} onKeyDown={keyboard} placeholder="Where do you want to go?" autoComplete="off" className="w-full rounded-xl border border-slate-700 bg-slate-950/80 pl-10 py-2 pr-24 text-white focus:border-cyan-400" />
        {inputValue && <button type="button" aria-label="Clear destination" onClick={clearDestination} className="absolute inset-y-0 right-1 min-w-12 rounded-lg px-2 text-[11px] font-bold text-cyan-300 focus-visible:outline-2">Clear</button>}
        {open && !modalOpen && (query.trim().length>=2 || country) && <div className="absolute top-full z-30 mt-12 w-full space-y-2 rounded-xl border border-slate-700 bg-slate-950 p-2 shadow-xl">{renderResults()}{attribution}</div>}
      </div>
      <Dialog.Trigger asChild><button type="button" className="mt-1 min-h-11 rounded-lg px-1 py-2 text-[11px] font-semibold text-cyan-300 underline underline-offset-4 focus-visible:outline-2">Browse by country</button></Dialog.Trigger>
      <p id="destination-status" aria-live="polite" className="text-[11px] text-emerald-300">{selected?`Confirmed: ${selected.contextLabel}`:'Search for a destination and choose a result.'}</p>
      {attribution}
    </div>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[80] bg-[#102824]/40" />
      <Dialog.Content className={`${styles.theme} fixed left-1/2 top-1/2 z-[81] flex max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[#D8E1D7] bg-[#FFFEFA] text-[#20352D] shadow-2xl focus:outline-none`} onOpenAutoFocus={event=>{event.preventDefault();document.getElementById(parent?'destination-area-search':'destination-country-search')?.focus();}} onCloseAutoFocus={event=>{event.preventDefault();destinationInput.current?.focus();}}>
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[#D8E1D7] p-4 sm:p-5"><div><Dialog.Title className="text-xl font-bold">Browse destinations by country</Dialog.Title><Dialog.Description className="mt-1 text-xs text-[#52645A]">Choose an area to explore, then select a city or town for your trip.</Dialog.Description></div><Dialog.Close asChild><button type="button" aria-label="Close destination browser" className="min-h-11 rounded-lg border border-[#D8E1D7] px-3 text-xs font-semibold focus-visible:outline-2">Close</button></Dialog.Close></header>
        <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
          {parent ? <><DestinationAreaPicker key={`${parent.id}:${parent.countryCode}`} inModal location={parent} {...planning} onSelect={place=>void choose(place)} onBrowse={()=>{cancel();setBusy(false);setMessage('');}} onClear={()=>{scopeCountry(null);start('countries');}} onDirectSearch={()=>close(true)} onVerify={label=>void verify(label)} /><p role="status" aria-live="polite" className="mt-2 text-[11px] text-slate-500">{busy?'Verifying the selected destination…':message}</p></> : <div className="space-y-3">
            <button type="button" aria-label="Back" disabled className={`${button} disabled:opacity-40`}>← Back</button>
            <nav aria-label="Current browsing selection" className="text-xs text-slate-400"><span aria-current="location">Countries</span></nav>
            <label htmlFor="destination-country-search" className="block text-xs font-bold">{verified?'Verified place search':'Choose a country'}</label>
            <input id="destination-country-search" role="combobox" aria-label="Country" aria-autocomplete="list" aria-expanded={results.length>0} aria-controls="destination-country-options" aria-activedescendant={active>=0?`destination-option-${active}`:undefined} value={query} maxLength={100} onChange={event=>start('countries',event.target.value)} onKeyDown={keyboard} placeholder="Search countries" autoComplete="off" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-400" />
            {renderResults(true)}
          </div>}
          <p className="mt-3 text-[11px] text-slate-400">Search checks the full available source within the chosen area. Administrative levels and smaller-place coverage vary by country. Selecting a city or town finishes selection; further browsing is optional.</p>
          {attribution}
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
