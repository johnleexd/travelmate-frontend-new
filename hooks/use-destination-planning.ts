'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProviderAccommodation, FreshnessMetadata, LiveAccommodation, NearbyAccommodation, LocationSuggestion, LocationCandidate, TransportationOption } from '@/lib/contracts';
import { SUPPORTED_CURRENCIES, type CurrencyCode, type SavedTrip } from '@/lib/domain';
import { destinationCurrencies, CURRENCY_NAMES } from '@/lib/generated/currency';
import { savedDestinationAnchor } from '@/lib/destination-identity';
import { fetchDestinationAccommodations, fetchDestinationContext, searchLocationPage, resolveManualDestination, resolveAdministrativeDestination } from '@/services/destination-planning.service';

type SelectedDestination = LocationCandidate;

export function useDestinationPlanning(startDate: string, endDate: string, travelers: number) {
  const [destination, setDestination] = useState('');
  const [selectedDestination, setSelectedDestination] = useState<SelectedDestination | null>(null);
  const [browsingDestination, setBrowsingDestination] = useState<SelectedDestination | null>(null);
  const [suggestionLimit, setSuggestionLimit] = useState(10);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const paginationRequest = useRef<AbortController | null>(null);
  const [suggestions, setSuggestions] = useState<LocationCandidate[]>([]);
  const [locationsBusy, setLocationsBusy] = useState(false);
  const [manualBusy, setManualBusy] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const [currency, setCurrencyState] = useState<CurrencyCode>('PHP');
  const [currencyResolved, setCurrencyResolved] = useState(false);
  const [currencyWasDetected, setCurrencyWasDetected] = useState(false);
  const [currencyFallbackMessage, setCurrencyFallbackMessage] = useState('');
  const [contextBusy, setContextBusy] = useState(false);
  const [contextMessage, setContextMessage] = useState('');
  const [transportationOptions, setTransportationOptions] = useState<TransportationOption[]>([]);
  const [transportationPreference, setTransportationPreference] = useState('');
  const [providerMessage, setProviderMessage] = useState('');
  const [providerEnvironment, setProviderEnvironment] = useState<'sandbox' | 'production' | undefined>();
  const [providerAccommodations, setProviderAccommodations] = useState<ProviderAccommodation[]>([]);
  const [providerStatus, setProviderStatus] = useState<'not-configured' | 'ready' | 'provider-error' | 'no-results'>('not-configured');
  const [liveAccommodations, setLiveAccommodations] = useState<LiveAccommodation[]>([]);
  const [nearbyAccommodations, setNearbyAccommodations] = useState<NearbyAccommodation[]>([]);
  const [stayResultKey, setStayResultKey] = useState('');
  const [stayStatus, setStayStatus] = useState<'idle' | 'ready' | 'no-results' | 'provider-error' | 'needs-area'>('idle');
  const manualRequest = useRef<AbortController | null>(null);
  const manuallyResolvedQuery = useRef('');
  const contextIdentity = JSON.stringify([selectedDestination?.id, selectedDestination?.countryCode, selectedDestination?.latitude, selectedDestination?.longitude]);
  const manualCurrency = useRef<{ identity: string; currency: CurrencyCode } | null>(null);
  const [resolvedContextIdentity, setResolvedContextIdentity] = useState('');
  const accommodationNeedsArea = Boolean(selectedDestination && (['country','area'].includes(selectedDestination.scopeType || '') || ['Country','Region','Province','Island','Administrative area'].includes(selectedDestination.placeType)));
  const accommodationDatesValid = /^\d{4}-\d{2}-\d{2}$/.test(startDate) && /^\d{4}-\d{2}-\d{2}$/.test(endDate) && Number.isFinite(Date.parse(startDate)) && Number.isFinite(Date.parse(endDate)) && endDate >= startDate && (Date.parse(endDate) - Date.parse(startDate)) / 86_400_000 < 31;
  const accommodationQueryKey = JSON.stringify([selectedDestination?.label, selectedDestination?.countryCode, selectedDestination?.placeType, selectedDestination?.providerId, selectedDestination?.latitude, selectedDestination?.longitude, startDate, endDate, travelers, currency, currencyResolved]);
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
      void searchLocationPage(destination, 0, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return;
          setSuggestions(result.locations); setNextOffset(result.nextOffset ?? null);
          setLocationMessage(result.message || (!result.locations.length ? 'No catalogue match. Try verified geocoding with its parent areas and country.' : ''));
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

  useEffect(() => () => { manualRequest.current?.abort(); paginationRequest.current?.abort(); }, []);

  useEffect(() => {
    if (!selectedDestination || !/^[A-Z]{2}$/.test(selectedDestination.countryCode)) return;
    const controller = new AbortController();
    void (async () => {
      setContextBusy(true);
      setContextMessage('');
      const choices = destinationCurrencies(selectedDestination.countryCode);
      const chosen = manualCurrency.current?.identity === contextIdentity ? manualCurrency.current.currency : null;
      const detected = choices.length === 1 ? choices[0] : null;
      const resolved = chosen ?? detected;
      if (resolved) setCurrencyState(resolved);
      setCurrencyResolved(Boolean(resolved));
      setCurrencyWasDetected(Boolean(detected && !chosen));
      setCurrencyFallbackMessage(resolved ? `${resolved} · ${CURRENCY_NAMES[resolved]}` : choices.length ? `Destination currencies: ${choices.join(', ')}. Choose one for your budget.` : 'Destination currency unconfirmed. Choose a planning currency.');
      setTransportationOptions([]);
      try {
        const result = await fetchDestinationContext(selectedDestination as LocationSuggestion, controller.signal);
        if (controller.signal.aborted) return;
        setTransportationOptions(result.transportation);
        // Destination changes clear the preference explicitly. Context refresh must not silently erase a saved or chosen mode.
        setContextMessage(result.transportationMessage);
      } catch (error: unknown) {
        if (controller.signal.aborted) return;
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
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
        const result = await fetchDestinationAccommodations({
          destination: selectedDestination.label,
          countryCode: selectedDestination.countryCode,
          locationId: selectedDestination.id,
          locationProvider: selectedDestination.provider,
          locationProviderId: selectedDestination.providerId,
          administrativeCode: selectedDestination.administrativeCode,
          provinceCode: selectedDestination.provinceCode,
          placeType: selectedDestination.placeType,
          checkInDate: startDate,
          checkOutDate,
          adults: travelers,
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
  }, [selectedDestination, accommodationNeedsArea, accommodationDatesValid, accommodationQueryKey, currency, currencyResolved, contextBusy, resolvedContextIdentity, contextIdentity, startDate, endDate, travelers, staysRetry]);

  const changeDestinationInput = useCallback((value: string) => {
    paginationRequest.current?.abort(); setNextOffset(null);
    manualRequest.current?.abort();
    manuallyResolvedQuery.current = '';
    setManualBusy(false);
    setSuggestionLimit(10);
    setDestination(value);
    if (selectedDestination?.label === value) return;
    setBrowsingDestination(null);
    manualCurrency.current = null;
    setLocationsBusy(value.trim().length >= 2);
    setSuggestions([]);
    setLocationMessage('');
    setSelectedDestination(null);
    setCurrencyResolved(false);
    setCurrencyWasDetected(false);
    setCurrencyFallbackMessage('');
    setContextMessage('');
    setTransportationOptions([]);
    setTransportationPreference('');
    setLiveAccommodations([]);
    setNearbyAccommodations([]); setResolvedContextIdentity('');
    setStayResultKey(''); setStaysBusy(false);
    setStayMessage('');
    setStayFreshness(null);
  }, [selectedDestination, setLiveAccommodations, setNearbyAccommodations, setResolvedContextIdentity, setStayResultKey]);

  const selectDestination = useCallback(async (input: LocationCandidate, preserveBrowsing = false): Promise<boolean> => {
    paginationRequest.current?.abort(); setNextOffset(null);
    manualRequest.current?.abort();
    setManualBusy(false);
    const controller = new AbortController(); manualRequest.current = controller;
    let location = input;
    const officialArea = location.provider === 'psgc' && ['Province','Region'].includes(location.placeType);
    if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
      if (!officialArea && location.provider === 'psgc') {
        setManualBusy(true); setSelectedDestination(null); setDestination(location.label);
        manuallyResolvedQuery.current = location.label;
        setLocationMessage('Verifying coordinates for the selected official location…');
        try { location = await resolveAdministrativeDestination(location, controller.signal); }
        catch (error) { if (!controller.signal.aborted) setLocationMessage(error instanceof Error ? error.message : 'Coordinates could not be verified. Retry this location.'); return false; }
        finally { if (!controller.signal.aborted) setManualBusy(false); }
      } else if (!officialArea) { setSelectedDestination(null); setLocationMessage('This location has no valid country or coordinates. Resolve it before continuing.'); return false; }
    }
    if (controller.signal.aborted) return false;
    if (!/^[A-Z]{2}$/.test(location.countryCode)) { setLocationMessage('Choose a location with a verified country.'); return false; }
    setDestination(location.label);
    manualCurrency.current = null;
    setSelectedDestination(location);
    if (!preserveBrowsing) setBrowsingDestination(location.canBrowse || ['country','area'].includes(location.scopeType || '') || ['Country','Region','Province','Island','Administrative area'].includes(location.placeType) ? location : null);
    setLocationsBusy(false);
    setSuggestions([]);
    setLocationMessage('');
    setCurrencyResolved(false);
    setCurrencyWasDetected(false);
    setCurrencyFallbackMessage('');
    setLiveAccommodations([]);
    setNearbyAccommodations([]); setResolvedContextIdentity('');
    setStayResultKey(''); setStaysBusy(false);
    setStayMessage('');
    setStayFreshness(null);
    return true;
  }, [setLiveAccommodations, setNearbyAccommodations, setResolvedContextIdentity, setStayResultKey]);

  const confirmManualDestination = useCallback(async (label: string) => {
    paginationRequest.current?.abort(); setNextOffset(null);
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
    const storedAnchor = savedDestinationAnchor(trip.itinerary);
    const anchor = storedAnchor && (!trip.destinationCountryCode || storedAnchor.countryCode === trip.destinationCountryCode) && (!trip.destinationCity || storedAnchor.city === trip.destinationCity) && (trip.latitude == null || Math.abs(trip.latitude - storedAnchor.latitude) <= 0.00000051) && (trip.longitude == null || Math.abs(trip.longitude - storedAnchor.longitude) <= 0.00000051) ? storedAnchor : undefined;
    const restored: SelectedDestination = {
      id: anchor?.id || 0,
      name: trip.destinationCity || anchor?.city || trip.destination.split(',')[0].trim(),
      region: trip.destinationRegion || anchor?.region || '',
      country: trip.destinationCountry || anchor?.country || '',
      countryCode: trip.destinationCountryCode || anchor?.countryCode || '',
      latitude: anchor?.latitude ?? trip.latitude,
      longitude: anchor?.longitude ?? trip.longitude,
      label: trip.destination,
      placeType: anchor?.placeType || 'Saved destination',
      contextLabel: `Saved destination • ${trip.destination}`,
      coordinateStatus: anchor || trip.latitude != null && trip.longitude != null ? 'resolved' : 'unresolved',
      sourceFeatureCode: anchor?.sourceFeatureCode, scopeType: anchor?.scopeType, locationPath: anchor?.locationPath, parentId: anchor?.parentId, canBrowse: anchor?.canBrowse,
      ...(anchor?.provider ? { provider: anchor.provider, providerId: anchor.providerId, administrativeCode: anchor.administrativeCode, provinceCode: anchor.provinceCode, geographicProvinceCode: anchor.geographicProvinceCode, administrativeLevel: anchor.administrativeLevel, coordinateSource: anchor.coordinateSource } : {}),
    };
    setDestination(trip.destination);
    manualCurrency.current = { identity: JSON.stringify([restored.id,restored.countryCode,restored.latitude,restored.longitude]), currency: trip.currency };
    setSelectedDestination(restored);
    setBrowsingDestination(restored.canBrowse || ['country','area'].includes(restored.scopeType || '') ? restored : null);
    setSuggestions([]);
    setCurrencyState(trip.currency);
    setCurrencyResolved(true);
    setCurrencyWasDetected(false);
    setTransportationPreference(savedTransportation);
    if (!restored.countryCode) {
      setContextMessage('This older saved trip has no structured country details. Currency was restored from the saved plan.');
    }
  }, []);

  const setManualCurrency = useCallback((value: CurrencyCode) => {
    if (!SUPPORTED_CURRENCIES.includes(value)) return;
    manualCurrency.current = { identity: contextIdentity, currency: value };
    setCurrencyState(value);
    setCurrencyResolved(true);
    setCurrencyWasDetected(false);
  }, [contextIdentity]);

  return {
    destination,
    selectedDestination,
    browsingDestination,
    suggestions: suggestions.slice(0, suggestionLimit),
    hasMoreSuggestions: suggestions.length > suggestionLimit || nextOffset !== null,
    showMoreSuggestions: async () => {
      if (suggestions.length > suggestionLimit) { setSuggestionLimit(value => value + 10); return; }
      if (nextOffset === null || locationsBusy) return;
      const controller = new AbortController(); paginationRequest.current?.abort(); paginationRequest.current = controller;
      setLocationsBusy(true);
      try { const page = await searchLocationPage(destination, nextOffset, controller.signal); if (!controller.signal.aborted) { setSuggestions(current => { const ids = new Set(current.map(p => p.id)); return [...current, ...page.locations.filter(p => !ids.has(p.id))]; }); setNextOffset(page.nextOffset ?? null); setSuggestionLimit(value => value + 20); } }
      catch (error) { if (!controller.signal.aborted) setLocationMessage(error instanceof Error ? error.message : 'Could not load the next page. Retry.'); }
      finally { if (!controller.signal.aborted) setLocationsBusy(false); }
    },
    locationsBusy,
    locationMessage,
    currency,
    currencyResolved,
    currencyWasDetected,
    currencyFallbackMessage,
    currencyNeedsFallback: Boolean(selectedDestination && !contextBusy && (!currencyResolved || !currencyWasDetected)),
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
