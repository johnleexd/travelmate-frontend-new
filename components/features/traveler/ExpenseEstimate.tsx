import type { DayActivity } from '@/lib/contracts';
import type { CurrencyCode } from '@/lib/domain';
import { formatMoney } from '@/lib/domain';
import { activityExpense, isPlanningAllowance } from '@/lib/generated/expense-ledger';

export function expenseLabel(item: DayActivity, currency: CurrencyCode) {
  return activityExpense(item, currency) === null ? 'Estimate unavailable' : isPlanningAllowance(item) ? 'Suggested allowance' : 'Estimated cost';
}
export function ExpenseEstimate({ item, currency, compact = false }: { item: DayActivity; currency: CurrencyCode; compact?: boolean }) {
  const price = item.priceEvidence;
  const amount = activityExpense(item, currency);
  const unit = price?.unit === 'per-room-night' ? 'room/night' : price?.unit === 'daily-per-person' ? 'person/day' : price?.unit === 'per-person' ? 'person' : price?.unit === 'shared-fare' ? 'shared group/day' : price?.unit || 'group';
  if (compact) return <div data-expense-estimate className="text-xs leading-5"><p className="font-semibold">{expenseLabel(item,currency)}</p>{amount !== null && <strong>{formatMoney(amount,currency)} <span className="font-normal">/ group</span></strong>}</div>;
  return <div data-expense-estimate className="text-xs leading-5">
    <p className="font-semibold">{expenseLabel(item, currency)}</p>
    {price && price.currency !== currency && price.status !== 'unavailable' && <p>Original estimate: {formatMoney(price.unitAmount,price.currency)} / {unit}. Excluded from {currency} totals; conversion unavailable.</p>}
    {amount !== null && <><strong>{formatMoney(amount, currency)} <small>group</small></strong>{price && price.quantity > 0 && <p>{formatMoney(price.unitAmount, price.currency)} / {unit} × {price.quantity}{['per-person', 'daily-per-person', 'meal'].includes(price.unit) ? ` × ${price.participants} traveler(s)` : ''}</p>}{price?.quantity === 0 && <p>{item.category === 'accommodation' ? 'No overnight accommodation included' : 'Included once in selected activity costs'}</p>}</>}
    {!compact && <details className="mt-1"><summary className="cursor-pointer">Estimate basis</summary><p>{price?.basis || (amount === null ? 'No supported price or planning allowance is recorded. Enter an estimate.' : 'Historical whole-group estimate; no source was recorded.')}</p>{price && <p>{price.source} · Recorded {new Date(price.fetchedAt).toLocaleDateString()}{price.ruleId ? ` · ${price.ruleId}` : ''}</p>}{price?.sourceUrl && <a className="underline" href={price.sourceUrl} target="_blank" rel="noreferrer">Price source</a>}</details>}
  </div>;
}
