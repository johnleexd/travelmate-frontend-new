import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSavedTripCovers } from '../lib/saved-trip-photo-selection.ts';
import { savedTripPhotoQuery, verifiedSavedTripCover } from '../lib/place-image.ts';

const memoryStorage = () => {
  const entries = new Map<string, string>();
  return { getItem: (key: string) => entries.get(key) || null, setItem: (key: string, value: string) => { entries.set(key, value); }, entries };
};
const trip = (id: string, city: string) => ({ id, destination: city + ', Philippines', destinationCity: city, destinationCountryCode: 'PH' });
const photo = (id: string, city: string, scope = 'destination') => ({
  id, provider: 'unsplash', src: 'https://images.unsplash.com/photo-1598258710957-db8614c2881e?ixid=' + id + '&ixlib=rb-4.1.0&q=80&w=1080',
  kind: 'destination-photo', city, countryCode: 'PH', label: scope === 'country' ? 'Country photo: Manila, Philippines' : city + ', Philippines', scope,
  attribution: { creator: 'Alexes Gerard', license: 'Unsplash', sourceUrl: 'https://unsplash.com/photos/' + id + '?utm_source=travelmate&utm_medium=referral',
    photographerUrl: 'https://unsplash.com/@xlexes?utm_source=travelmate&utm_medium=referral' },
});
function provider(photos: unknown[]) {
  const searches: string[] = [], tracked: Record<string, string>[] = [];
  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'POST') { tracked.push(JSON.parse(init.body as string)); return Response.json({ tracked: true }); }
    searches.push(String(url)); return Response.json({ photos });
  }) as typeof fetch;
  return { fetcher, searches, tracked };
}
test('same-destination trips use different suitable IDs and retain their associations after reload and reorder', async () => {
  const storage = memoryStorage(), city = 'Stable Manila';
  const trips = ['b', 'a', 'c'].map(id => trip('stable-' + id, city));
  const source = provider(['one', 'two', 'three'].map(id => photo(id, city)));
  const result = await resolveSavedTripCovers(trips, source.fetcher, storage);
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(new Set(Object.values(result).map(item => item?.id)).size, 3);
  assert.equal(source.searches.length, 1);
  assert.equal(source.tracked.length, 3);
  // A new module instance models a full browser reload, without the memory cache.
  const refreshed = await import(new URL('../lib/saved-trip-photo-selection.ts?refresh-stable', import.meta.url).href);
  const next = await refreshed.resolveSavedTripCovers([...trips].reverse(), source.fetcher, storage);
  assert.deepEqual(next, result);
  assert.equal(source.searches.length, 1);
  assert.equal(source.tracked.length, 3);
  const added = await refreshed.resolveSavedTripCovers([...trips, trip('stable-d', city)], source.fetcher, storage);
  for (const item of trips) assert.equal(added[item.id]?.id, result[item.id]?.id);
  assert.equal(source.searches.length, 1);
});
test('one suitable photo may be reused; unrelated destination and country candidates are rejected', async () => {
  const city = 'Only Manila', storage = memoryStorage();
  const source = provider([photo('only', city), photo('wrong-city', 'Fukuoka'), { ...photo('wrong-country', city), countryCode: 'JP' }]);
  const result = await resolveSavedTripCovers([trip('only-a', city), trip('only-b', city)], source.fetcher, storage);
  assert.deepEqual(Object.values(result).map(item => item?.id), ['only', 'only']);
});
test('exact destination matches outrank country fallbacks even when variety would increase', async () => {
  const city = 'Exact Manila', source = provider([photo('exact', city), photo('country', 'Manila', 'country')]);
  const result = await resolveSavedTripCovers([trip('exact-a', city), trip('exact-b', city)], source.fetcher, memoryStorage());
  assert.deepEqual(Object.values(result).map(item => item?.id), ['exact', 'exact']);
});
test('stored selection cannot follow a trip to a changed destination', async () => {
  const storage = memoryStorage(), id = 'changing-trip';
  const first = provider([photo('old', 'Old Manila')]), second = provider([photo('new', 'New Manila')]);
  assert.equal((await resolveSavedTripCovers([trip(id, 'Old Manila')], first.fetcher, storage))[id]?.id, 'old');
  assert.equal((await resolveSavedTripCovers([trip(id, 'New Manila')], second.fetcher, storage))[id]?.id, 'new');
});
test('blocked storage and failed searches never break card rendering', async () => {
  const storage = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  const source = provider([photo('blocked', 'Blocked Manila')]);
  assert.equal((await resolveSavedTripCovers([trip('blocked', 'Blocked Manila')], source.fetcher, storage)).blocked?.id, 'blocked');
  const failed = (async () => { throw Error('offline'); }) as typeof fetch;
  assert.deepEqual(await resolveSavedTripCovers([trip('missing', 'Missing Manila')], failed, storage), { missing: null });
});
test('Unsplash cover validation preserves URL parameters and requires complete attribution', () => {
  const candidate = photo('verified', 'Manila'), destination = trip('verified', 'Manila');
  assert.equal(verifiedSavedTripCover(candidate, destination)?.src, candidate.src);
  assert.equal(verifiedSavedTripCover({ ...candidate, attribution: { ...candidate.attribution, photographerUrl: undefined } }, destination), null);
  assert.equal(verifiedSavedTripCover({ ...candidate, src: 'https://images.unsplash.com.evil.example/photo-x' }, destination), null);
  assert.equal(verifiedSavedTripCover({ ...candidate, attribution: { ...candidate.attribution, sourceUrl: 'https://unsplash.com/photos/x' } }, destination), null);
});

test('query variants for the same destination still allocate unused verified photo IDs', async () => {
  const city = 'Coordinate Manila', source = provider(['coordinate-one', 'coordinate-two', 'coordinate-three'].map(id => photo(id, city)));
  const trips = [trip('coordinate-a', city), { ...trip('coordinate-b', city), latitude: 14.6042, longitude: 120.9822 },
    { ...trip('coordinate-c', city), latitude: 14.6, longitude: 120.98 }];
  const result = await resolveSavedTripCovers(trips, source.fetcher, memoryStorage());
  assert.equal(new Set(Object.values(result).map(item => item?.id)).size, 3);
});
test('obsolete cached misses retry but existing positive cover pools and selections remain unchanged', async () => {
  const storage = memoryStorage(), city = 'Recovered Manila', item = trip('recovered-v3', city);
  const query = savedTripPhotoQuery(item), source = provider([photo('recovered', city)]);
  storage.setItem('travelmate:saved-cover:v2:pool:' + query, JSON.stringify({ expires: Date.now() + 86400000, photos: [] }));
  assert.equal((await resolveSavedTripCovers([item], source.fetcher, storage))[item.id]?.id, 'recovered');
  assert.equal(source.searches.length, 1);
  const regionItem = { ...item, destinationRegion: 'Recorded Region' };
  assert.equal((await resolveSavedTripCovers([regionItem], source.fetcher, storage))[item.id]?.id, 'recovered');
  assert.equal(source.searches.length, 1);
});
