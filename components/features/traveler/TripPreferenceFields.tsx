import { TRAVEL_STYLE_OPTIONS } from '@/lib/generated/trip-preferences';

export function TripPreferenceFields({ travelStyle, onTravelStyleChange }: {
  travelStyle: string;
  onTravelStyleChange: (value: string) => void;
}) {
  return (
    <div className="sm:col-span-2 text-xs font-medium text-slate-300">
      <label htmlFor="trip-travel-style">Travel style</label>
      <select id="trip-travel-style" value={travelStyle} onChange={event => onTravelStyleChange(event.target.value)} aria-describedby="trip-travel-style-help" className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-white transition hover:border-slate-600 focus:border-violet-400">
        {!TRAVEL_STYLE_OPTIONS.some(option => option.value === travelStyle) && <option value={travelStyle}>{travelStyle ? `Saved style: ${travelStyle}` : 'Not saved — choose a style'}</option>}
        {TRAVEL_STYLE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <p id="trip-travel-style-help" className="mt-1.5 text-[11px] font-normal text-white/50">Choose the overall focus of your trip.</p>
    </div>
  );
}
