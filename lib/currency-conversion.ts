import { SUPPORTED_CURRENCIES, type CurrencyCode } from './domain.ts';
import type { ExchangeRateQuote } from './contracts.ts';

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && SUPPORTED_CURRENCIES.includes(value as CurrencyCode);
}

export function convertCurrency(amount: number, source: CurrencyCode, reference: CurrencyCode, quotes: Partial<Record<CurrencyCode, ExchangeRateQuote>>): number | null {
  if (!Number.isFinite(amount)) return null;
  if (source === reference) return amount;
  const quote = quotes[source];
  if (!quote || quote.base !== source || quote.quote !== reference || !Number.isFinite(quote.rate) || quote.rate <= 0) return null;
  return amount * quote.rate;
}
