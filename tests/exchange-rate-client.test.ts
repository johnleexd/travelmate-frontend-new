import assert from 'node:assert/strict';
import test from 'node:test';
import { createExchangeRateClient, ExchangeRateUnavailable, retryAfterMilliseconds } from '../services/exchange-rate-client.ts';
import type { ExchangeRateQuote } from '../lib/contracts.ts';

const START = Date.parse('2026-10-06T12:00:00Z');
function rate(now: number, base = 'JPY', quote = 'PHP', ttl = 6 * 60 * 60_000) {
  return { base, quote, rate: 0.4, asOf: '2026-10-06', fetchedAt: new Date(now).toISOString(), refreshAfter: new Date(now + ttl).toISOString(), source: 'frankfurter', sourceUrl: 'https://frankfurter.dev/', disclaimer: 'Reference only.', freshness: { source: 'exchange-rates', status: 'live', isStale: false, fetchedAt: new Date(now).toISOString(), expiresAt: new Date(now + ttl).toISOString(), staleUntil: new Date(now + ttl + 24 * 60 * 60_000).toISOString(), policy: 'Reference rate.' } };
}

test('concurrent consumers share one request, aborting one does not cancel another, and cache expiry refetches once', async () => {
  let now = START; let calls = 0; let release!: (response: Response) => void;
  const client = createExchangeRateClient({ now: () => now, fetcher: async () => { calls++; return new Promise(resolve => { release = resolve; }); } });
  const controller = new AbortController();
  const departing = client.fetch('JPY', 'PHP', controller.signal);
  const surviving = client.fetch('JPY', 'PHP');
  controller.abort(); await assert.rejects(departing, { name: 'AbortError' });
  assert.equal(calls, 1); release(Response.json(rate(now)));
  const value = await surviving;
  assert.strictEqual(await client.fetch('JPY', 'PHP'), value); assert.equal(calls, 1);
  now += 6 * 60 * 60_000;
  const refreshed = client.fetch('JPY', 'PHP');
  const same = client.fetch('JPY', 'PHP'); assert.equal(calls, 2);
  release(Response.json(rate(now))); await Promise.all([refreshed, same]); assert.equal(calls, 2);
});

test('pairs have separate caches and returning to a fresh pair performs no fetch', async () => {
  const calls: string[] = [];
  const client = createExchangeRateClient({ now: () => START, fetcher: async input => { const url = new URL(String(input), 'http://local'); const base = url.searchParams.get('base')!; const quote = url.searchParams.get('quote')!; calls.push(`${base}:${quote}`); return Response.json(rate(START, base, quote)); } });
  await client.fetch('JPY', 'PHP'); await client.fetch('JPY', 'EUR'); await client.fetch('JPY', 'PHP');
  assert.deepEqual(calls, ['JPY:PHP', 'JPY:EUR']);
});

test('429 respects Retry-After, retries are bounded, and terminal failure is cached', async () => {
  let now = START; let calls = 0; const waits: number[] = [];
  const client = createExchangeRateClient({ now: () => now, random: () => 0, sleep: async ms => { waits.push(ms); now += ms; }, fetcher: async () => { calls++; return Response.json({ error: 'limited' }, { status: 429, headers: { 'Retry-After': '2' } }); } });
  await assert.rejects(client.fetch('JPY', 'PHP'), ExchangeRateUnavailable);
  assert.equal(calls, 3); assert.deepEqual(waits, [2_000, 2_000]);
  await assert.rejects(client.fetch('JPY', 'PHP')); assert.equal(calls, 3);
  now += 60_001; await assert.rejects(client.fetch('JPY', 'PHP')); assert.equal(calls, 6);
});

test('long backend Retry-After stops immediately and prevents other pairs bypassing its cooldown', async () => {
  let calls = 0;
  const client = createExchangeRateClient({ now: () => START, sleep: async () => { throw Error('Must not sleep/retry.'); }, fetcher: async () => { calls++; return Response.json({}, { status: 429, headers: { 'Retry-After': '120', 'X-Rate-Limit-Source': 'backend' } }); } });
  await assert.rejects(client.fetch('JPY', 'PHP'), error => error instanceof ExchangeRateUnavailable && error.retryAt === START + 120_000 && error.rateLimitSource === 'backend');
  await assert.rejects(client.fetch('JPY', 'EUR')); await assert.rejects(client.fetch('USD', 'PHP'));
  assert.equal(calls, 1);
});

test('Retry-After supports HTTP dates, seconds and invalid headers', () => {
  assert.equal(retryAfterMilliseconds('Tue, 06 Oct 2026 12:00:10 GMT', START), 10_000);
  assert.equal(retryAfterMilliseconds('5', START), 5_000);
  assert.equal(retryAfterMilliseconds('Tue, 06 Oct 2026 11:00:00 GMT', START), 0);
  assert.equal(retryAfterMilliseconds('nonsense', START), 0);
  assert.equal(retryAfterMilliseconds(null, START), 0);
});

test('temporary failures back off and a successful retry is cached; authorization errors are not retried', async () => {
  let calls = 0; const waits: number[] = [];
  const client = createExchangeRateClient({ now: () => START, random: () => 0, sleep: async ms => { waits.push(ms); }, fetcher: async () => ++calls < 3 ? Response.json({}, { status: 503 }) : Response.json(rate(START)) });
  await client.fetch('JPY', 'PHP'); await client.fetch('JPY', 'PHP'); assert.equal(calls, 3); assert.deepEqual(waits, [1_000, 2_000]);
  calls = 0;
  const unauthorized = createExchangeRateClient({ fetcher: async () => { calls++; return Response.json({}, { status: 401 }); } });
  await assert.rejects(unauthorized.fetch('JPY', 'PHP')); assert.equal(calls, 1);
});

test('wrong-pair/invalid rates are never shown, and stale timestamps do not trigger immediate refetch loops', async () => {
  let calls = 0;
  const invalid = createExchangeRateClient({ now: () => START, sleep: async () => {}, fetcher: async () => { calls++; return Response.json(rate(START, 'USD')); } });
  await assert.rejects(invalid.fetch('JPY', 'PHP')); assert.equal(calls, 3);
  calls = 0;
  const stale = rate(START - 7 * 60 * 60_000) as ExchangeRateQuote;
  stale.freshness.isStale = true; stale.freshness.status = 'stale-cache';
  const client = createExchangeRateClient({ now: () => START, fetcher: async () => { calls++; return Response.json(stale); } });
  assert.equal((await client.fetch('JPY', 'PHP')).freshness.isStale, true);
  await client.fetch('JPY', 'PHP'); assert.equal(calls, 1);
  assert.equal(client.expiresAt('JPY', 'PHP'), START + 15 * 60_000);
});
