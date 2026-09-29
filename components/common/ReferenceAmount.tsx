import { CURRENCY_NAMES, formatMoney, type CurrencyCode } from '@/lib/domain';
import { convertCurrency } from '@/lib/currency-conversion';
import type { ExchangeRateQuote } from '@/lib/contracts';

export function ReferenceAmount({ amount, currency, referenceCurrency, quotes, className = 'block text-[10px] font-normal text-cyan-200/70' }: { amount: number; currency: CurrencyCode; referenceCurrency: CurrencyCode; quotes: Partial<Record<CurrencyCode, ExchangeRateQuote>>; className?: string }) {
  const quote = quotes[currency];
  const converted = convertCurrency(amount, currency, referenceCurrency, quotes);
  if (currency === referenceCurrency || converted === null) return null;
  return <small className={`${className} ${quote?.freshness?.isStale ? '!text-amber-200' : ''}`}>≈ {formatMoney(converted, referenceCurrency)} · {CURRENCY_NAMES[referenceCurrency]}{quote?.freshness?.isStale ? ' · STALE CACHE' : quote?.freshness?.status === 'fresh-cache' ? ' · cached' : ''}</small>;
}
