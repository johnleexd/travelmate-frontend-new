'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LocationSuggestion } from '@/lib/contracts';
import { fetchCurrentLocation, searchLocations } from '@/services/destination-planning.service';

type State = { ownerId: string | undefined; value: string; selected: LocationSuggestion | null; message: string; detecting: boolean; searching: boolean; suggestions: LocationSuggestion[] };
const empty = (ownerId?: string): State => ({ ownerId, value: '', selected: null, message: '', detecting: false, searching: false, suggestions: [] });
const validLocation = (location: LocationSuggestion) => typeof location.label === 'string' && location.label.length >= 2
  && Number.isFinite(location.latitude) && Math.abs(location.latitude) <= 90 && Number.isFinite(location.longitude) && Math.abs(location.longitude) <= 180;

/** Draft origin stays in memory and is always bound to the currently authenticated user. */
export function useStartingLocation(ownerId?: string) {
  const [state, setState] = useState<State>(() => empty(ownerId));
  const visible = state.ownerId === ownerId ? state : empty(ownerId);
  const version = useRef(0);
  const lookup = useRef<AbortController | null>(null);
  const cancel = useCallback(() => { version.current++; lookup.current?.abort(); }, []);
  useEffect(() => {
    cancel();
    // The owner check above hides a previous account's data immediately.
    const timer = window.setTimeout(() => setState(empty(ownerId)), 0);
    return () => { window.clearTimeout(timer); cancel(); };
  }, [ownerId, cancel]);

  const change = useCallback((value: string) => {
    cancel();
    setState({ ...empty(ownerId), value: value.slice(0, 120) });
  }, [ownerId, cancel]);
  const select = useCallback((location: LocationSuggestion) => {
    cancel();
    if (!validLocation(location)) return;
    setState({ ...empty(ownerId), value: location.label.slice(0, 120), selected: location });
  }, [ownerId, cancel]);
  const dismiss = useCallback(() => setState(current => current.ownerId === ownerId ? { ...current, suggestions: [] } : current), [ownerId]);

  useEffect(() => {
    if (!ownerId || visible.selected || visible.detecting || visible.value.trim().length < 2) return;
    const controller = new AbortController();
    const attempt = version.current;
    const timer = window.setTimeout(() => {
      setState(current => current.ownerId === ownerId ? { ...current, searching: true } : current);
      void searchLocations(visible.value, controller.signal).then(locations => {
        if (controller.signal.aborted || version.current !== attempt) return;
        setState(current => current.ownerId === ownerId ? { ...current, suggestions: locations.filter(location => location.placeType !== 'Country' && validLocation(location)).slice(0, 10), searching: false, message: '' } : current);
      }).catch(error => {
        if (controller.signal.aborted || version.current !== attempt) return;
        setState(current => current.ownerId === ownerId ? { ...current, searching: false, message: `${error instanceof Error ? error.message : 'Location search is unavailable.'} You can still enter your starting city manually.` } : current);
      });
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [ownerId, visible.value, visible.selected, visible.detecting]);

  const detect = useCallback(() => {
    if (!ownerId) return;
    cancel();
    const attempt = version.current;
    const controller = new AbortController(); lookup.current = controller;
    const update = (patch: Partial<State>) => {
      if (controller.signal.aborted || version.current !== attempt) return;
      setState(current => current.ownerId === ownerId ? { ...current, ...patch } : current);
    };
    if (!navigator.geolocation) {
      update({ message: 'Location detection is unavailable in this browser. Enter your starting city manually.' }); return;
    }
    update({ detecting: true, searching: false, suggestions: [], message: 'Requesting your location...' });
    try {
      navigator.geolocation.getCurrentPosition(position => {
      if (controller.signal.aborted || version.current !== attempt) return;
      void fetchCurrentLocation(position.coords.latitude, position.coords.longitude, controller.signal).then(location => {
        if (!validLocation(location)) throw new Error('Your current area could not be identified.');
        update({ value: location.label.slice(0, 120), selected: { ...location, latitude: position.coords.latitude, longitude: position.coords.longitude }, message: `Current area: ${location.label}. You can change it below.`, detecting: false });
      }).catch(error => update({ detecting: false, message: `${error instanceof Error ? error.message : 'Your current area could not be identified.'} You can enter your starting city manually.` }));
      }, error => update({ detecting: false, message: error.code === 1 ? 'Location permission was denied. Enter your starting city manually, or enable location permission and try again.' : 'Location detection failed. Enter your starting city manually or try again.' }), { enableHighAccuracy: false, maximumAge: 0, timeout: 10000 });
    } catch {
      update({ detecting: false, message: 'Location detection is unavailable. Enter your starting city manually or check your browser location settings.' });
    }
  }, [ownerId, cancel]);

  return { ...visible, change, select, detect, dismiss };
}
