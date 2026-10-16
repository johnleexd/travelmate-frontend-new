'use client';
import type { CurrencyCode } from '@/lib/domain';
import type { ExchangeRateQuote } from '@/lib/contracts';
import { useConversionEnabled } from './ConversionPreference';
import { CURRENCY_DATA_SOURCE } from '@/lib/generated/currency';
export function ConversionDetails({currency,referenceCurrency,quotes,busy}:{currency:CurrencyCode;referenceCurrency:CurrencyCode;quotes:Partial<Record<CurrencyCode,ExchangeRateQuote>>;busy:boolean}) {
  const enabled=useConversionEnabled(), rate=quotes[currency];
  const converting=enabled&&currency!==referenceCurrency;
  return <>{converting&&(!rate||busy)&&<span className="mt-1 block text-xs" role={busy?'status':undefined}>{busy?'Loading conversion…':'Conversion unavailable'}</span>}
    <details className="mt-1 text-xs"><summary className="cursor-pointer">Currency &amp; rate details</summary>
      <p><a href={CURRENCY_DATA_SOURCE.sources.iso} target="_blank" rel="noreferrer" className="underline">ISO 4217 / SIX</a> · Published {CURRENCY_DATA_SOURCE.isoPublished}. Currency precision follows ISO minor units.</p>
      <p><a href={CURRENCY_DATA_SOURCE.sources.cldr} target="_blank" rel="noreferrer" className="underline">Unicode CLDR {CURRENCY_DATA_SOURCE.cldrVersion}</a> · Destination currencies follow dated territory records. Multiple currencies require a choice.</p>
      {converting&&rate&&<><p>1 {rate.base} ≈ {rate.rate.toLocaleString('en-US',{maximumFractionDigits:10})} {rate.quote}. Rate date: {rate.asOf}.</p><p><a href={rate.sourceUrl} target="_blank" rel="noreferrer" className="underline">Frankfurter</a> · Retrieved {new Date(rate.fetchedAt).toLocaleString()}{rate.freshness.isStale?' · Stale cached rate':''}</p><p>{rate.disclaimer}</p></>}
    </details></>;
}
