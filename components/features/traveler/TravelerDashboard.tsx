'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, Bell, CalendarDays, CloudSun, Compass, Home, LocateFixed, LogOut, MapPin, Plane, UserRound, WalletCards, X } from 'lucide-react';
import { fetchTripData, fetchWeather, handleResponse, isAuthenticationError, refreshItineraryDayImages, type DayActivity, type ItineraryResponse, type WeatherData } from '@/services/api.service';
import { CURRENCY_NAMES, formatMoney, partyBudgetExplanation, partyBudgetLabel, partySpendLabel, PARTY_TYPE_LABELS, SUPPORTED_CURRENCIES, ZERO_DECIMAL_CURRENCIES, type CurrencyCode, type PartyType } from '@/lib/domain';
import { CEBU_LOCATIONS as CEBU_LOCATION_VALUES } from '@/constants/cebu-locations';
import type { PlatformActionResponse, PlatformResponse, ProfileResponse, SavedTrip, TravelOptionsResponse } from '@/lib/contracts';
import { moveActivity, removeActivity, upsertActivity } from '@/lib/itinerary-editor';
import { applyConditionSnapshot } from '@/lib/conditions';
import { DashboardLoadState } from '@/components/common/DashboardLoadState';
import { ItinerarySkeleton } from '@/components/common/ContentSkeletons';
import { Skeleton, SkeletonRegion } from '@/components/common/Skeleton';
import { TravelerJourneyOverview } from '@/components/features/traveler/TravelerJourneyOverview';
import { TravelerAccountCenter } from '@/components/features/traveler/TravelerAccountCenter';
import { SavedTripLifecycle } from '@/components/features/traveler/SavedTripLifecycle';
import { useModalAccessibility } from '@/hooks/use-modal-accessibility';
import { useDestinationPlanning } from '@/hooks/use-destination-planning';
import { fetchCurrentLocation, fetchExchangeRate } from '@/services/destination-planning.service';
import { isCurrencyCode } from '@/lib/currency-conversion';
import type { ExchangeRateQuote } from '@/lib/contracts';
import { ReferenceAmount } from '@/components/common/ReferenceAmount';
import { ProviderFreshness } from '@/components/common/ProviderFreshness';
import { TravelComparisonWorkspace } from '@/components/features/traveler/TravelComparisonWorkspace';
import { ItineraryWorkspace } from '@/components/features/traveler/ItineraryWorkspace';
import { ActivityEditorDialog, DayDetailsDialog } from '@/components/features/traveler/TravelerItineraryDialogs';
import { parseTravelOptionsResponse } from '@/services/provider-response';
import { addCalendarDays, localDateInputValue, regenerationDraftDates } from '@/lib/date';
import { recommendAccommodation } from '@/lib/accommodation-recommendation';
import { TravelerNotifications } from '@/components/features/traveler/TravelerNotifications';

type Tab = 'overview' | 'planner' | 'budget' | 'compare' | 'bookings' | 'notifications' | 'profile';
type PreTripCostDraft = {
  airportTransfers: number; passport: number; visaOrAuthorization: number;
  departureTaxes: number; insurance: number; other: number;
};
const EMPTY_PRE_TRIP_COSTS: PreTripCostDraft = { airportTransfers: 0, passport: 0, visaOrAuthorization: 0, departureTaxes: 0, insurance: 0, other: 0 };
const CEBU_LOCATIONS: readonly string[] = CEBU_LOCATION_VALUES;
const TAB_COPY: Record<Tab, { title: string; description: string }> = {
  overview: { title: 'Your travel home', description: 'See what TravelMate does, where your plans are, and the single best action to take next.' },
  planner: { title: 'Start a new trip', description: 'Begin with four essentials. Optional preferences simply help make the itinerary more personal.' },
  budget: { title: 'Does this plan fit your budget?', description: 'Review estimated spending, remaining money, and optional ways to reduce cost.' },
  compare: { title: 'Compare available travel options', description: 'Check flights, stays, and activities for the destination and dates already in your plan.' },
  bookings: { title: 'Saved trips', description: 'Reopen and manage the trip plans you saved.' },
  notifications: { title: 'Travel updates that need you.', description: 'Read account warnings, report updates, and other important notices.' },
  profile: { title: 'Your account', description: 'Manage contact information and understand what verification changes.' },
};

gsap.registerPlugin(useGSAP, ScrollTrigger);

function savedItinerary(value: unknown): ItineraryResponse | null {
  if (!value || typeof value !== 'object') return null;
  const itinerary = value as Partial<ItineraryResponse>;
  return typeof itinerary.destination === 'string' && Array.isArray(itinerary.days) && itinerary.days.length > 0 ? itinerary as ItineraryResponse : null;
}

