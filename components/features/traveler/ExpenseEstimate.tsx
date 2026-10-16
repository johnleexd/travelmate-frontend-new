import type { DayActivity } from '@/lib/contracts';
import { formatMoney, type CurrencyCode } from '@/lib/domain';
import { activityExpense, expenseCoverage, isPlanningAllowance, isPerPersonUnit } from '@/lib/generated/expense-ledger';

export function expenseLabel(item: DayActivity, currency: CurrencyCode) {
  return activityExpense(item, currency) === null ? 'Estimate unavailable' : isPlanningAllowance(item) ? 'Suggested allowance' : 'Estimated cost';
}
export function ExpenseEstimate({ item, currency, travelers, compact = false }: { item: DayActivity; currency: CurrencyCode; travelers?: number; compact?: boolean }) {
  const price = item.priceEvidence;
  const coverage = expenseCoverage(item, currency);
  const unit = price?.unit === 'per-room-night' ? 'room/night' : price?.unit === 'daily-per-person' ? 'person/day' : price?.unit === 'per-person' ? 'person' : price?.unit === 'shared-fare' ? 'shared fare' : price?.unit === 'group' ? 'party' : price?.unit;
  const shares = coverage?.shares ?? [];
  const unequal = new Set(shares).size > 1;
  return <div data-expense-estimate className="text-xs leading-5">
    <p className="font-semibold">{expenseLabel(item, currency)}</p>
    {coverage ? <>
      {!coverage.includedElsewhere && <strong>{formatMoney(coverage.total, currency)}{coverage.travelers > 1 ? ' total' : ''} <span className="font-normal">· {coverage.travelers} {coverage.travelers === 1 ? 'traveler' : 'travelers'}</span></strong>}
      {!coverage.includedElsewhere && coverage.travelers > 1 && <p>{unequal ? `${formatMoney(Math.min(...shares), currency)}–${formatMoney(Math.max(...shares), currency)}` : formatMoney(shares[0], currency)} {coverage.equalShare ? 'estimated equal share per traveler' : 'estimated per person'}</p>}
      {unequal && <details><summary className="cursor-pointer">Traveler shares</summary>{shares.map((share, index) => <p key={index}>Traveler {index + 1}: {formatMoney(share, currency)}</p>)}<p>Rounding is allocated in the smallest currency unit; shares add up to the total.</p></details>}
      {travelers !== undefined && travelers !== coverage.travelers && <p role="status">Recorded for {coverage.travelers} of {travelers} travelers. Refresh or clarify this allowance for the full party.</p>}
      {!compact && price && price.quantity > 0 && <p>{formatMoney(price.unitAmount, price.currency)} / {unit} × {price.quantity}{isPerPersonUnit(price.unit) ? ` × ${price.participants} traveler(s)` : ' (counted once)'}</p>}
      {coverage.includedElsewhere && <p>{item.category === 'accommodation' ? 'No overnight accommodation included' : `Included once in selected activity costs for ${coverage.travelers} traveler(s)`}</p>}
    </> : <p>{!price ? <>Recorded amount: {formatMoney(item.estimatedCost, currency)}. Cost basis unavailable; excluded from estimates. Refresh the budget or edit this activity to clarify its coverage.</> : 'Refresh or clarify the budget estimate before relying on this amount.'}</p>}
    {!compact && price && price.currency !== currency && price.status !== 'unavailable' && <p>Original estimate: {formatMoney(price.unitAmount, price.currency)} / {unit}. Excluded from {currency} totals; conversion unavailable.</p>}
    {!compact && <details className="mt-1"><summary className="cursor-pointer">Estimate basis</summary><p>{price?.basis || 'No cost basis was recorded. The saved activity and amount are preserved.'}</p>{price && <p>{price.source} · Recorded {new Date(price.fetchedAt).toLocaleDateString()}{price.ruleId ? ` · ${price.ruleId}` : ''}</p>}{price?.sourceUrl && <a className="underline" href={price.sourceUrl} target="_blank" rel="noreferrer">Price source</a>}</details>}
  </div>;
}
