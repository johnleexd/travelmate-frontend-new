import assert from 'node:assert/strict';
import test from 'node:test';
import { createTripNavigationClient } from '../services/trip-navigation.service.ts';
const manifest = (tripId: string) => ({ map: { tripId, destination: 'Saved destination', anchor: null, days: [] } });
function deferred() {
  const calls: { url: string; signal: AbortSignal; resolve: (response: Response) => void }[] = [];
  const fetcher: typeof fetch = (url, init) => new Promise((resolve, reject) => {
    const signal = init!.signal! as AbortSignal;
    signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
    calls.push({ url: String(url), signal, resolve });
  });
  return { calls, fetcher };
}
test('same-tick React effect remount reuses a request without cancelling its new consumer', async () => {
  const { calls, fetcher } = deferred(), client = createTripNavigationClient('trip-a', fetcher);
  const first = new AbortController(), second = new AbortController();
  const cancelled = assert.rejects(client.manifest(first.signal), { name: 'AbortError' }); first.abort();
  const result = client.manifest(second.signal);
  assert.equal(calls.length, 1); await Promise.resolve(); assert.equal(calls[0].signal.aborted, false);
  calls[0].resolve(Response.json(manifest('trip-a'))); assert.equal((await result).tripId, 'trip-a'); await cancelled;
});
test('independent consumers share the response while one cancellation does not abort another', async () => {
  const { calls, fetcher } = deferred(), client = createTripNavigationClient('trip-a', fetcher);
  const first = new AbortController(), second = new AbortController();
  const cancelled = assert.rejects(client.manifest(first.signal), { name: 'AbortError' });
  const result = client.manifest(second.signal); first.abort(); await cancelled;
  assert.equal(calls.length, 1); assert.equal(calls[0].signal.aborted, false);
  calls[0].resolve(Response.json(manifest('trip-a'))); await result;
});
test('leaving a view aborts the unused request and a later request can retry safely', async () => {
  const { calls, fetcher } = deferred(), client = createTripNavigationClient('trip-a', fetcher);
  const first = new AbortController(); const cancelled = assert.rejects(client.manifest(first.signal), { name: 'AbortError' });
  first.abort(); await cancelled; await Promise.resolve(); assert.equal(calls[0].signal.aborted, true);
  const result = client.manifest(new AbortController().signal); assert.equal(calls.length, 2);
  calls[1].resolve(Response.json(manifest('trip-a'))); assert.equal((await result).tripId, 'trip-a');
});
test('trip URLs and caches stay isolated; an incorrect manifest never becomes another trip map', async () => {
  const urls: string[] = []; const fetcher: typeof fetch = async url => { urls.push(String(url)); return Response.json(manifest('trip-a')); };
  assert.equal((await createTripNavigationClient('trip-a', fetcher).manifest(new AbortController().signal)).tripId, 'trip-a');
  await assert.rejects(createTripNavigationClient('trip-b', fetcher).manifest(new AbortController().signal), /does not match/);
  await assert.rejects(createTripNavigationClient('trip/a', fetcher).manifest(new AbortController().signal), /does not match/);
  assert.deepEqual(urls, ['/api/navigation/trips/trip-a/map', '/api/navigation/trips/trip-b/map', '/api/navigation/trips/trip%2Fa/map']);
});
test('activity and weather caches distinguish day, exact selection and current versus forecast', async () => {
  const calls: { endpoint: string; input: unknown }[] = [];
  const fetcher: typeof fetch = async (url, init) => { const input = JSON.parse(String(init!.body)); calls.push({ endpoint: String(url), input });
    return Response.json(String(url).endsWith('/weather') ? { weather: { status: 'outside-horizon', kind: input.current ? 'current' : 'forecast' } } : { activity: { index: input.activityIndex }, candidates: [] }); };
  const client = createTripNavigationClient('trip-a', fetcher), signal = new AbortController().signal, first = { dayIndex: 0, activityIndex: 0 };
  await client.activity(first, signal); await client.activity(first, signal); await client.activity({ ...first, dayIndex: 1 }, signal);
  await client.weather(first, false, signal); await client.weather(first, false, signal); await client.weather(first, true, signal);
  await client.activity({ ...first, query: 'Exact venue', placeId: 'node:1' }, signal);
  assert.equal(calls.length, 5); assert.notDeepEqual(calls[0].input, calls[1].input);
});
test('failed requests remain retryable and already cancelled callers make no request', async () => {
  let count = 0; const client = createTripNavigationClient('trip-a', async () => ++count === 1 ? Response.json({ error: 'Busy' }, { status: 429 }) : Response.json(manifest('trip-a')));
  const aborted = new AbortController(); aborted.abort(); await assert.rejects(client.manifest(aborted.signal), { name: 'AbortError' }); assert.equal(count, 0);
  await assert.rejects(client.manifest(new AbortController().signal), /Busy/);
  assert.equal((await client.manifest(new AbortController().signal)).tripId, 'trip-a'); assert.equal(count, 2);
});
