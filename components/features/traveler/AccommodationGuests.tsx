'use client';
import { useState } from 'react';
import type { RoomOccupancy } from '@/lib/contracts';

export function AccommodationGuests({ occupancy, travelers, onChange, guestNationality = '', onNationalityChange }: { guestNationality?: string; onNationalityChange?: (country: string) => void; occupancy: RoomOccupancy; travelers: number; onChange: (rooms: RoomOccupancy) => void }) {
  const [draft, setDraft] = useState(occupancy.map(room => ({ adults: String(room.adults), ages: room.childAges.join(', ') })));
  const [error, setError] = useState('');
  const field = 'mt-1 min-h-10 w-full rounded-lg border border-white/15 bg-[#0b1d1a] px-3 text-xs text-white focus:outline-[#ffcf70]';
  function apply() {
    const rooms = draft.map(room => ({ adults: Number(room.adults), childAges: room.ages.trim() ? room.ages.split(',').map(age => Number(age.trim())) : [] }));
    if (rooms.some((room, i) => !Number.isInteger(room.adults) || room.adults < 1 || room.adults > 8 || room.childAges.length > 6 || (Boolean(draft[i].ages.trim()) && /(^|,)\s*(,|$)/.test(draft[i].ages)) || room.childAges.some(age => !Number.isInteger(age) || age < 0 || age > 17))) {
      setError('Each room needs 1–8 adults. Enter each child’s age from 0–17, separated by commas.'); return;
    }
    if (rooms.reduce((sum, room) => sum + room.adults + room.childAges.length, 0) !== travelers) { setError('Room guests must equal the ' + travelers + ' travelers in your trip.'); return; }
    setError(''); onChange(rooms);
  }
  return <details className="mt-3 rounded-lg border border-white/10 p-3 text-xs text-white/65">
    <summary className="cursor-pointer font-semibold text-[#ffcf70]">Rooms and guests · {occupancy.length} {occupancy.length === 1 ? 'room' : 'rooms'}</summary>
    <p className="mt-3 text-[11px] leading-5 text-white/45">Tell the property how many adults and children will stay in each room. Dates and occupancy determine room prices.</p>
    {onNationalityChange && <label className="mt-3 block">Guests’ nationality (country code)<input aria-label="Guests nationality" className={field} value={guestNationality} onChange={event => onNationalityChange(event.target.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,2))} maxLength={2} placeholder="e.g. PH for Philippines"/><span className="mt-1 block text-[11px] text-white/45">Use the guests’ actual nationality. The hotel provider requires this to check room prices.</span></label>}
    <label className="mt-3 block">Number of rooms<select aria-label="Number of accommodation rooms" className={field} value={draft.length} onChange={event => { const count = Number(event.target.value); setDraft(Array.from({ length: count }, (_, i) => draft[i] || { adults: '1', ages: '' })); }}>{Array.from({ length: Math.min(8, travelers) }, (_, i) => <option key={i} value={i+1}>{i+1}</option>)}</select></label>
    {draft.map((room, index) => <fieldset key={index} className="mt-3 grid gap-3 sm:grid-cols-2"><legend className="mb-1 text-white/80">Room {index+1}</legend>
      <label>Adults<input aria-label={'Room ' + (index+1) + ' adults'} type="number" min="1" max="8" className={field} value={room.adults} onChange={event => setDraft(draft.map((r, i) => i === index ? { ...r, adults: event.target.value } : r))}/></label>
      <label>Children’s ages<input aria-label={'Room ' + (index+1) + ' children ages'} className={field} value={room.ages} onChange={event => setDraft(draft.map((r, i) => i === index ? { ...r, ages: event.target.value } : r))} placeholder="Leave blank for no children" maxLength={40}/></label>
    </fieldset>)}
    {error && <p role="alert" className="mt-3 text-amber-200">{error}</p>}
    <button type="button" onClick={apply} className="mt-3 min-h-10 rounded-lg border border-[#ffcf70]/30 px-3 font-semibold text-[#ffcf70] focus-visible:outline-2 focus-visible:outline-[#ffcf70]">Update room guests</button>
  </details>;
}
