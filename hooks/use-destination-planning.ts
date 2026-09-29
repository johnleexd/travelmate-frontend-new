'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FreshnessMetadata, LiveAccommodation, LocationSuggestion, TransportationOption } from '@/lib/contracts';
import { SUPPORTED_CURRENCIES, type CurrencyCode, type SavedTrip } from '@/lib/domain';
import { fetchDestinationAccommodations, fetchDestinationContext, searchLocations } from '@/services/destination-planning.service';

type SelectedDestination = Omit<LocationSuggestion, 'latitude' | 'longitude'> & { latitude?: number; longitude?: number };

export function useDestinationPlanning(startDate: string, endDate: string, travelers: number) {
  const [destination, setDestination] = useState('');
  const [selectedDestination, setSelectedDestination] = useState<SelectedDestination | null>(null);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [locationsBusy, setLocationsBusy] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const [currency, setCurrencyState] = useState<CurrencyCode>('PHP');
  const [currencyResolved, setCurrencyResolved] = useState(false);
  const [contextBusy, setContextBusy] = useState(false);
  const [contextMessage, setContextMessage] = useState('');
  const [transportationOptions, setTransportationOptions] = useState<TransportationOption[]>([]);
  const [transportationPreference, setTransportationPreference] = useState('');
  const [liveAccommodations, setLiveAccommodations] = useState<LiveAccommodation[]>([]);
  const [staysBusy, setStaysBusy] = useState(false);
  const [stayMessage, setStayMessage] = useState('');
  const [stayFreshness, setStayFreshness] = useState<FreshnessMetadata | null>(null);
  const [contextRetry, setContextRetry] = useState(0);
  const [staysRetry, setStaysRetry] = useState(0);

  useEffect(() => {
    if (selectedDestination?.label === destination || destination.trim().length < 2) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setLocationsBusy(true);
      setLocationMessage('');
      void searchLocations(destination, controller.signal)
        .then((items) => {
          setSuggestions(items);
          if (!items.length) setLocationMessage('No matching locations found. Try a city, province, or country.');
        })
        .catch((error: unknown) => {
          if (!(error instanceof DOMException && error.name === 'AbortError')) {
            setSuggestions([]);
            setLocationMessage(error instanceof Error ? error.message : 'Location search is temporarily unavailable.');
          }
        })
        .finally(() => { if (!controller.signal.aborted) setLocationsBusy(false); });
    }, 300);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [destination, selectedDestination]);

  useEffect(() => {
    if (!selectedDestination || !/^[A-Z]{2}$/.test(selectedDestination.countryCode)) return;
    const controller = new AbortController();
    void (async () => {
      setContextBusy(true);
      setContextMessage('');
      setTransportationOptions([]);
      try {
        const result = await fetchDestinationContext(selectedDestination as LocationSuggestion, controller.signal);
        setTransportationOptions(result.transportation);
        setTransportationPreference((current) => result.transportation.some((mode) => mode.label.toLowerCase() === current) ? current : '');
        setContextMessage(result.transportationMessage);
        if (result.currency) {
          setCurrencyState(result.currency);
          setCurrencyResolved(true);
        } else {
          setCurrencyResolved(false);
        }
      } catch (error: unknown) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setCurrencyResolved(false);
          setContextMessage(error instanceof Error ? error.message : 'Destination details are temporarily unavailable.');
        }
      } finally { if (!controller.signal.aborted) setContextBusy(false); }
    })();
    return () => controller.abort();
  }, [selectedDestination, contextRetry]);

  useEffect(() => {
    if (!selectedDestination || !currencyResolved || contextBusy) return;
    const controller = new AbortController();
    const checkOutDate = endDate === startDate
      ? new Date(new Date(`${startDate}T00:00:00.000Z`).getTime() + 86_400_000).toISOString().slice(0, 10)
      : endDate;
    void (async () => {
      setStaysBusy(true);
      setLiveAccommodations([]);
      setStayMessage('');
      setStayFreshness(null);
      try {
        const result = await fetchDestinationAccommodations({
          destination: selectedDestination.label,
          checkInDate: startDate,
          checkOutDate,
          adults: travelers,
          currency,
          latitude: selectedDestination.latitude,
          longitude: selectedDestination.longitude,
        }, controller.signal);
        setLiveAccommodations(result.accommodations);
        setStayMessage(result.message);
        setStayFreshness(result.freshness || null);
      } catch (error: unknown) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setStayMessage(error instanceof Error ? error.message : 'Accommodation search is temporarily unavailable.');
        }
      } finally { if (!controller.signal.aborted) setStaysBusy(false); }
    })();
    return () => controller.abort();
  }, [selectedDestination, currency, currencyResolved, contextBusy, startDate, endDate, travelers, staysRetry]);

  const changeDestinationInput = useCallback((value: string) => {
    setDestination(value);
    if (selectedDestination?.label === value) return;
    setLocationsBusy(value.trim().length >= 2);
    setSuggestions([]);
    setLocationMessage('');
    setSelectedDestination(null);
    setCurrencyResolved(false);
    setContextMessage('');
    setTransportationOptions([]);
    setTransportationPreference('');
    setLiveAccommodations([]);
    setStayMessage('');
    setStayFreshness(null);
  }, [selectedDestination]);

  const selectDestination = useCallback((location: LocationSuggestion) => {
    setDestination(location.label);
    setSelectedDestination(location);
    setLocationsBusy(false);
    setSuggestions([]);
    setLocationMessage('');
    setCurrencyResolved(false);
    setLiveAccommodations([]);
    setStayMessage('');
    setStayFreshness(null);
  }, []);

  const confirmManualDestination = useCallback((label: string) => {
    const normalized = label.trim().slice(0, 120);
    if (normalized.length < 2) return;
    setDestination(normalized);
    setSelectedDestination({ id: -1, name: normalized.split(',')[0].trim(), region: '', country: '', countryCode: '', label: normalized, placeType: 'Manual destination', contextLabel: `Manual destination • ${normalized}` });
    setSuggestions([]); setLocationsBusy(false); setLocationMessage('Manual destination confirmed. Select its currency; live location-based providers may be unavailable.');
    setCurrencyResolved(false); setTransportationOptions([]); setTransportationPreference(''); setLiveAccommodations([]); setStayFreshness(null);
  }, []);

  const restoreDestination = useCallback((trip: SavedTrip, savedTransportation = '') => {
    const restored: SelectedDestination = {
      id: 0,
      name: trip.destinationCity || trip.destination.split(',')[0].trim(),
      region: trip.destinationRegion || '',
      country: trip.destinationCountry || '',
      countryCode: trip.destinationCountryCode || '',
      latitude: trip.latitude,
      longitude: trip.longitude,
      label: trip.destination,
      placeType: 'Saved destination',
      contextLabel: `Saved destination • ${trip.destination}`,
    };
    setDestination(trip.destination);
    setSelectedDestination(restored);
    setSuggestions([]);
    setCurrencyState(trip.currency);
    setCurrencyResolved(true);
    setTransportationPreference(savedTransportation);
    if (!restored.countryCode) {
      setContextMessage('This older saved trip has no structured country details. Currency was restored from the saved plan.');
    }
  }, []);

  const setManualCurrency = useCallback((value: CurrencyCode) => {
    if (!SUPPORTED_CURRENCIES.includes(value)) return;
    setCurrencyState(value);
    setCurrencyResolved(true);
  }, []);

  return {
    destination,
    selectedDestination,
    suggestions,
    locationsBusy,
    locationMessage,
    currency,
    currencyResolved,
    currencyNeedsFallback: Boolean(selectedDestination && !contextBusy && !currencyResolved),
    contextBusy,
    contextMessage,
    transportationOptions,
    transportationPreference,
    liveAccommodations,
    staysBusy,
    stayMessage,
    stayFreshness,
    changeDestinationInput,
    selectDestination,
    confirmManualDestination,
    restoreDestination,
    setManualCurrency,
    setTransportationPreference,
    retryContext: () => setContextRetry((value) => value + 1),
    retryAccommodations: () => setStaysRetry((value) => value + 1),
  };
}
