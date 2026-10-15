'use client';
import { useEffect, useState } from 'react';
import type { AreaSuggestion, LocationSuggestion, DestinationAreasResponse } from '@/lib/contracts';
import { destinationAreaClient } from '@/services/destination-area-client';

type State = { key: string; areas: AreaSuggestion[]; status: 'loading' | 'ready' | 'empty' | 'error'; message: string; nextOffset: number | null; loadingMore: boolean; sourceUrls: string[]; fetchedAt: string; total?: number; coverage?: DestinationAreasResponse['coverage']; catalogueAsOf?: string };
const EMPTY: State = { key: '', areas: [], status: 'loading', message: '', nextOffset: null, loadingMore: false, sourceUrls: [], fetchedAt: '' };
export function useDestinationAreas(parent: Pick<LocationSuggestion,'id' | 'countryCode'>) {
  const parentKey = `${parent.id}:${parent.countryCode}`;
  const [search, setSearch] = useState({ parentKey, query: '', offset: 0 });
  // A new parent immediately starts at an empty query/page, including before effects
  // run. Old pages and delayed responses cannot become visible under the new scope.
  const { query, offset } = search.parentKey === parentKey ? search : { query: '', offset: 0 };
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<State>(EMPTY);
  const parentId = parent.id, countryCode = parent.countryCode;
  const key = `${parentId}:${countryCode}:${query.trim().toLowerCase()}`;
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setState(current => offset && current.key === key ? { ...current, loadingMore: true, message: '' } : { ...EMPTY, key });
      void destinationAreaClient.search({ id: parentId, countryCode }, query, offset, controller.signal).then(result => {
        if (controller.signal.aborted) return;
        setState(current => {
          const prior = offset && current.key === key ? current.areas : [];
          const seen = new Set(prior.map(city => city.id));
          const areas = [...prior, ...result.areas.filter(city => !seen.has(city.id))];
          return { key, areas, status: areas.length ? 'ready' : 'empty', message: result.message, nextOffset: result.nextOffset, loadingMore: false, sourceUrls: result.sourceUrls, fetchedAt: result.fetchedAt, total: result.total, coverage: result.coverage, catalogueAsOf: result.catalogueAsOf };
        });
      }).catch(error => {
        if (controller.signal.aborted) return;
        setState(current => ({ ...(offset && current.key === key ? current : { ...EMPTY, key }), status: 'error', loadingMore: false, message: error instanceof Error ? error.message : 'Area suggestions are temporarily unavailable.' }));
      });
    }, query ? 350 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [parentId, countryCode, key, query, offset, retry]);
  return {
    ...(state.key === key ? state : EMPTY), query,
    search(value: string) { setSearch({ parentKey, query: value, offset: 0 }); },
    showMore() { if (state.key === key && !state.loadingMore && state.nextOffset !== null) setSearch({ parentKey, query, offset: state.nextOffset }); },
    retry() { setRetry(value => value + 1); },
  };
}
