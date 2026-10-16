'use client';
import { CURRENCY_NAMES, formatMoney, type CurrencyCode } from '@/lib/domain';
import { convertCurrency } from '@/lib/currency-conversion';
import type { ExchangeRateQuote } from '@/lib/contracts';
import { useConversionEnabled, useConversionLoading } from './ConversionPreference';

export function ReferenceAmount({ amount, currency, referenceCurrency, quotes, className = 'block text-[10px] font-normal text-cyan-200/70' }: { amount: number; currency: CurrencyCode; referenceCurrency: CurrencyCode; quotes: Partial<Record<CurrencyCode, ExchangeRateQuote>>; className?: string }) {
  const enabled=useConversionEnabled();
  const loading=useConversionLoading();
  const quote = quotes[currency];
  const converted = convertCurrency(amount, currency, referenceCurrency, quotes);
  if (!enabled || currency === referenceCurrency) return null;
  if (converted === null) return loading ? null : <small className={className}>Conversion unavailable</small>;
  return <small className={`${className} ${quote?.freshness?.isStale ? '!text-amber-200' : ''}`}>≈ {formatMoney(converted, referenceCurrency)} · {CURRENCY_NAMES[referenceCurrency]}{quote?.freshness?.isStale ? ' · STALE CACHE' : quote?.freshness?.status === 'fresh-cache' ? ' · cached' : ''}</small>;
}
