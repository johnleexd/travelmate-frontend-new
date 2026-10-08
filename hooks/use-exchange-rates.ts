'use client';

import { useEffect, useState } from 'react';
import type { CurrencyCode } from '@/lib/domain';
import type { ExchangeRateQuote } from '@/lib/contracts';
import { exchangeRateClient } from '@/services/exchange-rate-client';

type State = {
  key: string;
  quotes: Partial<Record<CurrencyCode, ExchangeRateQuote>>;
  busy: boolean;
  message: string;
};
const EMPTY_QUOTES: State['quotes'] = {};

export function useExchangeRates(sources: CurrencyCode[], reference: CurrencyCode, enabled: boolean) {
  // Depend on the currencies, not the identity/order of arrays returned by other
  // hooks. Budget and accommodation renders must not restart this effect.
  const sourceKey = [...new Set(sources)].filter(source => source !== reference).sort().join(',');
  const key = enabled ? `${reference}:${sourceKey}` : '';
  const [state, setState] = useState<State>({ key: '', quotes: EMPTY_QUOTES, busy: false, message: '' });

  useEffect(() => {
    if (!enabled || !sourceKey) return;
    const currencies = sourceKey.split(',') as CurrencyCode[];
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      setState({ key, quotes: EMPTY_QUOTES, busy: true, message: '' });
      const results = await Promise.allSettled(currencies.map(source => exchangeRateClient.fetch(source, reference, controller.signal)));
      if (controller.signal.aborted) return;
      const quotes: State['quotes'] = {};
      const expirations: number[] = [];
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          quotes[result.value.base] = result.value;
          const expiry = exchangeRateClient.expiresAt(result.value.base, reference);
          if (expiry) expirations.push(expiry);
        }
      });
      setState({ key, quotes, busy: false, message: results.some(result => result.status === 'rejected') ? 'Reference conversion is temporarily unavailable. Destination prices remain unchanged.' : '' });
      // Only successful cache expiry schedules refresh. A terminal error stays
      // unavailable; neither renders nor an idle-page timer retry it forever.
      if (expirations.length) timer = setTimeout(() => void load(), Math.max(1_000, Math.min(...expirations) - Date.now()));
    }
    timer = setTimeout(() => void load(), 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [enabled, key, sourceKey, reference]);

  if (!enabled || !sourceKey) return { exchangeQuotes: EMPTY_QUOTES, exchangeBusy: false, exchangeMessage: '' };
  return state.key === key
    ? { exchangeQuotes: state.quotes, exchangeBusy: state.busy, exchangeMessage: state.message }
    : { exchangeQuotes: EMPTY_QUOTES, exchangeBusy: true, exchangeMessage: '' };
}
