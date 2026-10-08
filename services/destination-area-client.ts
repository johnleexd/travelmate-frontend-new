import type { AreaComparisonResponse, DestinationAreasResponse, LocationSuggestion } from '../lib/contracts.ts';
import { handleResponse } from './api-response.ts';
import { retryAfterMilliseconds } from './exchange-rate-client.ts';

type Parent = Pick<LocationSuggestion, 'id' | 'countryCode'>;
type ResponseData = DestinationAreasResponse | AreaComparisonResponse;
export function createDestinationAreaClient(fetcher: typeof fetch = (...args) => fetch(...args), now = Date.now) {
  const cache = new Map<string, { value?: ResponseData; error?: Error; expiresAt: number }>();
  const pending = new Map<string, Promise<ResponseData>>();

  function validate(value: ResponseData, parent: Parent, ids?: number[]) {
    if (!value || value.parentId !== parent.id || value.countryCode !== parent.countryCode || !Number.isFinite(Date.parse(value.fetchedAt)) || !Number.isFinite(Date.parse(value.expiresAt))) throw new Error('Area provider returned invalid destination data.');
    if ('areas' in value) {
      if (!Array.isArray(value.areas) || !['ready','empty'].includes(value.status) || !Number.isSafeInteger(value.total) || value.total < value.areas.length || value.nextOffset !== null && (!Number.isSafeInteger(value.nextOffset) || value.nextOffset <= 0) || !Array.isArray(value.sourceUrls) || !value.areas.every(city => city.countryCode === parent.countryCode && Number.isSafeInteger(city.id) && Number.isFinite(city.latitude) && Math.abs(city.latitude) <= 90 && Number.isFinite(city.longitude) && Math.abs(city.longitude) <= 180 && typeof city.description === 'string' && ['country-code','administrative-hierarchy','boundary'].includes(city.membership) && typeof city.name === 'string' && typeof city.label === 'string' && typeof city.providerId === 'string')) throw new Error('City suggestions could not be validated within this destination.');
    } else if (!Array.isArray(value.profiles) || !value.profiles.every(profile => ids?.includes(profile.cityId) && [profile.foodPlaces,profile.culturePlaces,profile.naturePlaces].every(count => Number.isSafeInteger(count) && count >= 0 && count <= 600))) throw new Error('Area comparison returned invalid mapped information.');
  }

  function consume<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
    if (!signal) return promise;
    if (signal.aborted) return Promise.reject(signal.reason);
    return new Promise((resolve, reject) => {
      const abort = () => reject(signal.reason);
      signal.addEventListener('abort', abort, { once: true });
      promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    });
  }

  function get<T extends ResponseData>(url: string, parent: Parent, signal?: AbortSignal, ids?: number[]): Promise<T> {
    if (signal?.aborted) return Promise.reject(signal.reason);
    const hit = cache.get(url);
    if (hit && hit.expiresAt > now()) return hit.error ? Promise.reject(hit.error) : consume(Promise.resolve(hit.value as T), signal);
    const shared = pending.get(url); if (shared) return consume(shared as Promise<T>, signal);
    const task = (async () => {
      let failureExpiry = now() + 60_000;
      try {
        const response = await fetcher(url, { signal: AbortSignal.timeout(40_000) });
        failureExpiry = Math.max(failureExpiry, now() + retryAfterMilliseconds(response.headers.get('Retry-After'), now()));
        const value = await handleResponse<T>(response);
        validate(value, parent, ids);
        cache.set(url, { value, expiresAt: Math.min(Date.parse(value.expiresAt), now() + 24 * 60 * 60_000) });
        return value;
      } catch (cause) {
        const error = cause instanceof Error ? cause : new Error('Area suggestions are temporarily unavailable.');
        cache.set(url, { error, expiresAt: failureExpiry }); throw error;
      }
    })().finally(() => { pending.delete(url); while (cache.size > 300) cache.delete(cache.keys().next().value!); });
    pending.set(url, task); return consume(task, signal);
  }
  return {
    search(parent: Parent, query = '', offset = 0, signal?: AbortSignal) {
      return get<DestinationAreasResponse>(`/api/locations/areas?${new URLSearchParams({ parentId: String(parent.id), countryCode: parent.countryCode, query: query.trim(), offset: String(offset) })}`, parent, signal);
    },
    compare(parent: Parent, cityIds: number[], signal?: AbortSignal) {
      const ids = [...new Set(cityIds)].sort((a,b) => a-b);
      return get<AreaComparisonResponse>(`/api/locations/areas/compare?${new URLSearchParams({ parentId: String(parent.id), countryCode: parent.countryCode, cityIds: ids.join(',') })}`, parent, signal, ids);
    },
  };
}
export const destinationAreaClient = createDestinationAreaClient();
