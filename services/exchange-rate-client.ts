import type { ExchangeRateQuote } from '../lib/contracts.ts';
import type { CurrencyCode } from '../lib/domain.ts';

const MAX_ATTEMPTS = 3;
const FAILURE_COOLDOWN_MS = 60_000;
const MAX_AUTOMATIC_WAIT_MS = 30_000;
const MAX_ENTRIES = 400;

export function retryAfterMilliseconds(value: string | null, now: number): number {
  if (!value?.trim()) return 0;
  if (/^\d+$/.test(value.trim())) return Number(value) * 1_000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : 0;
}

export class ExchangeRateUnavailable extends Error {
  readonly status: number;
  readonly retryAt: number;
  readonly rateLimitSource: string | null;

  constructor(status = 0, retryAt = 0, rateLimitSource: string | null = null) {
    super('Reference conversion is temporarily unavailable. Destination prices remain unchanged.');
    this.name = 'ExchangeRateUnavailable';
    this.status = status;
    this.retryAt = retryAt;
    this.rateLimitSource = rateLimitSource;
  }
}

function consume<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(signal.reason);
  // A departing component must not cancel another consumer's shared request.
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

type CachedRate = { value: ExchangeRateQuote; expiresAt: number };
type Failure = { error: ExchangeRateUnavailable; expiresAt: number };
type Options = {
  fetcher?: typeof fetch;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
};

export function createExchangeRateClient(options: Options = {}) {
  const fetcher = options.fetcher ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));
  const random = options.random ?? Math.random;
  const cache = new Map<string, CachedRate>();
  const failures = new Map<string, Failure>();
  const inFlight = new Map<string, Promise<ExchangeRateQuote>>();
  let backendBlocked: ExchangeRateUnavailable | null = null;

  function remember<T>(map: Map<string, T>, key: string, value: T) {
    map.delete(key);
    map.set(key, value);
    if (map.size > MAX_ENTRIES) map.delete(map.keys().next().value!);
  }

  function expiry(value: ExchangeRateQuote): number {
    // Stale fallback remains labeled stale and gets a deliberate revalidation
    // interval, rather than immediately refetching its already expired timestamp.
    if (value.freshness.isStale) return Math.min(now() + 15 * 60_000, Date.parse(value.freshness.staleUntil));
    return Math.min(Date.parse(value.refreshAfter), Date.parse(value.freshness.expiresAt), now() + 6 * 60 * 60_000);
  }

  async function load(base: CurrencyCode, quote: CurrencyCode, key: string): Promise<ExchangeRateQuote> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      let error: ExchangeRateUnavailable;
      let wait = 1_000 * 2 ** attempt + Math.floor(random() * 250);
      try {
        if (backendBlocked && backendBlocked.retryAt > now()) throw backendBlocked;
        const response = await fetcher(`/api/destination-context/exchange-rate?${new URLSearchParams({ base, quote })}`, { signal: AbortSignal.timeout(10_000) });
        if (response.ok) {
          const value = await response.json() as ExchangeRateQuote;
          if (!value || value.base !== base || value.quote !== quote || !Number.isFinite(value.rate) || value.rate <= 0 || !value.freshness || !/^\d{4}-\d{2}-\d{2}$/.test(value.asOf)) throw new ExchangeRateUnavailable();
          const expiresAt = expiry(value);
          if (!Number.isFinite(expiresAt) || expiresAt <= now()) throw new ExchangeRateUnavailable();
          remember(cache, key, { value, expiresAt });
          failures.delete(key);
          return value;
        }
        wait = Math.max(wait, retryAfterMilliseconds(response.headers.get('Retry-After'), now()));
        error = new ExchangeRateUnavailable(response.status, now() + wait, response.headers.get('X-Rate-Limit-Source'));
        // Read no error body into the UI; a provider's response is untrusted.
        await response.body?.cancel();
        if (response.status === 429 && error.rateLimitSource === 'backend') backendBlocked = error;
      } catch (cause) {
        error = cause instanceof ExchangeRateUnavailable ? cause : new ExchangeRateUnavailable();
        wait = Math.max(wait, error.retryAt - now());
      }
      const retryable = error.status === 0 || error.status === 429 || error.status >= 500;
      if (!retryable || attempt === MAX_ATTEMPTS - 1 || wait > MAX_AUTOMATIC_WAIT_MS) {
        remember(failures, key, { error, expiresAt: Math.max(now() + FAILURE_COOLDOWN_MS, error.retryAt) });
        throw error;
      }
      await sleep(wait);
    }
    throw new ExchangeRateUnavailable();
  }

  return {
    fetch(base: CurrencyCode, quote: CurrencyCode, signal?: AbortSignal): Promise<ExchangeRateQuote> {
      if (signal?.aborted) return Promise.reject(signal.reason);
      const key = `${base}:${quote}`;
      const hit = cache.get(key);
      if (hit && hit.expiresAt > now()) return consume(Promise.resolve(hit.value), signal);
      const pending = inFlight.get(key);
      if (pending) return consume(pending, signal);
      const failure = failures.get(key);
      if (failure && failure.expiresAt > now()) return Promise.reject(failure.error);
      if (backendBlocked && backendBlocked.retryAt > now()) return Promise.reject(backendBlocked);
      const request = load(base, quote, key).finally(() => inFlight.delete(key));
      inFlight.set(key, request);
      return consume(request, signal);
    },
    expiresAt(base: CurrencyCode, quote: CurrencyCode): number | undefined {
      return cache.get(`${base}:${quote}`)?.expiresAt;
    },
  };
}

export const exchangeRateClient = createExchangeRateClient();
