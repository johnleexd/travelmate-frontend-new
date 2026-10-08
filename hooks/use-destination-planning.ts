'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProviderAccommodation, RoomOccupancy, FreshnessMetadata, LiveAccommodation, NearbyAccommodation, LocationSuggestion, TransportationOption } from '@/lib/contracts';
import { SUPPORTED_CURRENCIES, type CurrencyCode, type SavedTrip } from '@/lib/domain';
import { fetchDestinationAccommodations, fetchDestinationContext, searchLocations, resolveManualDestination } from '@/services/destination-planning.service';

type SelectedDestination = Omit<LocationSuggestion, 'latitude' | 'longitude'> & { latitude?: number; longitude?: number };

export function useDestinationPlanning(startDate: string, endDate: string, travelers: number, occupancyInput: RoomOccupancy, guestNationality = '') {
  const [destination, setDestination] = useState('');
  const [selectedDestination, setSelectedDestination] = useState<SelectedDestination | null>(null);
  const [suggestionLimit, setSuggestionLimit] = useState(10);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [locationsBusy, setLocationsBusy] = useState(false);
  const [manualBusy, setManualBusy] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const [currency, setCurrencyState] = useState<CurrencyCode>('PHP');
  const [currencyResolved, setCurrencyResolved] = useState(false);
  const [contextBusy, setContextBusy] = useState(false);
  const [contextMessage, setContextMessage] = useState('');
  const [transportationOptions, setTransportationOptions] = useState<TransportationOption[]>([]);
  const [transportationPreference, setTransportationPreference] = useState('');
  const [providerMessage, setProviderMessage] = useState('');
  const [providerEnvironment, setProviderEnvironment] = useState<'sandbox' | 'production' | undefined>();
  const [providerAccommodations, setProviderAccommodations] = useState<ProviderAccommodation[]>([]);
  const [providerStatus, setProviderStatus] = useState<'not-configured' | 'ready' | 'provider-error' | 'no-results'>('not-configured');
  const occupancyIdentity = JSON.stringify(occupancyInput);
  const [liveAccommodations, setLiveAccommodations] = useState<LiveAccommodation[]>([]);
  const [nearbyAccommodations, setNearbyAccommodations] = useState<NearbyAccommodation[]>([]);
  const [stayResultKey, setStayResultKey] = useState('');
  const [stayStatus, setStayStatus] = useState<'idle' | 'ready' | 'no-results' | 'provider-error' | 'needs-area'>('idle');
  const manualRequest = useRef<AbortController | null>(null);
  const manuallyResolvedQuery = useRef('');
  const contextIdentity = JSON.stringify([selectedDestination?.id, selectedDestination?.countryCode, selectedDestination?.latitude, selectedDestination?.longitude]);
  const [resolvedContextIdentity, setResolvedContextIdentity] = useState('');
  const accommodationNeedsArea = Boolean(selectedDestination && ['Country','Region','Island'].includes(selectedDestination.placeType));
  const accommodationDatesValid = /^\d{4}-\d{2}-\d{2}$/.test(startDate) && /^\d{4}-\d{2}-\d{2}$/.test(endDate) && Number.isFinite(Date.parse(startDate)) && Number.isFinite(Date.parse(endDate)) && endDate >= startDate && (Date.parse(endDate) - Date.parse(startDate)) / 86_400_000 < 31;
  const accommodationQueryKey = JSON.stringify([selectedDestination?.label, selectedDestination?.countryCode, selectedDestination?.placeType, selectedDestination?.providerId, selectedDestination?.latitude, selectedDestination?.longitude, startDate, endDate, travelers, occupancyIdentity, guestNationality, currency, currencyResolved]);
  const [staysBusy, setStaysBusy] = useState(false);
  const [stayMessage, setStayMessage] = useState('');
  const [stayFreshness, setStayFreshness] = useState<FreshnessMetadata | null>(null);
  const [contextRetry, setContextRetry] = useState(0);
  const [staysRetry, setStaysRetry] = useState(0);

  useEffect(() => {
    if (manualBusy || manuallyResolvedQuery.current === destination.trim() || selectedDestination?.label === destination || destination.trim().length < 2) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setLocationsBusy(true);
      setLocationMessage('');
      void searchLocations(destination, controller.signal)
        .then((items) => {
          if (controller.signal.aborted) return;
          setSuggestions(items);
          if (!items.length) setLocationMessage('No matching locations found. Try a city, province, or country.');
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          if (!(error instanceof DOMException && error.name === 'AbortError')) {
            setSuggestions([]);
            setLocationMessage(error instanceof Error ? error.message : 'Location search is temporarily unavailable.');
          }
        })
        .finally(() => { if (!controller.signal.aborted) setLocationsBusy(false); });
    }, 300);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [destination, selectedDestination, manualBusy]);

  useEffect(() => () => manualRequest.current?.abort(), []);

  useEffect(() => {
    if (!selectedDestination || !/^[A-Z]{2}$/.test(selectedDestination.countryCode)) return;
    const controller = new AbortController();
    void (async () => {
      setContextBusy(true);
      setContextMessage('');
      setTransportationOptions([]);
      try {
        const result = await fetchDestinationContext(selectedDestination as LocationSuggestion, controller.signal);
        if (controller.signal.aborted) return;
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
        if (controller.signal.aborted) return;
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setCurrencyResolved(false);
          setContextMessage(error instanceof Error ? error.message : 'Destination details are temporarily unavailable.');
        }
      } finally { if (!controller.signal.aborted) { setContextBusy(false); setResolvedContextIdentity(contextIdentity); } }
    })();
    return () => controller.abort();
  }, [selectedDestination, contextRetry, contextIdentity]);

  useEffect(() => {
    if (!selectedDestination || accommodationNeedsArea || contextBusy || resolvedContextIdentity !== contextIdentity || !accommodationDatesValid || !Number.isFinite(selectedDestination.latitude) || !Number.isFinite(selectedDestination.longitude)) return;
    const controller = new AbortController();
    const checkOutDate = endDate === startDate
      ? new Date(new Date(`${startDate}T00:00:00.000Z`).getTime() + 86_400_000).toISOString().slice(0, 10)
      : endDate;
    const timeout = window.setTimeout(() => { void (async () => {
      setStaysBusy(true);
      setProviderAccommodations([]);
    setLiveAccommodations([]);
      setNearbyAccommodations([]);
      setStayMessage('');
      setStayFreshness(null);
      setStayStatus('idle');
      try {
        const occupancy = JSON.parse(occupancyIdentity) as RoomOccupancy;
        const result = await fetchDestinationAccommodations({
          destination: selectedDestination.label,
          countryCode: selectedDestination.countryCode,
          placeType: selectedDestination.placeType,
          quotes: currencyResolved,
          checkInDate: startDate,
          checkOutDate,
          adults: occupancy.reduce((sum, room) => sum + room.adults, 0),
          occupancy,
          guestNationality,
          currency,
          latitude: selectedDestination.latitude,
          longitude: selectedDestination.longitude,
        }, controller.signal);
        if (controller.signal.aborted) return;
        setProviderAccommodations(result.providerAccommodations || []);
        setProviderStatus(result.providerStatus || 'not-configured');
        setProviderMessage(result.providerMessage || '');
        setProviderEnvironment(result.providerEnvironment);
        setLiveAccommodations(result.accommodations);
        setNearbyAccommodations(result.nearbyAccommodations);
        setStayResultKey(accommodationQueryKey);
        setStayMessage(result.message);
        setStayFreshness(result.freshness || null);
        setStayStatus(result.status || (result.accommodations.length || result.nearbyAccommodations.length ? 'ready' : 'no-results'));
      } catch (error: unknown) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          if (controller.signal.aborted) return;
          setStayResultKey(accommodationQueryKey);
          setStayMessage((error instanceof Error ? error.message : 'Accommodation search is temporarily unavailable.') + ' Enter accommodation manually or choose it later.');
          setStayStatus('provider-error');
        }
      } finally { if (!controller.signal.aborted) setStaysBusy(false); }
    })(); }, 400);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [selectedDestination, accommodationNeedsArea, accommodationDatesValid, accommodationQueryKey, currency, currencyResolved, contextBusy, resolvedContextIdentity, contextIdentity, startDate, endDate, travelers, occupancyIdentity, guestNationality, staysRetry]);

  const changeDestinationInput = useCallback((value: string) => {
    manualRequest.current?.abort();
    manuallyResolvedQuery.current = '';
    setManualBusy(false);
    setSuggestionLimit(10);
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
    setNearbyAccommodations([]); setResolvedContextIdentity('');
    setStayResultKey(''); setStaysBusy(false);
    setStayMessage('');
    setStayFreshness(null);
  }, [selectedDestination, setLiveAccommodations, setNearbyAccommodations, setResolvedContextIdentity, setStayResultKey]);

  const selectDestination = useCallback((location: LocationSuggestion) => {
    manualRequest.current?.abort();
    setManualBusy(false);
    if (!/^[A-Z]{2}$/.test(location.countryCode) || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
      setSelectedDestination(null); setLocationMessage('This location has no valid country or coordinates. Resolve it before continuing.'); return;
    }
    setDestination(location.label);
    setSelectedDestination(location);
    setLocationsBusy(false);
    setSuggestions([]);
    setLocationMessage('');
    setCurrencyResolved(false);
    setLiveAccommodations([]);
    setNearbyAccommodations([]); setResolvedContextIdentity('');
    setStayResultKey(''); setStaysBusy(false);
    setStayMessage('');
    setStayFreshness(null);
  }, [setLiveAccommodations, setNearbyAccommodations, setResolvedContextIdentity, setStayResultKey]);

  const confirmManualDestination = useCallback(async (label: string) => {
    const normalized = label.trim().slice(0, 120);
    if (normalized.length < 2) return;
    manualRequest.current?.abort();
    const controller = new AbortController(); manualRequest.current = controller;
    manuallyResolvedQuery.current = normalized;
    setManualBusy(true);
    setSelectedDestination(null); setLocationsBusy(true); setSuggestions([]); setLocationMessage('Resolving the destination...');
    setCurrencyResolved(false); setTransportationOptions([]); setTransportationPreference(''); setLiveAccommodations([]); setNearbyAccommodations([]); setStayFreshness(null);
    try {
      const result = await resolveManualDestination(normalized, controller.signal);
      if (controller.signal.aborted) return;
      if (result.location) selectDestination(result.location);
      else { setSuggestions(result.candidates); setLocationMessage(result.message); setLocationsBusy(false); setManualBusy(false); }
    } catch (error: unknown) {
      if (!controller.signal.aborted) { setLocationsBusy(false); setManualBusy(false); setLocationMessage(error instanceof Error ? error.message : 'Destination could not be resolved. It has not been confirmed.'); }
    }
  }, [selectDestination, setLiveAccommodations, setNearbyAccommodations]);

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
    suggestions: suggestions.slice(0, suggestionLimit),
    hasMoreSuggestions: suggestions.length > suggestionLimit,
    showMoreSuggestions: () => setSuggestionLimit(value => value + 10),
    locationsBusy,
    locationMessage,
    currency,
    currencyResolved,
    currencyNeedsFallback: Boolean(selectedDestination && !contextBusy && !currencyResolved),
    contextBusy,
    contextMessage,
    transportationOptions,
    transportationPreference,
    providerAccommodations: stayResultKey === accommodationQueryKey ? providerAccommodations : [], providerStatus: stayResultKey === accommodationQueryKey ? providerStatus : undefined,
    providerMessage: stayResultKey === accommodationQueryKey ? providerMessage : '', providerEnvironment: stayResultKey === accommodationQueryKey ? providerEnvironment : undefined,
    liveAccommodations: stayResultKey === accommodationQueryKey ? liveAccommodations : [],
    nearbyAccommodations: stayResultKey === accommodationQueryKey ? nearbyAccommodations : [],
    accommodationNeedsArea,
    accommodationQueryKey,
    staysBusy: Boolean(selectedDestination && !accommodationNeedsArea && accommodationDatesValid && (staysBusy || stayResultKey !== accommodationQueryKey)),
    stayStatus: accommodationNeedsArea ? 'needs-area' as const : stayResultKey === accommodationQueryKey ? stayStatus : 'idle' as const,
    stayMessage: accommodationNeedsArea ? `Choose a city or town within this ${selectedDestination?.placeType.toLowerCase()} to find relevant accommodation.` : !accommodationDatesValid && selectedDestination ? 'Choose valid stay dates before searching accommodation.' : stayResultKey === accommodationQueryKey ? stayMessage : '',
    stayFreshness: stayResultKey === accommodationQueryKey ? stayFreshness : null,
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
