import { ZERO_DECIMAL_CURRENCIES, type CurrencyCode } from '@/lib/domain';
import type { ExpenseAssumptions } from '@/lib/expense-assumptions';

export function ExpenseAssumptionsFields({ value, onChange, currency, travelers, quotedStay }: { value: ExpenseAssumptions; onChange: (value: ExpenseAssumptions) => void; currency: CurrencyCode; travelers: number; quotedStay: boolean }) {
  return <details className="mt-6 border-t border-white/10 pt-5 text-xs text-white/60">
    <summary className="cursor-pointer font-bold text-amber-200">Expense assumptions (optional)</summary>
    <p className="mt-3 leading-5">Enter estimates in {currency}; these are not confirmed provider prices. Blank prices use explicit budget allowances, which cannot confirm affordability. Check these values if you change currency.</p>
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {([['rooms', 'Rooms', Math.ceil(travelers / 2)], ['nightlyRoomEstimate', 'Nightly estimate per room', 'Budget allowance'], ['foodDailyPerPerson', 'Daily food per person', 'Budget allowance'], ['transportFare', 'Daily transport fare', 'Budget allowance'], ['fees', 'Additional group fees', 0], ['contingencyPercent', 'Contingency % of subtotal', 10]] as const).map(([field, label, fallback]) => <label key={field}>{label}<input type="number" min={field === 'rooms' ? 1 : 0} max={field === 'rooms' ? 20 : field === 'contingencyPercent' ? 50 : 10000000} disabled={quotedStay && (field === 'rooms' || field === 'nightlyRoomEstimate')} step={field === 'rooms' || field === 'contingencyPercent' || ZERO_DECIMAL_CURRENCIES.includes(currency) ? 1 : 0.01} value={value[field] ?? ''} placeholder={String(fallback)} onChange={event => onChange({ ...value, [field]: event.target.value === '' ? undefined : Number(event.target.value) })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-2 text-white placeholder:text-slate-600 disabled:opacity-50"/></label>)}
      <label>Transport fare basis<select value={value.transportFareType ?? ''} onChange={event => onChange({ ...value, transportFareType: event.target.value ? event.target.value as 'shared-fare' | 'per-person' : undefined })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-white"><option value="">Use selected mode assumption</option><option value="shared-fare">One shared fare for the group</option><option value="per-person">Fare per traveler</option></select></label>
    </div>
    {quotedStay && <p className="mt-3">Selected provider stay uses its quoted room count and total. Remove that selection to change room assumptions.</p>}
  </details>;
}
