'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { mapCoordinates, type MapCoordinates } from '@/lib/trip-map';

export type TripLocation = MapCoordinates & { accuracy: number; timestamp: number };

export function useTripLocation() {
  const [position, setPosition] = useState<TripLocation | null>(null);
  const [status, setStatus] = useState<'idle' | 'locating' | 'live' | 'waiting' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const watchRef = useRef<number | null>(null);
  const generationRef = useRef(0);

  const clearWatch = useCallback(() => {
    generationRef.current++;
    if (watchRef.current !== null) navigator.geolocation?.clearWatch(watchRef.current);
    watchRef.current = null;
  }, []);

  const stop = useCallback(() => {
    clearWatch(); setPosition(null); setStatus('idle'); setMessage('Location sharing stopped.');
  }, [clearWatch]);

  const start = useCallback(() => {
    clearWatch(); setPosition(null); setMessage('');
    if (!window.isSecureContext || !navigator.geolocation) {
      setStatus('error'); setMessage('Your browser cannot share location here. Use HTTPS and a browser with location support.'); return;
    }
    const generation = generationRef.current;
    let hasFix = false;
    const fail = (code: number) => {
      if (generation !== generationRef.current) return;
      // watchPosition can recover after a temporary signal loss. Keep the last
      // reading explicitly labeled as stale while waiting for the next fix.
      if (hasFix && code !== 1) {
        setStatus('waiting'); setMessage('Location signal lost. Showing your last known position while trying to reconnect.'); return;
      }
      clearWatch(); setPosition(null); setStatus('error');
      setMessage(code === 1 ? 'Location permission was denied. Allow location in your browser settings, then try again.'
        : code === 3 ? 'Finding your location took too long. Check location services and try again.'
          : 'Your location is unavailable. Check your device location services and try again.');
    };
    setStatus('locating');
    try {
      const id = navigator.geolocation.watchPosition(result => {
        if (generation !== generationRef.current) return;
        const point = mapCoordinates(result.coords);
        if (!point || !Number.isFinite(result.coords.accuracy) || result.coords.accuracy < 0) { fail(2); return; }
        hasFix = true;
        setPosition({ ...point, accuracy: result.coords.accuracy, timestamp: result.timestamp });
        setStatus('live'); setMessage('');
      }, error => fail(error.code), { enableHighAccuracy: true, timeout: 15_000, maximumAge: 5_000 });
      if (generation === generationRef.current) watchRef.current = id;
      else navigator.geolocation.clearWatch(id);
    } catch { fail(2); }
  }, [clearWatch]);

  useEffect(() => {
    const pause = () => {
      if (!document.hidden) return;
      clearWatch(); setPosition(null); setStatus('idle'); setMessage('Location sharing paused while this tab is hidden.');
    };
    document.addEventListener('visibilitychange', pause);
    return () => { document.removeEventListener('visibilitychange', pause); clearWatch(); };
  }, [clearWatch]);

  return { position, status, message, start, stop, sharing: status === 'locating' || status === 'live' || status === 'waiting' };
}
