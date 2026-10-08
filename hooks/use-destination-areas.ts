'use client';
import { useEffect, useState } from 'react';
import type { AreaSuggestion, LocationSuggestion } from '@/lib/contracts';
import { destinationAreaClient } from '@/services/destination-area-client';

type State = { key: string; areas: AreaSuggestion[]; status: 'loading' | 'ready' | 'empty' | 'error'; message: string; nextOffset: number | null; loadingMore: boolean; sourceUrls: string[]; fetchedAt: string };
const EMPTY: State = { key: '', areas: [], status: 'loading', message: '', nextOffset: null, loadingMore: false, sourceUrls: [], fetchedAt: '' };
export function useDestinationAreas(parent: Pick<LocationSuggestion,'id' | 'countryCode'>) {
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
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
          return { key, areas, status: areas.length ? 'ready' : 'empty', message: result.message, nextOffset: result.nextOffset, loadingMore: false, sourceUrls: result.sourceUrls, fetchedAt: result.fetchedAt };
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
    search(value: string) { setQuery(value); setOffset(0); },
    showMore() { if (!state.loadingMore && state.nextOffset !== null) setOffset(state.nextOffset); },
    retry() { setRetry(value => value + 1); },
  };
}
