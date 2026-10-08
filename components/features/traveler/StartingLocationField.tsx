'use client';
import { useState, type KeyboardEvent } from 'react';
import { LocateFixed } from 'lucide-react';
import type { useStartingLocation } from '@/hooks/use-starting-location';

export function StartingLocationField({ control, id = 'flight-origin', label = 'Starting location', compact = false, showCurrentLocation = true }: { control: ReturnType<typeof useStartingLocation>; id?: string; label?: string; compact?: boolean; showCurrentLocation?: boolean }) {
  const [active, setActive] = useState(-1);
  const [focused, setFocused] = useState(false);
  const expanded = focused && control.suggestions.length > 0;
  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') { setFocused(false); control.dismiss(); setActive(-1); }
    if (!expanded) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); setActive(index => event.key === 'ArrowDown' ? (index + 1) % control.suggestions.length : (index <= 0 ? control.suggestions.length - 1 : index - 1));
    }
    if (event.key === 'Enter' && active >= 0 && control.suggestions[active]) {
      event.preventDefault(); control.select(control.suggestions[active]); setActive(-1); setFocused(false);
    }
  }
  return <div className="relative min-w-0">
    <div className="flex flex-wrap items-center justify-between gap-3"><label htmlFor={id} className="text-xs font-medium text-slate-300">{label}</label>{showCurrentLocation && <button type="button" onClick={() => { setFocused(false); control.detect(); }} disabled={control.detecting} className="inline-flex min-h-9 items-center gap-2 border border-cyan-300/30 px-3 py-2 text-[11px] font-bold text-cyan-200 transition hover:border-cyan-200 hover:bg-cyan-200 hover:text-[#14231f] disabled:opacity-50"><LocateFixed size={14}/>{control.detecting ? 'Finding your location...' : 'Use my current location'}</button>}</div>
    <input id={id} role="combobox" aria-autocomplete="list" aria-expanded={expanded} aria-controls={`${id}-suggestions`} aria-activedescendant={expanded && active >= 0 ? `${id}-option-${active}` : undefined} aria-describedby={`${id}-hint`} autoComplete="off" value={control.value} maxLength={120} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onKeyDown={keyDown} onChange={event => { setActive(-1); setFocused(true); control.change(event.target.value); }} placeholder={showCurrentLocation ? 'Enter your starting city or use your current location.' : 'Enter your starting city.'} className={compact ? 'mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white' : 'mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-2 text-white placeholder:text-slate-600'}/>
    {expanded && <ul id={`${id}-suggestions`} role="listbox" aria-label="Starting location suggestions" className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-1 shadow-xl">{control.suggestions.map((location, index) => <li key={`${location.id}:${location.label}`} id={`${id}-option-${index}`} role="option" aria-selected={active === index}><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => { control.select(location); setActive(-1); setFocused(false); }} className={`w-full rounded-lg px-3 py-2 text-left text-sm text-white hover:bg-slate-800 ${active === index ? 'bg-slate-800' : ''}`}><span className="block font-bold">{location.name}</span><span className="block text-xs text-slate-400">{location.placeType || 'City'} · {location.label}</span></button></li>)}</ul>}
    <span id={`${id}-hint`} className="mt-1 block text-[10px] font-normal text-slate-500">Used as your trip origin.{showCurrentLocation && ' Your browser asks before sharing your location.'}</span>
    {control.searching && <p role="status" className="mt-1 text-[11px] text-slate-400">Finding starting locations...</p>}
    {control.message && <p role="status" className="mt-2 text-[11px] text-cyan-200/80">{control.message}</p>}
  </div>;
}
