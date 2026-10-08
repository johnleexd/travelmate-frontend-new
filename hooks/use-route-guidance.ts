'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NavigationCoordinate, NavigationMode, NavigationRoute } from '@/lib/contracts';
import type { TripLocation } from './use-trip-location';
import { buildRouteGuide, navigationProgress } from '@/lib/navigation';
import { fetchNavigationDirections } from '@/services/navigation.service';
import { straightLineDistanceKm } from '@/lib/trip-map';

export function useRouteGuidance(position: TripLocation | null, live: boolean, destination: NavigationCoordinate | null, mode: NavigationMode) {
  const [route, setRoute] = useState<NavigationRoute | null>(null);
  const [routing, setRouting] = useState(false);
  const [message, setMessage] = useState('');
  const [guiding, setGuiding] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const versionRef = useRef(0);
  const pendingRef = useRef(false);
  const requestedAtRef = useRef(0);
  const requestedOriginRef = useRef<NavigationCoordinate | null>(null);
  const guide = useMemo(() => route ? buildRouteGuide(route) : null, [route]);
  const progress = useMemo(() => guide && position ? navigationProgress(guide, position, position.accuracy) : null, [guide, position]);

  const cancelPending = useCallback(() => {
    versionRef.current++; controllerRef.current?.abort(); controllerRef.current = null; pendingRef.current = false;
  }, []);
  const reset = useCallback(() => {
    cancelPending();
    setRoute(null); setRouting(false); setGuiding(false); setMessage('');
  }, [cancelPending]);

  const requestRoute = useCallback(async (automatic = false) => {
    if (!position || !destination || !live || pendingRef.current) return;
    if (automatic && (Date.now() - requestedAtRef.current < 15_000 || requestedOriginRef.current && straightLineDistanceKm(requestedOriginRef.current, position) * 1000 < 30)) return;
    const controller = new AbortController(); controllerRef.current?.abort(); controllerRef.current = controller;
    const version = ++versionRef.current;
    pendingRef.current = true; requestedAtRef.current = Date.now(); requestedOriginRef.current = { latitude: position.latitude, longitude: position.longitude }; setRouting(true); setMessage('');
    try {
      const next = await fetchNavigationDirections({ origin: { latitude: position.latitude, longitude: position.longitude }, destination: { latitude: destination.latitude, longitude: destination.longitude }, mode }, controller.signal);
      if (version !== versionRef.current || controller.signal.aborted) return;
      setRoute(next);
    } catch (error) {
      if (version !== versionRef.current || controller.signal.aborted) return;
      setMessage(error instanceof Error ? error.message : 'Route guidance is unavailable. Try again.');
    } finally {
      if (version === versionRef.current) { pendingRef.current = false; setRouting(false); }
    }
  }, [position, destination, mode, live]);

  useEffect(() => {
    if (!guiding || !progress?.offRoute || !live || !position || position.accuracy > 100) return;
    const timer = window.setTimeout(() => void requestRoute(true), 250);
    return () => window.clearTimeout(timer);
  }, [guiding, progress, position, live, requestRoute]);

  useEffect(() => {
    const pause = () => { if (document.hidden) reset(); };
    document.addEventListener('visibilitychange', pause);
    return () => { document.removeEventListener('visibilitychange', pause); cancelPending(); };
  }, [reset, cancelPending]);

  return { route, progress, routing, message, guiding, reset, requestRoute, startGuidance: () => setGuiding(true), stopGuidance: () => setGuiding(false) };
}
