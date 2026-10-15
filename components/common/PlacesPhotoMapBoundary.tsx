'use client';
import { createContext, useCallback, useContext, useId, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';

type Boundary = { active: boolean; hasPhotos: boolean; mode: 'photos' | 'map'; mapsOpen: number; setMode: (mode: 'photos' | 'map') => void; register: (id: string, kind: 'photos' | 'map', present: boolean) => void };
const Context = createContext<Boundary>({ active: false, hasPhotos: false, mode: 'photos', mapsOpen: 0, setMode: () => {}, register: () => {} });
export const usePlacesPhotoMapBoundary = () => useContext(Context);
export function PlacesPhotoMapBoundary({ children }: { children: ReactNode }) {
  const [views, setViews] = useState<Record<string, 'photos' | 'map'>>({});
  const [mode, setMode] = useState<'photos' | 'map'>('photos');
  const register = useCallback((id: string, kind: 'photos' | 'map', present: boolean) => setViews(current => {
    if (present && current[id] === kind || !present && !current[id]) return current;
    const next = { ...current }; if (present) next[id] = kind; else delete next[id]; return next;
  }), []);
  const value = useMemo(() => ({ active: true, hasPhotos: Object.values(views).includes('photos'), mapsOpen: Object.values(views).filter(kind => kind === 'map').length, mode, setMode, register }), [views, mode, register]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function usePlacesPhotoView(present: boolean) {
  const id = useId(), { register } = usePlacesPhotoMapBoundary();
  useLayoutEffect(() => { register(id, 'photos', present); return () => register(id, 'photos', false); }, [id, present, register]);
}
export function useNonGoogleMapView() {
  const id = useId(), { register } = usePlacesPhotoMapBoundary();
  useLayoutEffect(() => { register(id, 'map', true); return () => register(id, 'map', false); }, [id, register]);
}
/** Switch views instead of displaying Google content alongside an OSM map. */
export function PlacesAwareTripMap({ children }: { children: ReactNode }) {
  const boundary = usePlacesPhotoMapBoundary();
  if (!boundary.hasPhotos) return children;
  return <section className="mt-6 rounded-xl border border-slate-300 p-4" data-photo-map-switch>
    <h2 className="mb-2 font-bold">Your trip map</h2>
    <button type="button" className="mb-3 min-h-11 rounded border border-slate-500 px-4 text-sm" onClick={() => boundary.setMode(boundary.mode === 'photos' ? 'map' : 'photos')}>{boundary.mode === 'photos' ? 'View trip map' : 'Back to activity photos'}</button>
    {boundary.mode === 'map' && children}
  </section>;
}