async function api(): Promise<PlatformResponse>;
async function api(body: Record<string, unknown>): Promise<PlatformActionResponse>;
async function api(body?: Record<string, unknown>): Promise<PlatformResponse | PlatformActionResponse> {
  const response = await fetch(body ? '/api/platform' : '/api/platform?scope=traveler', body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  return body ? handleResponse<PlatformActionResponse>(response) : handleResponse<PlatformResponse>(response);
}

export default function TravelerDashboard({ initialTab }: { initialTab?: Tab }) {
  const router = useRouter();
  const [data, setData] = useState<PlatformResponse | null>(null);
  const [selectedTab, setSelectedTab] = useState<Tab>('overview');
  const [message, setMessage] = useState('');
  const sectionVersionRef = useRef(0);
  const tab = initialTab === 'planner' ? 'planner' : selectedTab;
  const setTab = useCallback((nextTab: Tab) => {
    sectionVersionRef.current += 1;
    setMessage('');
    setSelectedTab(nextTab);
    if (initialTab === 'planner' && nextTab !== 'planner') router.replace('/dashboard');
  }, [initialTab, router]);
  const [budget, setBudget] = useState(0);
  const [referenceCurrency, setReferenceCurrency] = useState<CurrencyCode>('PHP');
  const [referencePreferenceReady, setReferencePreferenceReady] = useState(false);
  const [exchangeQuotes, setExchangeQuotes] = useState<Partial<Record<CurrencyCode, ExchangeRateQuote>>>({});
  const [exchangeBusy, setExchangeBusy] = useState(false);
  const [exchangeMessage, setExchangeMessage] = useState('');
  const [partyType, setPartyType] = useState<PartyType>('solo');
  const [travelers, setTravelers] = useState(1);
  const [startDate, setStartDate] = useState(() => localDateInputValue());
  const [endDate, setEndDate] = useState(() => addCalendarDays(localDateInputValue(), 6));
  const {
    destination, selectedDestination, suggestions: locationSuggestions, locationsBusy, locationMessage,
    currency, currencyResolved, currencyNeedsFallback, contextBusy, contextMessage, transportationOptions,
    transportationPreference, liveAccommodations, staysBusy, stayMessage, stayFreshness,
    changeDestinationInput, selectDestination, confirmManualDestination, restoreDestination, setManualCurrency,
    setTransportationPreference, retryContext, retryAccommodations,
  } = useDestinationPlanning(startDate, endDate, travelers);
  const [interests, setInterests] = useState('food, culture, nature');
  const [travelStyle, setTravelStyle] = useState('balanced');
  const [preferredActivities, setPreferredActivities] = useState('local food, sightseeing');
  const [accommodationPreference, setAccommodationPreference] = useState('budget-friendly');
  const [selectedStayId, setSelectedStayId] = useState('');
  const [selectedLiveStayId, setSelectedLiveStayId] = useState('');
  const [itinerary, setItinerary] = useState<ItineraryResponse | null>(null);
  const [selectedDay, setSelectedDay] = useState<ItineraryResponse['days'][number] | null>(null);
  const [photoRefreshDay, setPhotoRefreshDay] = useState<number | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [conditionsBusy, setConditionsBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [generationBusy, setGenerationBusy] = useState(false);
  const [generationFailed, setGenerationFailed] = useState(false);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [regenerationTargetId, setRegenerationTargetId] = useState<string | null>(null);
  const [activityEditor, setActivityEditor] = useState<{ dayIndex: number; activityIndex: number | null } | null>(null);
  const [manualDirty, setManualDirty] = useState(false);
  const [flightOrigin, setFlightOrigin] = useState('');
  const [currentLocationBusy, setCurrentLocationBusy] = useState(false);
  const [currentLocationMessage, setCurrentLocationMessage] = useState('');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [preTripCosts, setPreTripCosts] = useState<PreTripCostDraft>(EMPTY_PRE_TRIP_COSTS);
  const [includePreTripCosts, setIncludePreTripCosts] = useState(false);
  const [travelOptions, setTravelOptions] = useState<TravelOptionsResponse | null>(null);
  const [selectedFlightId, setSelectedFlightId] = useState('');
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([]);
  const [comparisonBusy, setComparisonBusy] = useState(false);
  const [comparisonMessage, setComparisonMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const activityModalRef = useRef<HTMLDivElement | null>(null);
  const activityTitleRef = useRef<HTMLInputElement | null>(null);
  const dayModalRef = useRef<HTMLDivElement | null>(null);
  const dayCloseRef = useRef<HTMLButtonElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const profileMenuCloseRef = useRef<HTMLButtonElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const workspaceHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const dashboardMountedRef = useRef(false);
  const generationRequestRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const draftCheckedRef = useRef(false);
  const exchangeSourceCurrencies = useMemo(() => {
    const values: unknown[] = [currency, itinerary?.currency, 'PHP'];
    values.push(...liveAccommodations.map((stay) => stay.currency));
    values.push(...(travelOptions?.flights.map((flight) => flight.currency) || []));
    values.push(...(travelOptions?.activities.map((activity) => activity.currency) || []));
    values.push(...(data?.trips.map((trip) => trip.currency) || []));
    return [...new Set(values.filter(isCurrencyCode))];
  }, [currency, itinerary?.currency, liveAccommodations, travelOptions, data?.trips]);

  const refresh = () => api().then(setData);
  const loadInitial = async () => {
    try { setData(await api()); }
    catch (error) {
      if (isAuthenticationError(error)) { router.replace('/account/appeal'); return; }
      setLoadError(error instanceof Error ? error.message : 'TravelMate could not load your workspace.');
    }
  };
  useEffect(() => {
    void api().then(setData).catch((error: unknown) => {
      if (isAuthenticationError(error)) { router.replace('/account/appeal'); return; }
      setLoadError(error instanceof Error ? error.message : 'TravelMate could not load your workspace.');
    });
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem('travelmate-reference-currency');
      if (isCurrencyCode(stored)) setReferenceCurrency(stored);
      setReferencePreferenceReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!referencePreferenceReady) return;
    window.localStorage.setItem('travelmate-reference-currency', referenceCurrency);
  }, [referenceCurrency, referencePreferenceReady]);

  useEffect(() => {
    if (!data || draftCheckedRef.current) return;
    const timer = window.setTimeout(() => {
      if (draftCheckedRef.current) return;
      draftCheckedRef.current = true;
      const key = `travelmate-itinerary-draft:${data.user.id}`;
      const stored = window.localStorage.getItem(key);
      if (!stored) return;
      try {
        const draft = JSON.parse(stored) as { trip?: SavedTrip; itinerary?: unknown; weather?: unknown; savedAt?: string };
        const plan = savedItinerary(draft.itinerary);
        if (!draft.trip || !plan) throw new Error('Invalid draft');
        if (!window.confirm(`Restore your unsaved ${draft.trip.destination} itinerary draft${draft.savedAt ? ` from ${new Date(draft.savedAt).toLocaleString()}` : ''}?`)) {
          window.localStorage.removeItem(key);
          return;
        }
        setBudget(draft.trip.budget); setStartDate(draft.trip.startDate); setEndDate(draft.trip.endDate);
        setTravelers(draft.trip.travelers); setPartyType(draft.trip.partyType); setInterests(draft.trip.interests.join(', '));
        restoreDestination(draft.trip, plan.preferences?.transportation || '');
        if (plan.preferences) { setTravelStyle(plan.preferences.travelStyle); setAccommodationPreference(plan.preferences.accommodation); setPreferredActivities(plan.preferences.activities.join(', ')); }
        const restoredPreTrip = plan.selectedTravelCosts?.preTrip;
        setFlightOrigin(restoredPreTrip?.startingLocation || '');
        setPreTripCosts(restoredPreTrip ? { airportTransfers: restoredPreTrip.airportTransferOutbound + restoredPreTrip.airportTransferReturn, passport: restoredPreTrip.passport, visaOrAuthorization: restoredPreTrip.visaOrAuthorization, departureTaxes: restoredPreTrip.departureTaxes, insurance: restoredPreTrip.insurance, other: restoredPreTrip.other } : EMPTY_PRE_TRIP_COSTS);
        setIncludePreTripCosts(Boolean(restoredPreTrip?.total));
        setItinerary(plan); setWeather(draft.weather && typeof draft.weather === 'object' ? draft.weather as WeatherData : null);
        setEditingTripId(draft.trip.id || null); setRegenerationTargetId(null); setManualDirty(true); setTab('planner');
        setMessage('Unsaved browser draft restored. Review it, then save your changes.');
      } catch {
        window.localStorage.removeItem(key);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [data, restoreDestination]);

  useEffect(() => {
    if (!data || !itinerary || !manualDirty) return;
    const key = `travelmate-itinerary-draft:${data.user.id}`;
    const trip: SavedTrip = {
      id: editingTripId || '', userId: data.user.id, destination, destinationCity: selectedDestination?.name,
      destinationRegion: selectedDestination?.region, destinationCountry: selectedDestination?.country,
      destinationCountryCode: selectedDestination?.countryCode, latitude: selectedDestination?.latitude,
      longitude: selectedDestination?.longitude, budget, currency, startDate, endDate, travelers, partyType,
      interests: interests.split(',').map((item) => item.trim()).filter(Boolean), itinerary, weather,
      status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(key, JSON.stringify({ trip, itinerary, weather, savedAt: new Date().toISOString() }));
  }, [data, itinerary, weather, manualDirty, editingTripId, destination, selectedDestination, budget, currency, startDate, endDate, travelers, partyType, interests]);

  useEffect(() => {
    if (!manualDirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [manualDirty]);

  useEffect(() => {
    if (!referencePreferenceReady) return;
    const sources = exchangeSourceCurrencies.filter((source) => source !== referenceCurrency);
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      if (sources.length === 0) {
        setExchangeQuotes({});
        setExchangeBusy(false);
        setExchangeMessage('');
        return;
      }
      setExchangeBusy(true);
      setExchangeMessage('');
      void Promise.allSettled(sources.map((source) => fetchExchangeRate(source, referenceCurrency, controller.signal)))
        .then((results) => {
          if (controller.signal.aborted) return;
          const next: Partial<Record<CurrencyCode, ExchangeRateQuote>> = {};
          results.forEach((result) => { if (result.status === 'fulfilled') next[result.value.base] = result.value; });
          setExchangeQuotes(next);
          if (results.some((result) => result.status === 'rejected')) setExchangeMessage('Some reference conversions are temporarily unavailable. Destination prices remain unchanged.');
        })
        .finally(() => { if (!controller.signal.aborted) setExchangeBusy(false); });
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [exchangeSourceCurrencies, referenceCurrency, referencePreferenceReady]);
  useModalAccessibility({
    active: activityEditor !== null,
    containerRef: activityModalRef,
    initialFocusRef: activityTitleRef,
    onClose: () => setActivityEditor(null),
  });
  useModalAccessibility({
    active: profileMenuOpen,
    containerRef: profileMenuRef,
    initialFocusRef: profileMenuCloseRef,
    onClose: () => setProfileMenuOpen(false),
  });

  useEffect(() => {
    if (!dashboardMountedRef.current) {
      dashboardMountedRef.current = true;
      return;
    }
    window.requestAnimationFrame(() => workspaceHeadingRef.current?.focus());
  }, [tab]);
  useEffect(() => {
    if (!data?.user.id) return;
    let active = true;
    let loading = false;
    const updateNotifications = async () => {
      if (loading || document.visibilityState === 'hidden') return;
      loading = true;
      try {
        const result = await api();
        if (active) setData(current => current ? { ...current, notifications: result.notifications } : current);
      } catch (error) { if (active && isAuthenticationError(error)) router.replace('/account/appeal'); }
      finally { loading = false; }
    };
    void updateNotifications();
    const interval = window.setInterval(() => void updateNotifications(), 30_000);
    window.addEventListener('focus', updateNotifications);
    return () => { active = false; window.clearInterval(interval); window.removeEventListener('focus', updateNotifications); };
  }, [tab, data?.user.id, router]);
  useModalAccessibility({
    active: selectedDay !== null,
    containerRef: dayModalRef,
    initialFocusRef: dayCloseRef,
    onClose: () => setSelectedDay(null),
  });

  useGSAP(() => {
    if (!data || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const media = gsap.matchMedia();
    gsap.utils.toArray<HTMLElement>('[data-dashboard-image]').forEach((image) => {
      gsap.fromTo(image, { autoAlpha: 0.58, scale: 0.88 }, {
        autoAlpha: 1,
        scale: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: image,
          start: 'top 92%',
          end: 'top 42%',
          scrub: true,
        },
      });
      gsap.to(image, {
        autoAlpha: 0.3,
        scale: 0.97,
        ease: 'none',
        scrollTrigger: {
          trigger: image,
          start: 'bottom 28%',
          end: 'bottom top',
          scrub: true,
        },
      });
    });

    const journeyCards = gsap.utils.toArray<HTMLElement>('[data-journey-card]');
    if (journeyCards.length > 0) {
      gsap.fromTo(journeyCards, { y: 52, scale: 0.96, opacity: 0.35 }, {
        y: 0,
        scale: 1,
        opacity: 1,
        duration: 0.85,
        stagger: 0.09,
        ease: 'power3.out',
        scrollTrigger: { trigger: journeyCards[0], start: 'top 88%', once: true },
      });
    }

    const lifecycleWords = gsap.utils.toArray<HTMLElement>('[data-lifecycle-word]');
    if (lifecycleWords.length > 0) {
      gsap.fromTo(lifecycleWords, { opacity: 0.18 }, {
        opacity: 1,
        stagger: 0.03,
        ease: 'none',
        scrollTrigger: { trigger: lifecycleWords[0].parentElement, start: 'top 82%', end: 'bottom 42%', scrub: 0.6 },
      });
    }

    const lifecycleRail = document.querySelector<HTMLElement>('[data-lifecycle-rail]');
    if (lifecycleRail) {
      media.add('(min-width: 1024px)', () => {
        const marquee = gsap.to(lifecycleRail, { xPercent: -50, duration: 28, repeat: -1, ease: 'none' });
        return () => marquee.kill();
      });
    }

    gsap.utils.toArray<HTMLElement>('[data-lifecycle-stack]').forEach((card, index) => {
      gsap.fromTo(card, { y: 36 + index * 12, scale: 0.96 }, {
        y: 0,
        scale: 1,
        ease: 'none',
        scrollTrigger: { trigger: card, start: 'top 92%', end: 'top 58%', scrub: 0.45 },
      });
    });

    ScrollTrigger.refresh();
    return () => media.revert();
  }, { scope: pageRef, dependencies: [data, tab], revertOnUpdate: true });

  async function searchComparison() {
    const comparisonOrigin = flightOrigin.trim();
    if (travelers > 9) { setComparisonMessage('Live provider comparison currently supports up to 9 travelers.'); return; }
    if (comparisonOrigin.length < 2 || destination.trim().length < 2) { setComparisonMessage('Enter a valid starting location or departure airport and destination.'); return; }
    setComparisonBusy(true); setComparisonMessage(''); setTravelOptions(null); setSelectedFlightId(''); setSelectedActivityIds([]);
    try {
      const comparisonParams = new URLSearchParams({ origin: comparisonOrigin, destination: destination.trim(), departureDate: startDate, returnDate: endDate, adults: String(travelers), currency });
      if (Number.isFinite(selectedDestination?.latitude) && Number.isFinite(selectedDestination?.longitude)) {
        comparisonParams.set('latitude', String(selectedDestination!.latitude)); comparisonParams.set('longitude', String(selectedDestination!.longitude));
      }
      const comparisonResult = await fetch(`/api/travel-options?${comparisonParams}`).then((response) => handleResponse<unknown>(response)).then(parseTravelOptionsResponse);
      setTravelOptions(comparisonResult);
      setComparisonMessage(`${comparisonResult.flightMessage} ${comparisonResult.activityMessage}`);
    } catch (error) {
      setComparisonMessage(error instanceof Error ? error.message : 'Flight and activity comparison failed.');
    } finally { setComparisonBusy(false); }
  }

  function handleDestinationKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (locationSuggestions.length === 0) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); setActiveSuggestionIndex((index) => Math.min(locationSuggestions.length - 1, index + 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActiveSuggestionIndex((index) => Math.max(0, index - 1)); }
    else if (event.key === 'Enter' && activeSuggestionIndex >= 0) { event.preventDefault(); confirmDestination(locationSuggestions[activeSuggestionIndex]); setActiveSuggestionIndex(-1); }
    else if (event.key === 'Escape') setActiveSuggestionIndex(-1);
  }

  async function generate() {
    if (busy) return;
    if (!selectedDestination || !currencyResolved) { setMessage('Select a destination suggestion and confirm its currency before generating.'); return; }
    if (startDate < localDateInputValue()) {
      if (regenerationTargetId) {
        const draftDates = regenerationDraftDates(startDate, endDate);
        setStartDate(draftDates.startDate); setEndDate(draftDates.endDate); setGenerationFailed(true);
        setMessage(`The saved dates have passed. Draft dates moved to ${draftDates.startDate}–${draftDates.endDate}; review them, then select Generate my trip again. Your saved plan is unchanged.`);
      } else {
        setGenerationFailed(true);
        setMessage('These trip dates have passed. Choose a new start date before generating; your saved plan is unchanged.');
      }
      return;
    }
    setBusy(true); setGenerationBusy(true); setMessage('');
    try {
      const selectedStay = data?.listings.find((listing) => listing.id === selectedStayId);
      const selectedLiveStay = liveAccommodations.find((stay) => stay.id === selectedLiveStayId)
        || (!selectedStayId ? accommodationRecommendation?.accommodation : undefined);
      const selectedFlight = travelOptions?.flights.find((flight) => flight.id === selectedFlightId);
      const selectedActivities = travelOptions?.activities.filter((activity) => selectedActivityIds.includes(activity.id)) || [];
      const requestDetails = { destination: destination.trim(), budget, currency, partyType, travelers, startDate, endDate, interests, preferredActivities, travelStyle, accommodationPreference, transportationPreference, accommodationListingId: selectedStay?.id, externalAccommodationId: selectedLiveStay?.id, selectedFlightId, selectedActivityIds, flightOrigin, includePreTripCosts, preTripCosts };
      const fingerprint = JSON.stringify(requestDetails);
      const idempotencyKey = generationRequestRef.current?.fingerprint === fingerprint ? generationRequestRef.current.key : crypto.randomUUID();
      generationRequestRef.current = { fingerprint, key: idempotencyKey };
      const result = await fetchTripData(destination.trim(), budget, { idempotencyKey, currency, partyType, travelers, startDate, endDate, latitude: selectedDestination.latitude, longitude: selectedDestination.longitude, interests: interests.split(',').map((x) => x.trim()).filter(Boolean), preferredActivities: preferredActivities.split(',').map((x) => x.trim()).filter(Boolean), travelStyle, accommodationPreference, transportationPreference: transportationPreference || 'locally appropriate transportation', accommodationListingId: selectedStay?.id, externalAccommodation: selectedLiveStay ? { hotelId: selectedLiveStay.hotelId, offerId: selectedLiveStay.offerId, name: selectedLiveStay.name, address: selectedLiveStay.address, nightlyRate: selectedLiveStay.nightlyRate, currency: selectedLiveStay.currency, isLive: selectedLiveStay.isLive, selectionToken: selectedLiveStay.selectionToken } : undefined, selectedFlight: selectedFlight ? { id: selectedFlight.id, name: `${selectedFlight.airline} ${selectedFlight.origin}-${selectedFlight.destination}`, price: selectedFlight.price, currency: selectedFlight.currency, fetchedAt: selectedFlight.fetchedAt, selectionToken: selectedFlight.selectionToken } : undefined, selectedActivities: selectedActivities.map((activity) => ({ id: activity.id, name: activity.name, price: activity.price, currency: activity.currency, fetchedAt: activity.fetchedAt, selectionToken: activity.selectionToken })), preTripCosts: includePreTripCosts ? { startingLocation: flightOrigin.trim() || undefined, airportTransferOutbound: preTripCosts.airportTransfers, airportTransferReturn: 0, passport: preTripCosts.passport, visaOrAuthorization: preTripCosts.visaOrAuthorization, departureTaxes: preTripCosts.departureTaxes, insurance: preTripCosts.insurance, other: preTripCosts.other } : undefined });
      generationRequestRef.current = null;
      setItinerary(result.itinerary); setWeather(result.weather); setManualDirty(false); setActivityEditor(null); setGenerationFailed(false);
      const destinationDetails = selectedDestination.countryCode && selectedDestination.country ? { city: selectedDestination.name, region: selectedDestination.region, country: selectedDestination.country, countryCode: selectedDestination.countryCode, latitude: selectedDestination.latitude, longitude: selectedDestination.longitude } : undefined;
      try {
        const response = await api({
          action: regenerationTargetId ? 'update-trip' : 'save-trip', id: regenerationTargetId || undefined,
          destination: destination.trim(), destinationDetails, budget, currency, startDate, endDate, partyType, travelers,
          interests: interests.split(',').map((item) => item.trim()).filter(Boolean), itinerary: result.itinerary, weather: result.weather,
        });
        const saved = response.result as SavedTrip | undefined;
        if (saved?.id) setEditingTripId(saved.id);
        setRegenerationTargetId(null);
        await refresh();
        const providerMessage = result.itinerary.source === 'mock' ? 'Demo fallback plan ready; recommendations and prices are estimates.' : `Your ${result.itinerary.days.length}-day ${result.itinerary.source === 'gemini' ? 'Gemini' : 'OpenAI'} plan is ready.`;
        setMessage(`${providerMessage} It was saved automatically${regenerationTargetId ? ' as a new version of the selected trip' : ' to Saved trips'}.`);
      } catch (saveError) {
        setManualDirty(true);
        await refresh().catch(() => undefined);
        setMessage(`The itinerary was generated, but automatic saving failed: ${saveError instanceof Error ? saveError.message : 'unknown save error'}. A browser draft will be kept until you save it.`);
      }
    } catch (error) { setGenerationFailed(true); setMessage(error instanceof Error ? error.message : 'Generation failed. Your current plan is unchanged; please retry.'); }
    finally { setBusy(false); setGenerationBusy(false); }
  }

  async function refreshConditions() {
    setConditionsBusy(true); setMessage('');
    try {
      const refreshed = await fetchWeather(destination.trim(), startDate, endDate, { latitude: selectedDestination?.latitude, longitude: selectedDestination?.longitude });
      setWeather(refreshed);
      setItinerary((current) => current ? applyConditionSnapshot(current, refreshed) : current);
      setMessage(`Conditions refreshed at ${new Date(refreshed.fetchedAt).toLocaleString()}. Your itinerary activities and manual edits were not changed.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Conditions could not be refreshed. Your itinerary is unchanged.');
    } finally { setConditionsBusy(false); }
  }

  async function refreshDayPhotos(day: ItineraryResponse['days'][number], announce = false) {
    setPhotoRefreshDay(day.day);
    try {
      const refreshedDay = await refreshItineraryDayImages(itinerary?.destination || destination.trim(), day);
      setItinerary((current) => current ? { ...current, days: current.days.map((item) => item.day === refreshedDay.day ? refreshedDay : item) } : current);
      setSelectedDay((current) => current?.day === refreshedDay.day ? refreshedDay : current);
      if (announce) setMessage(`Activity photos for Day ${day.day} refreshed from Wikimedia Commons.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Activity photos could not be refreshed. Existing images are still available.');
    } finally {
      setPhotoRefreshDay((current) => current === day.day ? null : current);
    }
  }

  function openDayDetails(day: ItineraryResponse['days'][number]) {
    setSelectedDay(day);
    void refreshDayPhotos(day);
  }

  async function action(body: Record<string, unknown>, success: string): Promise<boolean> {
    const sectionVersion = sectionVersionRef.current;
    setBusy(true); setMessage('');
    try { await api(body); await refresh(); if (sectionVersion === sectionVersionRef.current) setMessage(success); return true; }
    catch (error) { if (sectionVersion === sectionVersionRef.current) setMessage(error instanceof Error ? error.message : 'Action failed.'); return false; }
    finally { setBusy(false); }
  }

  async function saveCurrentTrip() {
    if (!itinerary) return;
    setBusy(true); setMessage('');
    try {
      const destinationDetails = selectedDestination && Number.isFinite(selectedDestination.latitude) && Number.isFinite(selectedDestination.longitude) && selectedDestination.countryCode ? { city: selectedDestination.name, region: selectedDestination.region, country: selectedDestination.country, countryCode: selectedDestination.countryCode, latitude: selectedDestination.latitude, longitude: selectedDestination.longitude } : undefined;
      const response = await api({ action: editingTripId ? 'update-trip' : 'save-trip', id: editingTripId || undefined, destination, destinationDetails, budget, currency, startDate, endDate, partyType, travelers, interests: interests.split(',').map((item) => item.trim()).filter(Boolean), itinerary, weather });
      const saved = response.result as SavedTrip | undefined;
      if (saved?.id) setEditingTripId(saved.id);
      setRegenerationTargetId(null);
      if (data?.user.id) window.localStorage.removeItem(`travelmate-itinerary-draft:${data.user.id}`);
      await refresh();
      setMessage(editingTripId ? 'Saved trip updated.' : 'Trip saved. Open Trips to view, edit, duplicate, or delete it.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Trip could not be saved.'); }
    finally { setBusy(false); }
  }

  async function saveManualChanges() {
    if (!itinerary) return;
    setBusy(true); setMessage('');
    try {
      const response = editingTripId
        ? await api({ action: 'update-trip-itinerary', id: editingTripId, itinerary })
        : await api({ action: 'save-trip', destination, destinationDetails: selectedDestination && Number.isFinite(selectedDestination.latitude) && Number.isFinite(selectedDestination.longitude) && selectedDestination.countryCode ? { city: selectedDestination.name, region: selectedDestination.region, country: selectedDestination.country, countryCode: selectedDestination.countryCode, latitude: selectedDestination.latitude, longitude: selectedDestination.longitude } : undefined, budget, currency, startDate, endDate, partyType, travelers, interests: interests.split(',').map((item) => item.trim()).filter(Boolean), itinerary, weather });
      const saved = response.result as SavedTrip | undefined;
      const canonical = saved ? savedItinerary(saved.itinerary) : null;
      if (saved?.id) setEditingTripId(saved.id);
      if (canonical) setItinerary(canonical);
      setSelectedDay(null); setManualDirty(false);
      setRegenerationTargetId(null);
      if (data?.user.id) window.localStorage.removeItem(`travelmate-itinerary-draft:${data.user.id}`);
      await refresh();
      setMessage(editingTripId ? 'Manual itinerary changes saved.' : 'Edited itinerary saved to your trips.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Manual changes could not be saved.'); }
    finally { setBusy(false); }
  }

  function submitActivity(form: HTMLFormElement) {
    if (!itinerary || !activityEditor) return;
    const fields = new FormData(form);
    const draft = {
      time: String(fields.get('time') || ''),
      title: String(fields.get('title') || ''),
      description: String(fields.get('description') || ''),
      estimatedCost: Number(fields.get('estimatedCost')),
      category: String(fields.get('category') || 'activity') as DayActivity['category'],
    };
    try {
      const next = upsertActivity(itinerary, activityEditor.dayIndex, activityEditor.activityIndex, draft);
      setItinerary(next); setManualDirty(true); setActivityEditor(null);
      setMessage(activityEditor.activityIndex === null ? 'Activity added. Save your manual changes when ready.' : 'Activity updated. Save your manual changes when ready.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Activity could not be updated.'); }
  }

  function confirmRemoveActivity(dayIndex: number, activityIndex: number) {
    if (!itinerary) return;
    const activity = itinerary.days[dayIndex]?.activities[activityIndex];
    if (!activity || !window.confirm(`Remove “${activity.title}” from Day ${dayIndex + 1}?`)) return;
    try {
      setItinerary(removeActivity(itinerary, dayIndex, activityIndex)); setManualDirty(true); setSelectedDay(null);
      setMessage('Activity removed. Save your manual changes when ready.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Activity could not be removed.'); }
  }

  function reorderActivity(dayIndex: number, activityIndex: number, direction: -1 | 1) {
    if (!itinerary) return;
    setItinerary(moveActivity(itinerary, dayIndex, activityIndex, direction)); setManualDirty(true); setSelectedDay(null);
    setMessage('Activity order updated. Save your manual changes when ready.');
  }

  function addComparedActivity(name: string) {
    const current = preferredActivities.split(',').map((item) => item.trim()).filter(Boolean);
    if (!current.some((item) => item.toLowerCase() === name.toLowerCase())) setPreferredActivities([...current, name].join(', '));
    setTab('planner'); setMessage(`${name} added to your activity preferences. Generate or update the itinerary to use it.`);
  }

  function startNewTrip() {
    if (manualDirty && !window.confirm('Start a new trip? Your current unsaved edits remain available in browser draft recovery.')) return;
    const today = localDateInputValue();
    setEditingTripId(null); setRegenerationTargetId(null); setItinerary(null); setWeather(null); setManualDirty(false);
    setSelectedStayId(''); setSelectedLiveStayId(''); setTravelOptions(null); setSelectedFlightId(''); setSelectedActivityIds([]); setComparisonMessage(''); setGenerationFailed(false);
    setFlightOrigin(''); setPreTripCosts(EMPTY_PRE_TRIP_COSTS); setIncludePreTripCosts(false);
    changeDestinationInput(''); setStartDate(today); setEndDate(addCalendarDays(today, 6)); setPartyType('solo'); setTravelers(1);
    setTab('planner'); setMessage('');
  }

  function loadTrip(trip: SavedTrip, keepPlan = true) {
    const plan = savedItinerary(trip.itinerary);
    if (!plan) { setMessage('This saved trip does not contain a usable itinerary.'); return; }
    const draftDates = keepPlan ? { startDate: trip.startDate, endDate: trip.endDate, movedForward: false } : regenerationDraftDates(trip.startDate, trip.endDate);
    setBudget(trip.budget); setStartDate(draftDates.startDate); setEndDate(draftDates.endDate);
    setTravelers(trip.travelers); setPartyType(trip.partyType);
    setInterests(trip.interests.join(', ')); setEditingTripId(trip.id);
    setRegenerationTargetId(keepPlan ? null : trip.id);
    restoreDestination(trip, plan.preferences?.transportation || '');
    const restoredPreTrip = plan.selectedTravelCosts?.preTrip;
    setFlightOrigin(restoredPreTrip?.startingLocation || '');
    setPreTripCosts(restoredPreTrip ? { airportTransfers: restoredPreTrip.airportTransferOutbound + restoredPreTrip.airportTransferReturn, passport: restoredPreTrip.passport, visaOrAuthorization: restoredPreTrip.visaOrAuthorization, departureTaxes: restoredPreTrip.departureTaxes, insurance: restoredPreTrip.insurance, other: restoredPreTrip.other } : EMPTY_PRE_TRIP_COSTS);
    setIncludePreTripCosts(Boolean(restoredPreTrip?.total));
    if (plan.preferences) { setTravelStyle(plan.preferences.travelStyle); setAccommodationPreference(plan.preferences.accommodation); setPreferredActivities(plan.preferences.activities.join(', ')); }
    setItinerary(keepPlan ? plan : null); setWeather(keepPlan && trip.weather && typeof trip.weather === 'object' ? trip.weather as WeatherData : null); setManualDirty(false); setActivityEditor(null); setGenerationFailed(false);
    generationRequestRef.current = null;
    setTab('planner'); setMessage(keepPlan ? 'Saved trip loaded. Change the form, regenerate if needed, then update it.' : draftDates.movedForward ? `The saved dates have passed. Draft dates moved to ${draftDates.startDate}–${draftDates.endDate} for regeneration; your saved plan is unchanged until the new plan succeeds.` : 'Trip details loaded. Generate a fresh itinerary, then update the saved trip.');
  }

  async function saveProfile(form: HTMLFormElement) {
    const fields = new FormData(form);
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: fields.get('name'), phone: fields.get('phone'), bio: fields.get('bio') }),
      });
      await handleResponse<ProfileResponse>(response);
      await refresh();
      setMessage('Profile updated.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Profile update failed.'); }
    finally { setBusy(false); }
  }

  async function logout() { await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) }); router.replace('/'); }
  if (!data) return <DashboardLoadState label="your TravelMate workspace" variant={tab === 'planner' ? 'planner' : 'traveler'} error={loadError} onRetry={() => { setLoadError(''); void loadInitial(); }} />;
  const tripDays = Math.floor((new Date(`${endDate}T00:00:00.000Z`).getTime() - new Date(`${startDate}T00:00:00.000Z`).getTime()) / 86_400_000) + 1;
  const maximumEndDate = addCalendarDays(startDate, 13);
  const split = itinerary?.budgetSummary as (ItineraryResponse['budgetSummary'] & { reserve?: number; dailyAverage?: number }) | undefined;
  const optimization = itinerary?.budgetOptimization;
  const localMunicipality = CEBU_LOCATIONS.find((location) => destination.toLowerCase().startsWith(location.toLowerCase()));
  const stayOptions = currency === 'PHP' ? data.listings.filter((listing) => listing.category === 'stay' && listing.status === 'approved' && listing.municipality === localMunicipality) : [];
  const accommodationRecommendation = recommendAccommodation(liveAccommodations, accommodationPreference, budget, currency);
  const selectedLiveAccommodation = liveAccommodations.find((stay) => stay.id === selectedLiveStayId)
    || (!selectedStayId ? accommodationRecommendation?.accommodation : undefined);
  const preTripTotal = preTripCosts.airportTransfers + preTripCosts.passport + preTripCosts.visaOrAuthorization + preTripCosts.departureTaxes + preTripCosts.insurance + preTripCosts.other;
  const updatePreTripAmount = (field: keyof PreTripCostDraft, value: string) => {
    const amount = value === '' ? 0 : Number(value);
    setPreTripCosts((current) => ({ ...current, [field]: Number.isFinite(amount) && amount >= 0 ? amount : 0 }));
  };
  const today = localDateInputValue();
  const upcomingTrip = [...data.trips].filter((trip) => trip.endDate >= today).sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  const userInitials = data.user.name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'TM';
  const currentTabCopy = tab === 'planner' && itinerary
    ? { title: 'Review and shape your trip', description: 'Inspect the generated days, edit activities, check conditions, and save only when the plan is ready.' }
    : tab === 'planner' && editingTripId
      ? { title: 'Regenerate a saved trip', description: 'The saved details are loaded. Adjust them, generate a fresh itinerary, then choose Update saved trip.' }
      : TAB_COPY[tab];
  const editorDay = activityEditor && itinerary ? itinerary.days[activityEditor.dayIndex] : undefined;
  const editorActivity = activityEditor?.activityIndex !== null && activityEditor?.activityIndex !== undefined ? editorDay?.activities[activityEditor.activityIndex] : undefined;
  const changePartyType = (nextPartyType: PartyType) => {
    setPartyType(nextPartyType);
    setTravelers(nextPartyType === 'solo' ? 1 : nextPartyType === 'couple' ? 2 : nextPartyType === 'family' ? 4 : 3);
    setSelectedLiveStayId(''); setTravelOptions(null); setComparisonMessage('');
    setItinerary(null);
    setMessage('');
  };
  const changeCurrency = (nextCurrency: CurrencyCode) => {
    setManualCurrency(nextCurrency);
    setSelectedStayId('');
    if (selectedLiveAccommodation?.currency !== nextCurrency) setSelectedLiveStayId('');
    setItinerary(null);
    setManualDirty(false);
    setMessage(`Budget currency changed to ${nextCurrency}. Generate a new plan so every estimate uses one currency.`);
  };
  const changeDestination = (location: string) => {
    changeDestinationInput(location);
    setSelectedStayId('');
    setSelectedLiveStayId('');
    setTravelOptions(null);
    setComparisonMessage('');
    setItinerary(null);
    setWeather(null);
    setMessage('');
  };
  const confirmDestination = (location: (typeof locationSuggestions)[number]) => {
    selectDestination(location);
    setSelectedStayId('');
    setSelectedLiveStayId('');
    setTravelOptions(null);
    setComparisonMessage('');
    setItinerary(null);
    setWeather(null);
    setMessage('');
  };
  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setCurrentLocationMessage('Location access is not available in this browser.');
      return;
    }
    setCurrentLocationBusy(true);
    setCurrentLocationMessage('Requesting your location...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const controller = new AbortController();
        void fetchCurrentLocation(position.coords.latitude, position.coords.longitude, controller.signal)
          .then((location) => {
            setFlightOrigin(location.label);
            setCurrentLocationMessage(`Suggested from your current area: ${location.label}`);
            setTravelOptions(null);
          })
          .catch((error: unknown) => setCurrentLocationMessage(error instanceof Error ? error.message : 'Current location could not be identified.'))
          .finally(() => setCurrentLocationBusy(false));
      },
      (error) => {
        setCurrentLocationBusy(false);
        setCurrentLocationMessage(error.code === error.PERMISSION_DENIED ? 'Location permission was not granted. Enter your starting location manually.' : 'Current location is unavailable. Enter your starting location manually.');
      },
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 10_000 },
    );
  };

  return (
    <div ref={pageRef} className="traveler-dashboard min-h-screen w-full max-w-full overflow-x-clip bg-[#0b1d1a] pt-20 text-slate-100">
      <a href="#traveler-main-content" className="sr-only z-[100] bg-[#f1ead8] px-4 py-2 font-bold text-[#14231f] focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to trip workspace</a>
      <header className="fixed inset-x-0 top-0 z-40 px-4 pt-4 sm:px-6">
        <div className="mx-auto flex h-16 w-full max-w-[1380px] items-center justify-between border border-white/15 bg-[#102824]/88 px-4 text-white shadow-[0_18px_50px_rgba(8,24,22,.22)] backdrop-blur-xl sm:px-6">
          <Link href="/" className="group flex shrink-0 items-center gap-3 font-semibold" aria-label="TravelMate home">
            <span className="grid size-9 place-items-center bg-[#ffcf70] text-[#102824] transition-transform duration-500 group-hover:-rotate-6"><Compass size={20} strokeWidth={2.2}/></span>
            <span className="text-lg">TravelMate</span>
          </Link>
          <button type="button" onClick={() => setProfileMenuOpen(true)} aria-label={`Open profile menu for ${data.user.name}`} aria-haspopup="dialog" aria-expanded={profileMenuOpen} aria-controls="traveler-profile-menu" className="flex min-w-0 items-center gap-2 border border-white/15 bg-white/[0.04] py-1.5 pl-1.5 pr-3 text-left transition-colors hover:border-[#ffcf70]/50 hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffcf70] sm:gap-3">
            <span className="grid size-9 shrink-0 place-items-center bg-[#ffcf70] text-xs font-black text-[#102824]">{userInitials}</span>
            <span className="min-w-0"><strong className="block max-w-40 truncate text-xs font-bold text-white sm:text-sm">{data.user.name}</strong><span className="hidden max-w-48 truncate text-[10px] text-white/60 sm:block">{data.user.email}</span></span>
            <UserRound size={15} className="shrink-0 text-[#ffcf70]" />
          </button>
        </div>
      </header>

      {profileMenuOpen && <div className="fixed inset-0 z-[80]">
        <button type="button" aria-label="Close profile menu" onClick={() => setProfileMenuOpen(false)} className="traveler-profile-backdrop absolute inset-0 bg-[#061714]/65 backdrop-blur-sm" />
        <aside ref={profileMenuRef} id="traveler-profile-menu" role="dialog" aria-modal="true" aria-labelledby="traveler-profile-menu-title" tabIndex={-1} className="traveler-profile-drawer absolute inset-y-0 right-0 flex w-full max-w-sm flex-col border-l border-white/15 bg-[#102824] text-white shadow-[-24px_0_70px_rgba(0,0,0,.35)]">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
            <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#ffcf70]">TravelMate</p><h2 id="traveler-profile-menu-title" className="mt-1 text-lg font-semibold">Your account</h2></div>
            <button ref={profileMenuCloseRef} type="button" aria-label="Close profile menu" onClick={() => setProfileMenuOpen(false)} className="grid size-10 place-items-center border border-white/20 text-white/75 transition-colors hover:bg-white/10 hover:text-white"><X size={18}/></button>
          </div>
          <div className="p-5 sm:p-6">
            <div className="flex items-center gap-3 border border-white/15 bg-white/[0.04] p-3">
              <span className="grid size-12 shrink-0 place-items-center bg-[#ffcf70] text-sm font-black text-[#102824]">{userInitials}</span>
              <span className="min-w-0"><strong className="block truncate text-sm text-white">{data.user.name}</strong><span className="mt-1 block truncate text-xs text-white/55">{data.user.email}</span></span>
            </div>
            <div className="mt-4 flex items-center justify-between border-b border-white/10 pb-4 text-xs"><span className="text-white/55">Email status</span><span className={`border px-2 py-1 font-bold ${data.user.emailVerified ? 'border-emerald-300/35 bg-emerald-300/10 text-emerald-200' : 'border-[#ffcf70]/35 bg-[#ffcf70]/10 text-[#ffcf70]'}`}>{data.user.emailVerified ? 'Verified' : 'Email not verified'}</span></div>
          </div>
          <div className="mt-auto border-t border-white/10 p-5 sm:p-6">
            <button type="button" onClick={() => { setProfileMenuOpen(false); setTab('profile'); }} className="flex min-h-12 w-full items-center gap-3 border border-white/15 px-4 text-sm font-semibold text-white/85 transition-colors hover:border-[#ffcf70]/50 hover:bg-white/[0.06]"><UserRound size={17} className="text-[#ffcf70]"/>Account settings<ArrowRight size={16} className="ml-auto"/></button>
            <button type="button" onClick={() => void logout()} className="mt-2 flex min-h-12 w-full items-center gap-3 border border-white/15 px-4 text-sm font-semibold text-white/85 transition-colors hover:border-[#ffcf70]/50 hover:bg-white/[0.06]"><LogOut size={17} className="text-[#ffcf70]"/>Sign out</button>
          </div>
        </aside>
      </div>}

      {tab !== 'overview' && <div className="border-b border-white/10 bg-[#102622] px-4 py-3 sm:px-6"><div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-1 text-xs text-white/52"><strong className="text-white/78">Current trip context</strong><span>{selectedDestination ? destination : 'Choose and confirm a destination'}</span><span>{startDate} to {endDate}</span><span>{currencyResolved && Number.isFinite(budget) ? formatMoney(budget, currency) : 'Currency auto-detected after destination'}{currencyResolved&&<ReferenceAmount amount={budget} currency={currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes}/>}</span>{itinerary && <span className="text-emerald-200">Generated plan available</span>}</div></div>}

      <div className="mx-auto grid w-full max-w-[1600px] grid-cols-[minmax(0,1fr)] gap-0 px-4 lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-10 lg:px-6 xl:gap-14">
        <aside className="min-w-0 max-w-[calc(100vw-2rem)] py-4 lg:sticky lg:top-24 lg:max-w-none lg:self-start lg:py-8">
          <div data-traveler-rail className="lg:flex lg:h-[calc(100vh-144px)] lg:w-[248px] lg:flex-col">
            <nav aria-label="Traveler workspace" className="traveler-mobile-nav flex max-w-full snap-x gap-px overflow-x-auto border border-white/10 bg-white/10 p-px lg:flex-col lg:overflow-visible">
              {([['overview','Home',Home],['planner','Plan a trip',MapPin],['bookings','Saved trips',CalendarDays],['notifications','Notifications',Bell]] as const).map(([id,label,Icon]) => <button key={id} aria-current={tab===id?'page':undefined} onClick={() => id === 'planner' ? startNewTrip() : setTab(id)} className={`group relative flex shrink-0 snap-start items-center gap-3 px-4 py-3.5 text-sm font-semibold transition-colors lg:w-full ${tab===id?'bg-[#f1ead8] text-[#14231f]':'bg-[#0b1d1a] text-white/55 hover:bg-[#16302b] hover:text-white'}`}><span className={`absolute inset-y-0 left-0 w-0.5 ${tab===id?'bg-amber-400':'bg-transparent'}`}/><Icon size={17}/>{label}{id === 'notifications' && data.notifications.filter((item) => !item.readAt).length > 0 && <span className="ml-auto bg-amber-300 px-1.5 text-[10px] font-black text-[#14231f]">{data.notifications.filter((item) => !item.readAt).length}</span>}</button>)}
              <div className="hidden px-4 pb-2 pt-6 text-[10px] font-bold uppercase tracking-[0.16em] text-white/28 lg:block">Use with a plan</div>
              {([['budget','Budget review',WalletCards],['compare','Travel options',Plane]] as const).map(([id,label,Icon]) => <button key={id} aria-current={tab===id?'page':undefined} onClick={() => setTab(id)} className={`group relative flex shrink-0 snap-start items-center gap-3 px-4 py-3.5 text-sm font-semibold transition-colors lg:w-full ${tab===id?'bg-[#f1ead8] text-[#14231f]':'bg-[#0b1d1a] text-white/55 hover:bg-[#16302b] hover:text-white'}`}><span className={`absolute inset-y-0 left-0 w-0.5 ${tab===id?'bg-amber-400':'bg-transparent'}`}/><Icon size={17}/>{label}</button>)}
            </nav>
            <div className="mt-8 hidden border-t border-white/10 pt-5 lg:block"><p className="max-w-[23ch] text-xs leading-5 text-white/38">Start with Plan a trip. Budget and travel options become useful after TravelMate creates your itinerary.</p></div>
          </div>
        </aside>

        <main id="traveler-main-content" tabIndex={-1} className="min-w-0 w-full max-w-[calc(100vw-2rem)] overflow-x-hidden pb-20 pt-5 outline-none lg:max-w-none lg:pt-10">
          <div className="mb-7 flex flex-col items-start gap-3 border-b border-white/10 pb-6 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div className="min-w-0 max-w-4xl"><h1 ref={workspaceHeadingRef} tabIndex={-1} className="break-words text-[clamp(2rem,4vw,3.75rem)] font-black leading-[0.96] tracking-[-0.05em] outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-4 focus-visible:ring-offset-[#0b1d1a]">{currentTabCopy.title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/52">{currentTabCopy.description}</p></div>
            <span className={`w-fit shrink-0 border px-3 py-2 text-[11px] font-bold tracking-wide ${data.user.emailVerified?'border-emerald-400/40 bg-emerald-400/10 text-emerald-200':'border-amber-300/40 bg-amber-300/10 text-amber-200'}`}>{data.user.emailVerified?'Email verified':'Email not verified'}</span>
          </div>
          {message && <div role="status" aria-live="polite" className="mb-6 border-l-2 border-amber-300 bg-white/[0.055] px-4 py-3 text-sm text-white/80">{message}</div>}

          {tab === 'overview' && <TravelerJourneyOverview
            userName={data.user.name}
                        savedTripCount={data.trips.length}
            currentPlan={itinerary ? { destination: itinerary.destination, days: itinerary.days.length } : null}
            upcomingTrip={upcomingTrip ? { destination: upcomingTrip.destination, startDate: upcomingTrip.startDate, endDate: upcomingTrip.endDate, travelers: upcomingTrip.travelers, budget: upcomingTrip.budget, currency: upcomingTrip.currency } : null}
            referenceCurrency={referenceCurrency}
            exchangeQuotes={exchangeQuotes}
            onStartPlanning={startNewTrip}
            onOpenCurrentPlan={() => setTab('planner')}
            onOpenUpcomingTrip={() => { if (upcomingTrip) loadTrip(upcomingTrip, true); }}
            onOpenSavedTrips={() => setTab('bookings')}
            onOpenBudget={() => setTab('budget')}
            onOpenOptions={() => setTab('compare')}
          />}

          {tab === 'planner' && <>
            <div className="space-y-5">
              <section className="relative min-h-[300px] overflow-hidden border border-white/10 bg-[#efe8d6] text-[#14231f]">
                <div className="absolute inset-y-0 right-0 w-[48%] overflow-hidden"><Image data-dashboard-image src="/mountain-hero-bg.png" alt="Mountain destination at sunrise" fill priority loading="eager" sizes="(max-width: 1024px) 100vw, 560px" className="object-cover object-center" /><div className="absolute inset-0 bg-gradient-to-r from-[#efe8d6] via-[#efe8d6]/30 to-transparent"/></div>
                <div className="relative flex min-h-[300px] w-full max-w-4xl flex-col justify-end p-6 sm:p-10">
                  <p className="text-sm font-semibold text-[#4a655e]">How this page works</p>
                  <h2 className="mt-3 max-w-3xl text-4xl font-black leading-[0.95] tracking-[-0.055em] sm:text-6xl">Four details are enough to begin.</h2>
                  <p className="mt-5 max-w-2xl text-sm leading-6 text-[#49635c]">Choose a destination, dates, group size, and total budget. Add optional preferences if you want more personalization, then generate a plan to review before saving.</p>
                </div>
              </section>

              <section aria-label="Trip brief" className="relative overflow-hidden border border-amber-200/20 bg-[#ffcf70] p-4 text-[#14231f] shadow-[0_18px_55px_rgba(0,0,0,.14)] sm:p-5">
                <div className="absolute right-0 top-0 h-full w-1/3 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,.42),transparent_52%)]" aria-hidden="true" />
                <div className="relative flex min-w-0 flex-col gap-4">
                  <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#49635c]">Your trip brief</p><h2 className="mt-1 text-xl font-black tracking-[-0.035em]">Shape the outline, then let TravelMate fill the days.</h2></div>
                  <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-2 text-xs">
                    <div className="flex min-w-0 items-start gap-3 border border-[#14231f]/15 bg-white/25 px-3 py-3"><MapPin size={16} className="mt-0.5 shrink-0 text-[#b24d32]" /><span className="min-w-0 flex-1"><span className="block text-[10px] font-bold uppercase tracking-wider text-[#49635c]">Going to</span><strong className="mt-1 block leading-5 [overflow-wrap:anywhere]">{selectedDestination ? destination : 'Choose a destination'}</strong></span></div>
                    <div className="flex min-w-0 items-start gap-3 border border-[#14231f]/15 bg-white/25 px-3 py-3"><CalendarDays size={16} className="mt-0.5 shrink-0 text-[#b24d32]" /><span className="min-w-0 flex-1"><span className="block text-[10px] font-bold uppercase tracking-wider text-[#49635c]">When</span><strong className="mt-1 flex flex-wrap gap-x-1 leading-5"><time dateTime={startDate} className="whitespace-nowrap">{startDate}</time><span>→</span><time dateTime={endDate} className="whitespace-nowrap">{endDate}</time></strong></span></div>
                    <div className="flex min-w-0 items-start gap-3 border border-[#14231f]/15 bg-white/25 px-3 py-3"><WalletCards size={16} className="mt-0.5 shrink-0 text-[#b24d32]" /><span className="min-w-0 flex-1"><span className="block text-[10px] font-bold uppercase tracking-wider text-[#49635c]">Budget</span><strong className="mt-1 block leading-5 [overflow-wrap:anywhere]">{currencyResolved && Number.isFinite(budget) ? formatMoney(budget, currency) : 'Set after destination'}</strong></span></div>
                  </div>
                </div>
              </section>

              <section className="relative grid grid-flow-dense gap-px overflow-hidden border border-emerald-100/10 bg-emerald-100/10 xl:grid-cols-12 [&_input]:min-h-12 [&_select]:min-h-12 [&_input]:border-white/15 [&_select]:border-white/15 [&_label]:text-white/75">
                <article className="bg-[#14302a] p-5 sm:p-7 xl:col-span-7">
                  <div className="mb-7 flex items-start gap-4 border-b border-white/12 pb-5"><span className="grid h-11 w-11 shrink-0 place-items-center border border-cyan-300/35 bg-cyan-300/5 text-cyan-200"><MapPin size={19}/></span><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-cyan-200/70">01 · Start with the essentials</p><h2 className="mt-1 text-xl font-black tracking-[-0.03em]">Required trip details</h2><p className="mt-1 text-xs text-white/50">These fields give TravelMate enough information to build a plan.</p></div></div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="relative sm:col-span-2 text-xs font-medium text-slate-300"><label htmlFor="destination-search">Destination</label><input id="destination-search" required minLength={2} role="combobox" aria-autocomplete="list" aria-expanded={locationSuggestions.length>0} aria-controls="destination-suggestions" aria-activedescendant={activeSuggestionIndex>=0?`destination-option-${activeSuggestionIndex}`:undefined} aria-describedby="destination-status" value={destination} onChange={e=>{changeDestination(e.target.value);setActiveSuggestionIndex(-1);}} onKeyDown={handleDestinationKeyDown} placeholder="Search city, province, or country" autoComplete="off" className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-2 text-white transition placeholder:text-slate-600 hover:border-slate-600 focus:border-cyan-400"/>{locationSuggestions.length>0&&<ul id="destination-suggestions" role="listbox" className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-1 shadow-2xl">{locationSuggestions.map((location,index)=><li id={`destination-option-${index}`} key={location.id} role="option" aria-selected={activeSuggestionIndex===index||selectedDestination?.id===location.id}><button type="button" onMouseEnter={()=>setActiveSuggestionIndex(index)} onClick={()=>{confirmDestination(location);setActiveSuggestionIndex(-1);}} className={`w-full rounded-lg px-3 py-2 text-left hover:bg-slate-800 focus:bg-slate-800 ${activeSuggestionIndex===index?'bg-slate-800':''}`}><strong className="block text-sm text-white">{location.name}</strong><span className="text-[11px] text-slate-400">{location.contextLabel}</span></button></li>)}</ul>}<p id="destination-status" aria-live="polite" className={`mt-1 text-[11px] ${selectedDestination?'text-emerald-300':'text-slate-500'}`}>{locationsBusy?'Searching destinations...':selectedDestination?`Confirmed: ${selectedDestination.label}`:locationMessage||'Choose a suggestion to confirm the destination.'}</p>{!selectedDestination&&!locationsBusy&&destination.trim().length>=2&&locationMessage&&<button type="button" onClick={()=>confirmManualDestination(destination)} className="mt-2 border border-amber-300/40 px-3 py-2 text-xs font-bold text-amber-200">Use “{destination.trim()}” manually</button>}</div>
                    <label className="text-xs font-medium text-slate-300">{partyBudgetLabel(partyType, travelers)}<input type="number" min="0" step={ZERO_DECIMAL_CURRENCIES.includes(currency)?'1':'0.01'} value={budget} onChange={e=>setBudget(Number(e.target.value))} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-2 text-white transition hover:border-slate-600 focus:border-amber-400" /><span className="mt-1.5 block text-[11px] font-normal text-amber-200">{budget > 0 ? partyBudgetExplanation(partyType, travelers) : 'Enter your total trip budget to continue.'}</span><ReferenceAmount amount={budget} currency={currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes} className="mt-1 block text-[11px] font-normal text-cyan-200"/></label>
                    <div className="text-xs font-medium text-slate-300"><div className="grid grid-cols-2 gap-2"><label>Destination currency<select value={selectedDestination&&currencyResolved?currency:''} disabled={!selectedDestination||contextBusy||!currencyNeedsFallback} onChange={e=>changeCurrency(e.target.value as CurrencyCode)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-white transition hover:border-slate-600 focus:border-amber-400 disabled:opacity-60"><option value="">{contextBusy?'Detecting...':selectedDestination?'Select':'Auto'}</option>{SUPPORTED_CURRENCIES.map(code=><option key={code} value={code}>{code}</option>)}</select></label><label>Show equivalents in<select value={referenceCurrency} onChange={e=>setReferenceCurrency(e.target.value as CurrencyCode)} className="mt-1.5 w-full rounded-xl border border-cyan-700/70 bg-slate-950/80 px-3 py-2 text-white transition hover:border-cyan-500 focus:border-cyan-400">{SUPPORTED_CURRENCIES.map(code=><option key={code} value={code}>{code} · {CURRENCY_NAMES[code]}</option>)}</select></label></div><span className="mt-1.5 block text-[10px] text-slate-500">{currencyResolved?`${currency} (${CURRENCY_NAMES[currency]}) detected for the destination.`:currencyNeedsFallback?'Automatic detection unavailable; choose a destination currency.':'Select a destination first.'}</span>{currencyResolved&&currency!==referenceCurrency&&<span className="mt-1 block text-[10px] text-cyan-200/70">{exchangeBusy?<span role="status" aria-label="Loading reference rate..."><Skeleton className="inline-block h-3 w-36 align-middle" /></span>:exchangeQuotes[currency]?`1 ${currency} ≈ ${formatMoney(exchangeQuotes[currency]!.rate,referenceCurrency)} · Frankfurter reference dated ${exchangeQuotes[currency]!.asOf}`:exchangeMessage||'Reference conversion unavailable.'}</span>}</div>
                    <label className="text-xs font-medium text-slate-300">Start date<input required type="date" min={localDateInputValue()} value={startDate} onChange={e=>{const next=e.target.value;setStartDate(next);if(endDate<next||endDate>addCalendarDays(next,13))setEndDate(addCalendarDays(next,6));setSelectedLiveStayId('');setTravelOptions(null);setComparisonMessage('');setItinerary(null);setWeather(null);}} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-white transition hover:border-slate-600 focus:border-cyan-400" /></label>
                    <label className="text-xs font-medium text-slate-300">End date<input required type="date" min={startDate} max={maximumEndDate} value={endDate} onChange={e=>{setEndDate(e.target.value);setSelectedLiveStayId('');setTravelOptions(null);setComparisonMessage('');setItinerary(null);setWeather(null);}} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-white transition hover:border-slate-600 focus:border-cyan-400" /><span className={`mt-1.5 block text-[10px] ${tripDays>=1&&tripDays<=14?'text-emerald-300':'text-amber-300'}`}>{tripDays>=1&&tripDays<=14?`${tripDays} travel day${tripDays===1?'':'s'} selected`:'Choose 1–14 days'}</span></label>
                    <label className="text-xs font-medium text-slate-300">Traveling as<select value={partyType} onChange={e=>changePartyType(e.target.value as PartyType)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-white transition hover:border-slate-600 focus:border-cyan-400">{Object.entries(PARTY_TYPE_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
                    <label className="text-xs font-medium text-slate-300">Travelers<input type="number" min={partyType==='solo'?1:2} max="20" disabled={partyType==='solo'||partyType==='couple'} value={travelers} onChange={e=>{setTravelers(Number(e.target.value));setSelectedLiveStayId('');setTravelOptions(null);setComparisonMessage('');}} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-2 text-white transition hover:border-slate-600 focus:border-cyan-400 disabled:opacity-50" /></label>
                  </div>
                </article>

                <article className="bg-[#19362f] p-5 sm:p-7 xl:col-span-5">
                  <div className="mb-7 flex items-start gap-4 border-b border-white/12 pb-5"><span className="grid h-11 w-11 shrink-0 place-items-center border border-amber-300/35 bg-amber-300/5 text-amber-200"><Compass size={19}/></span><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-amber-200/70">02 · Make it feel like yours</p><h2 className="mt-1 text-xl font-black tracking-[-0.03em]">Optional preferences</h2><p className="mt-1 text-xs text-white/50">Skip these if you are unsure. You can revise them later.</p></div></div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2 text-xs font-medium text-slate-300"><div className="flex items-center justify-between gap-2"><label htmlFor="accommodation">Accommodation</label><button type="button" disabled={!selectedDestination||!currencyResolved||staysBusy||tripDays<1||tripDays>14} onClick={retryAccommodations} className="font-bold text-cyan-300 hover:text-cyan-200 disabled:opacity-50">{staysBusy?'Finding stays...':'Refresh stays'}</button></div><select id="accommodation" disabled={!selectedDestination||!currencyResolved||staysBusy} value={selectedLiveStayId?`live:${selectedLiveStayId}`:selectedStayId?`local:${selectedStayId}`:''} onChange={e=>{const [source,...idParts]=e.target.value.split(':');const id=idParts.join(':');setSelectedStayId(source==='local'?id:'');setSelectedLiveStayId(source==='live'?id:'');}} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-white transition hover:border-slate-600 focus:border-violet-400 disabled:opacity-60"><option value="">{!selectedDestination?'Select a destination first':staysBusy?'Finding stays...':accommodationRecommendation?`Automatic recommendation: ${accommodationRecommendation.accommodation.name}`:stayOptions.length||liveAccommodations.some(stay=>stay.currency===currency)?'No provider recommendation available':'No accommodation data available'}</option>{stayOptions.length>0&&<optgroup label="TravelMate stays (PHP)">{stayOptions.map(stay=><option key={stay.id} value={`local:${stay.id}`}>{stay.name} - {formatMoney(stay.price,'PHP')}/night</option>)}</optgroup>}{liveAccommodations.some(stay=>stay.currency===currency)&&<optgroup label={`Provider accommodations (${currency})`}>{liveAccommodations.filter(stay=>stay.currency===currency).map(stay=><option key={stay.id} value={`live:${stay.id}`}>{stay.isLive?'LIVE':'TEST'} · {stay.type} · {stay.name} - {formatMoney(stay.nightlyRate,currency)}/night{stay.rating?` · ${stay.rating}/5`:''}</option>)}</optgroup>}</select>{staysBusy && liveAccommodations.length === 0 && <SkeletonRegion label="Loading accommodation options..." className="mt-3 border border-white/10 p-3"><Skeleton className="h-4 w-2/3" /><Skeleton className="mt-2 h-3 w-4/5" /><Skeleton className="mt-3 h-5 w-24" /></SkeletonRegion>}{accommodationRecommendation&&!selectedStayId&&!selectedLiveStayId&&<p className="mt-1 text-[11px] text-emerald-300">TravelMate recommends {accommodationRecommendation.accommodation.name} because it {accommodationRecommendation.reason}. This signed provider offer will be included automatically unless you choose another stay.</p>}{currencyResolved&&currency!=='PHP'&&<p className="mt-1 text-[11px] text-slate-500">TravelMate marketplace stays use PHP; only external offers returned in {currency} can be attached without an exchange-rate assumption.</p>}{selectedLiveAccommodation&&<><p className="mt-1 text-[11px] text-cyan-200">{selectedLiveAccommodation.type} (inferred from provider listing name){selectedLiveAccommodation.rating?` · ${selectedLiveAccommodation.rating}/5`:''} · {selectedLiveAccommodation.address} · {formatMoney(selectedLiveAccommodation.total,currency)} for {Math.max(1,tripDays-1)} night{Math.max(1,tripDays-1)===1?'':'s'} · {selectedLiveAccommodation.roomDescription}</p><ReferenceAmount amount={selectedLiveAccommodation.total} currency={currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes}/></>}{stayMessage&&<p aria-live="polite" className="mt-1 text-[11px] text-slate-500">{stayMessage}</p>}{selectedDestination&&<div className="mt-2"><ProviderFreshness freshness={stayFreshness}/></div>}</div>
                    <label className="sm:col-span-2 text-xs font-medium text-slate-300">Interests<input value={interests} onChange={e=>setInterests(e.target.value)} placeholder="food, culture, nature" className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-2 text-white transition placeholder:text-slate-600 hover:border-slate-600 focus:border-violet-400" /></label>
                    <label className="text-xs font-medium text-slate-300">Travel style<select value={travelStyle} onChange={e=>setTravelStyle(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-white transition hover:border-slate-600 focus:border-violet-400"><option value="budget">Budget</option><option value="balanced">Balanced</option><option value="comfort">Comfort</option><option value="luxury">Luxury</option><option value="family-friendly">Family-friendly</option></select></label>
                    <label className="text-xs font-medium text-slate-300">Stay preference<select value={accommodationPreference} onChange={e=>setAccommodationPreference(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-white transition hover:border-slate-600 focus:border-violet-400"><option value="budget-friendly">Budget-friendly</option><option value="central location">Central location</option><option value="hostel">Hostel</option><option value="condo">Condo / apartment</option><option value="resort">Resort</option><option value="family-friendly">Family-friendly</option><option value="luxury">Luxury</option></select></label>
                    <label className="sm:col-span-2 text-xs font-medium text-slate-300">Preferred activities<input value={preferredActivities} onChange={e=>setPreferredActivities(e.target.value)} placeholder="island hopping, museums" className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-2 text-white transition placeholder:text-slate-600 hover:border-slate-600 focus:border-violet-400" /></label>
                    <div className="sm:col-span-2 text-xs font-medium text-slate-300"><div className="flex items-center justify-between gap-2"><label htmlFor="transportation">Transportation</label>{selectedDestination&&<button type="button" disabled={contextBusy} onClick={retryContext} className="font-bold text-cyan-300 hover:text-cyan-200 disabled:opacity-50">{contextBusy?'Finding options...':'Refresh options'}</button>}</div><select id="transportation" disabled={!selectedDestination||contextBusy||transportationOptions.length===0} value={transportationPreference} onChange={e=>setTransportationPreference(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-white transition hover:border-slate-600 focus:border-violet-400 disabled:opacity-60"><option value="">{!selectedDestination?'Select a destination first':contextBusy?'Finding transportation options...':transportationOptions.length?'Choose a destination-relevant mode':'No verified options available'}</option>{transportationOptions.map(mode=><option key={mode.id} value={mode.label.toLowerCase()}>{mode.label}</option>)}</select>{contextMessage&&<p aria-live="polite" className="mt-1 text-[11px] text-slate-500">{contextMessage}</p>}</div>
                  </div>
                </article>
                <article className="bg-[#102822] p-5 sm:p-7 xl:col-span-12">
                  <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-white/45">03 · Add context if you need it</p><h2 className="mt-1 text-xl font-black tracking-[-0.03em]">Trip origin and optional expenses</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-white/52">Your starting location supports flight comparison. Add pre-trip expenses only when you want them included in the budget.</p></div>{includePreTripCosts&&<div className="text-right"><span className="block text-[10px] font-bold uppercase tracking-wider text-amber-200">Pre-trip total</span><strong className="text-xl text-amber-300">{formatMoney(preTripTotal,currency)}</strong></div>}</div>
                  <div className="mt-6 grid gap-4 border-t border-white/10 pt-5"><div><div className="flex flex-wrap items-center justify-between gap-3"><label htmlFor="flight-origin" className="text-xs font-medium text-slate-300">Starting location</label><button type="button" onClick={useCurrentLocation} disabled={currentLocationBusy} className="inline-flex min-h-9 items-center gap-2 border border-cyan-300/30 px-3 py-2 text-[11px] font-bold text-cyan-200 transition hover:border-cyan-200 hover:bg-cyan-200 hover:text-[#14231f] disabled:opacity-50"><LocateFixed size={14}/>{currentLocationBusy?'Finding your location...':'Use my current location'}</button></div><input id="flight-origin" value={flightOrigin} maxLength={120} onChange={e=>{setFlightOrigin(e.target.value);setTravelOptions(null);setCurrentLocationMessage('');}} placeholder="Cordova, Cebu or Austin, Texas" className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-2 text-white placeholder:text-slate-600"/><span className="mt-1 block text-[10px] font-normal text-slate-500">Used as the origin when comparing flights. Your browser will ask before sharing your location.</span>{currentLocationMessage&&<p aria-live="polite" className="mt-2 text-[11px] text-cyan-200/80">{currentLocationMessage}</p>}</div><button type="button" aria-pressed={includePreTripCosts} onClick={()=>setIncludePreTripCosts(value=>!value)} className={`min-h-12 w-fit border px-5 py-3 text-sm font-bold transition ${includePreTripCosts?'border-amber-300 bg-amber-300 text-[#14231f]':'border-white/20 text-white hover:border-amber-300/60'}`}>{includePreTripCosts?'Remove pre-trip expenses':'Add pre-trip expenses (optional)'}</button></div>
                  {includePreTripCosts&&<div className="mt-6 border-t border-white/10 pt-5"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{([['airportTransfers','Airport transfers'],['passport','Passport / renewal'],['visaOrAuthorization','Visa / authorization'],['departureTaxes','Travel tax'],['insurance','Insurance'],['other','Other costs']] as const).map(([field,label])=><label key={field} className="text-xs font-medium text-slate-300">{label}<input type="number" min="0" step={ZERO_DECIMAL_CURRENCIES.includes(currency)?'1':'0.01'} value={preTripCosts[field]||''} onChange={e=>updatePreTripAmount(field,e.target.value)} placeholder="0" className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-2 text-white placeholder:text-slate-600"/></label>)}</div><p className="mt-5 border-l-2 border-amber-300/50 pl-3 text-[11px] leading-5 text-white/48">Enter whole-party estimates in {currency}. Verify passport, visa, and tax amounts using official sources; leave non-applicable costs at zero.</p></div>}
                </article>
              </section>

              <section className="flex flex-col gap-6 overflow-hidden border border-amber-300/30 bg-amber-300 p-5 text-[#14231f] sm:flex-row sm:items-center sm:justify-between sm:p-7">
                <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#49635c]">Ready when you are</p><h2 className="mt-1 truncate text-xl font-black tracking-[-0.035em]">{selectedDestination?destination:'Your next destination'}</h2><p className="mt-1 text-xs text-[#345047]">{tripDays>=1&&tripDays<=14?`${tripDays} days`: 'Select valid dates'} · {travelers} traveler{travelers===1?'':'s'} · {currencyResolved&&Number.isFinite(budget)?formatMoney(budget,currency):'currency pending'}</p>{currencyResolved&&<ReferenceAmount amount={budget} currency={currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes} className="mt-1 block text-[11px] font-semibold text-[#29463f]"/>}{generationFailed&&message&&<p role="alert" className="mt-3 max-w-2xl border-l-2 border-[#14231f] pl-3 text-sm font-semibold leading-5">{message}</p>}</div>
                <button disabled={busy||tripDays<1||tripDays>14||!selectedDestination||!currencyResolved||!Number.isFinite(budget)||budget<=0} onClick={generate} className="group inline-flex min-h-12 shrink-0 items-center justify-center gap-2 bg-[#14231f] px-6 py-3 font-extrabold text-[#f5edd9] transition hover:bg-[#284a41] disabled:opacity-50">{busy?'Building your trip...':generationFailed?'Retry generation':'Generate my trip'}<ArrowRight size={17} className="transition-transform group-hover:translate-x-1"/></button>
              </section>
            </div>
            {generationBusy && !itinerary && <ItinerarySkeleton days={tripDays} />}
            {weather && <section aria-busy={conditionsBusy} aria-labelledby="conditions-heading" className={`my-5 border-l-2 bg-white/[0.025] p-4 ${weather.source==='unavailable'?'border-amber-400':'border-cyan-400'}`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3"><CloudSun className={`mt-0.5 shrink-0 ${weather.source==='unavailable'?'text-amber-300':'text-cyan-300'}`}/><div><h2 id="conditions-heading" className="font-bold">{weather.source==='unavailable'?`Weather unavailable for ${weather.city}`:<>{weather.city}: {weather.temperature}°C, {weather.description}</>}</h2><p className="mt-1 text-xs leading-5 text-slate-400">{weather.source==='unavailable'?'No current conditions or alerts are being claimed.':weather.alerts[0] || (weather.source==='mock'?'No live alert data.':'No severe current-weather alert.')} · Source: {weather.source === 'open-meteo' ? 'Open-Meteo API' : weather.source === 'openweathermap' ? 'OpenWeatherMap API' : weather.source === 'unavailable' ? 'unavailable' : 'legacy mock/demo data'}</p><p className={`mt-1 text-xs ${weather.forecastAvailable?'text-cyan-200':'text-amber-300'}`}>{weather.forecastMessage}</p><div className="mt-2"><ProviderFreshness freshness={weather.freshness}/></div></div></div>
                <button type="button" disabled={conditionsBusy} onClick={()=>void refreshConditions()} className="min-h-10 shrink-0 border border-cyan-300/35 px-4 py-2 text-xs font-bold text-cyan-200 transition hover:bg-cyan-200 hover:text-[#14231f] disabled:opacity-50">{conditionsBusy?'Refreshing conditions...':'Refresh conditions'}</button>
              </div>
              {weather.forecast.length>0&&<div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">{weather.forecast.map(day=><article key={day.date} className="rounded-md border border-slate-800 bg-slate-900/60 p-2"><p className="text-xs font-semibold">{new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined,{weekday:'short'})}</p><p className="mt-1 text-sm font-mono">{day.tempMin}°–{day.tempMax}°C</p><p className="truncate text-xs capitalize text-slate-400">{day.description}</p><p className="text-xs text-cyan-300">Rain {day.precipitationProbability}%</p></article>)}</div>}
            </section>}
            {itinerary && <ItineraryWorkspace
              itinerary={itinerary}
              weather={weather}
              manualDirty={manualDirty}
              editingTripId={editingTripId}
              busy={busy}
              travelers={travelers}
              referenceCurrency={referenceCurrency}
              exchangeQuotes={exchangeQuotes}
              onSave={() => void (manualDirty ? saveManualChanges() : saveCurrentTrip())}
              onBookAccommodation={(listingId, nights) => void action({ action: 'book', listingId, guests: travelers, nights, checkIn: startDate, checkOut: endDate }, 'Booking request sent for admin review. No payment was charged.')}
              onReorderActivity={reorderActivity}
              onEditActivity={(dayIndex, activityIndex) => setActivityEditor({ dayIndex, activityIndex })}
              onRemoveActivity={confirmRemoveActivity}
              onOpenDay={openDayDetails}
            />}
          </>}
          {tab === 'budget' && <div>{split ? <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[[partyBudgetLabel(itinerary!.partyType || partyType, itinerary!.travelers || travelers),split.total],[partySpendLabel(itinerary!.partyType || partyType),split.plannedSpend||0],[split.shortfall?'Budget shortfall':'Unspent / reserve',split.shortfall||split.remainingBudget||0],['Safety reserve target',split.reserve||0]].map(([label,value])=><div key={String(label)} className="border-t border-slate-700 py-5"><p className="text-xs uppercase text-slate-500">{label}</p><strong className={`text-2xl ${label==='Budget shortfall'?'text-red-300':''}`}>{formatMoney(Number(value),itinerary!.currency)}</strong><ReferenceAmount amount={Number(value)} currency={itinerary!.currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes} className="mt-1 block text-xs font-normal text-cyan-200/70"/></div>)}</div>
            {itinerary?.selectedTravelCosts && itinerary.selectedTravelCosts.total > 0 && <section className="mt-4 border border-cyan-300/25 bg-cyan-300/5 p-4"><h2 className="font-bold">Committed and pre-trip costs included</h2><p className="mt-1 text-sm text-slate-400">Signed provider prices and your own pre-trip estimates are included in planned spending and the within-budget result.</p><div className="mt-3 space-y-2 text-sm">{itinerary.selectedTravelCosts.flight && <div className="flex justify-between gap-3"><span>{itinerary.selectedTravelCosts.flight.name}</span><strong>{formatMoney(itinerary.selectedTravelCosts.flight.total, itinerary.currency)}</strong></div>}{itinerary.selectedTravelCosts.activities.map((activity) => <div key={activity.id} className="flex justify-between gap-3"><span>{activity.name} · {activity.travelers} travelers</span><strong>{formatMoney(activity.total, itinerary.currency)}</strong></div>)}{itinerary.selectedTravelCosts.preTrip && <div className="mt-3 border-t border-white/10 pt-3"><div className="mb-2 flex justify-between gap-3"><span><strong>Pre-trip estimates</strong>{itinerary.selectedTravelCosts.preTrip.startingLocation ? ` · from ${itinerary.selectedTravelCosts.preTrip.startingLocation}` : ''}</span><strong>{formatMoney(itinerary.selectedTravelCosts.preTrip.total,itinerary.currency)}</strong></div>{([['Airport transfers',itinerary.selectedTravelCosts.preTrip.airportTransferOutbound + itinerary.selectedTravelCosts.preTrip.airportTransferReturn],['Passport / renewal',itinerary.selectedTravelCosts.preTrip.passport],['Visa / authorization',itinerary.selectedTravelCosts.preTrip.visaOrAuthorization],['Travel tax',itinerary.selectedTravelCosts.preTrip.departureTaxes],['Insurance',itinerary.selectedTravelCosts.preTrip.insurance],['Other costs',itinerary.selectedTravelCosts.preTrip.other]] as const).filter(([,amount])=>amount>0).map(([label,amount])=><div key={label} className="flex justify-between gap-3 text-xs text-slate-400"><span>{label}</span><span>{formatMoney(amount,itinerary.currency)}</span></div>)}<p className="mt-2 text-[11px] text-amber-200">User-entered estimates; verify document and government fees with official sources.</p></div>}<div className="flex justify-between gap-3 border-t border-white/10 pt-2"><strong>Committed-cost total</strong><strong>{formatMoney(itinerary.selectedTravelCosts.total, itinerary.currency)}</strong></div></div></section>}
            {optimization && <section className={`mt-5 rounded-xl border p-5 ${optimization.status==='over_budget'?'border-red-500/40 bg-red-500/5':optimization.status==='near_limit'?'border-amber-400/40 bg-amber-400/5':'border-emerald-400/30 bg-emerald-400/5'}`} aria-labelledby="budget-optimization-heading">
              <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-950/60"><WalletCards size={19} className={optimization.status==='over_budget'?'text-red-300':optimization.status==='near_limit'?'text-amber-300':'text-emerald-300'}/></span><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Budget optimization</p><h2 id="budget-optimization-heading" className="mt-1 font-bold">{optimization.status==='over_budget'?`Reduce the estimate by ${formatMoney(optimization.amountToTarget,itinerary!.currency)}`:optimization.status==='near_limit'?`Save ${formatMoney(optimization.amountToTarget,itinerary!.currency)} to protect the reserve`:'Plan is within budget with the reserve protected'}</h2>{optimization.status!=='within_budget'&&<ReferenceAmount amount={optimization.amountToTarget} currency={itinerary!.currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes}/>}<p className="mt-1 text-sm text-slate-400">Target spend: {formatMoney(optimization.targetSpend,itinerary!.currency)}.</p><ReferenceAmount amount={optimization.targetSpend} currency={itinerary!.currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes}/></div></div>{optimization.suggestions.length>0&&<button onClick={()=>setTab('planner')} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-600 px-4 py-2 text-sm font-bold hover:bg-slate-800">Review itinerary<ArrowRight size={15}/></button>}</div>
              {optimization.suggestions.length>0&&<><div className="mt-5 grid gap-3 lg:grid-cols-2">{optimization.suggestions.map(suggestion=><article key={suggestion.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-4"><div className="flex items-start justify-between gap-3"><div><span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">{suggestion.category}{suggestion.affectedDay?` · Day ${suggestion.affectedDay}`:''}</span><h3 className="mt-1 font-bold">{suggestion.title}</h3></div><span className="shrink-0 text-right"><strong className="text-emerald-300">Save ~{formatMoney(suggestion.estimatedSavings,itinerary!.currency)}</strong><ReferenceAmount amount={suggestion.estimatedSavings} currency={itinerary!.currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes}/></span></div><p className="mt-3 text-sm text-slate-300">{suggestion.description}</p><p className="mt-2 text-xs leading-relaxed text-amber-200"><strong>Tradeoff:</strong> {suggestion.tradeoff}</p></article>)}</div><div className="mt-4 grid gap-3 border-t border-slate-800 pt-4 sm:grid-cols-2"><div><p className="text-xs uppercase text-slate-500">Potential combined savings</p><strong className="text-xl text-emerald-300">~{formatMoney(optimization.combinedEstimatedSavings,itinerary!.currency)}</strong><ReferenceAmount amount={optimization.combinedEstimatedSavings} currency={itinerary!.currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes}/></div><div><p className="text-xs uppercase text-slate-500">Projected spend if all are applied</p><strong className="text-xl">~{formatMoney(optimization.projectedSpendIfAllApplied,itinerary!.currency)}</strong><ReferenceAmount amount={optimization.projectedSpendIfAllApplied} currency={itinerary!.currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes}/>{optimization.remainingGapAfterSuggestions>0&&<p className="mt-1 text-xs text-red-300">Still {formatMoney(optimization.remainingGapAfterSuggestions,itinerary!.currency)} above the target.<ReferenceAmount amount={optimization.remainingGapAfterSuggestions} currency={itinerary!.currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes}/></p>}</div></div></>}
              <p className="mt-4 text-xs text-slate-500">{optimization.disclaimer}</p>
            </section>}
            {itinerary?.costSharing&&itinerary.costSharing.travelers>1&&<div className="mt-5 rounded-md border border-slate-800 p-4"><h2 className="font-bold">Equal-share guide</h2><p className="mt-1 text-sm text-slate-400">{PARTY_TYPE_LABELS[itinerary.costSharing.partyType]} with {itinerary.costSharing.travelers} travelers. The entered budget is one combined total; these are optional equal shares per traveler.</p><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{itinerary.costSharing.plannedSpendShares.map((amount,index)=><div key={index} className="border-t border-slate-700 py-2"><small className="text-slate-500">Traveler {index+1}</small><p className="font-mono">{formatMoney(amount,itinerary.currency)}</p><ReferenceAmount amount={amount} currency={itinerary.currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes}/></div>)}</div></div>}
            <p className="mt-4 text-xs text-slate-500">{itinerary?.costSharing?.travelers===1?'All displayed costs belong to the solo traveler.':'Accommodation and the entered budget cover the whole party. Food, transport, and activities are estimated per person and multiplied once.'} Final venue prices may change.</p>
          </> : <section className="border border-dashed border-white/15 bg-white/[0.025] p-8 sm:p-12"><WalletCards size={25} className="text-amber-300"/><h2 className="mt-6 max-w-xl text-3xl font-black tracking-[-0.04em]">Budget review begins after itinerary generation.</h2><p className="mt-4 max-w-2xl text-sm leading-6 text-white/50">TravelMate needs the generated activities, transportation, food estimate, and any selected accommodation before it can explain planned spending and possible savings.</p><button type="button" onClick={()=>setTab('planner')} className="group mt-7 inline-flex min-h-11 items-center gap-2 bg-amber-300 px-5 py-2 text-sm font-extrabold text-[#14231f]">Go to trip details <ArrowRight size={16} className="transition-transform group-hover:translate-x-1"/></button></section>}</div>}
          {tab === 'compare' && <TravelComparisonWorkspace
            flightOrigin={flightOrigin}
            destination={destination}
            selectedDestination={Boolean(selectedDestination)}
            startDate={startDate}
            endDate={endDate}
            travelers={travelers}
            busy={comparisonBusy}
            message={comparisonMessage}
            travelOptions={travelOptions}
            selectedFlightId={selectedFlightId}
            selectedActivityIds={selectedActivityIds}
            stayOptions={stayOptions}
            liveAccommodations={liveAccommodations}
            stayFreshness={stayFreshness}
            staysBusy={staysBusy}
            tripDays={tripDays}
            referenceCurrency={referenceCurrency}
            exchangeQuotes={exchangeQuotes}
            onFlightOriginChange={(value) => { setFlightOrigin(value); setTravelOptions(null); }}
            onSearch={() => void searchComparison()}
            onSelectFlight={(flight) => setSelectedFlightId((current) => current === flight.id ? '' : flight.id)}
            onToggleActivityCost={(activity) => setSelectedActivityIds((current) => current.includes(activity.id) ? current.filter((id) => id !== activity.id) : [...current, activity.id])}
            onSelectLocalStay={(stay) => { setSelectedStayId(stay.id); setSelectedLiveStayId(''); setTab('planner'); setMessage(`${stay.name} selected for the itinerary.`); }}
            onSelectLiveStay={(stay) => { setSelectedStayId(''); setSelectedLiveStayId(stay.id); setTab('planner'); setMessage(`${stay.name} selected for the itinerary. Its signed offer price will be verified by the server.`); }}
            onAddActivity={addComparedActivity}
          />}
          {tab === 'bookings' && <div className="space-y-8">
            <SavedTripLifecycle
              trips={data.trips}
              versions={data.itineraryVersions || []}
              generations={data.itineraryGenerations || []}
              busy={busy}
              onPlanFirstTrip={startNewTrip}
              onView={(trip)=>loadTrip(trip,true)}
              onEdit={(trip)=>loadTrip(trip,false)}
              onAction={action}
              onDelete={(trip)=>{if(window.confirm(`Permanently delete the archived trip to ${trip.destination}? This also removes its version history and cannot be undone.`))void action({action:'delete-trip',id:trip.id},'Archived trip permanently deleted.').then(ok=>{if(ok&&editingTripId===trip.id)setEditingTripId(null);});}}
            />
          </div>}
          {tab === 'notifications' && <TravelerNotifications data={data} busy={busy} action={action}/>} 
          {tab === 'profile' && <TravelerAccountCenter user={data.user} busy={busy} onSaveProfile={saveProfile} onReport={(title,details)=>action({action:'submit-report',title,details},'Your report was sent to the admin.')}  />}
        </main>
      </div>
      {activityEditor && editorDay && <ActivityEditorDialog editor={activityEditor} day={editorDay} activity={editorActivity} currency={itinerary?.currency || currency} modalRef={activityModalRef} titleRef={activityTitleRef} onClose={() => setActivityEditor(null)} onSubmit={submitActivity} />}
      {selectedDay && itinerary && <DayDetailsDialog day={selectedDay} itinerary={itinerary} travelers={travelers} referenceCurrency={referenceCurrency} exchangeQuotes={exchangeQuotes} photoRefreshDay={photoRefreshDay} modalRef={dayModalRef} closeRef={dayCloseRef} onClose={() => setSelectedDay(null)} onRefreshPhotos={(day) => void refreshDayPhotos(day, true)} />}
    </div>
  );
}
