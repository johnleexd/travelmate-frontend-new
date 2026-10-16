'use client';
import { ConversionPreference, ConversionLoading } from '@/components/common/ConversionPreference';
import { ConversionDetails } from '@/components/common/ConversionDetails';

import styles from './TravelerDashboard.module.css';
import { PlacesPhotoMapBoundary, PlacesAwareTripMap } from '@/components/common/PlacesPhotoMapBoundary';
import { VisitedPlaces } from './VisitedPlaces';
import { ReportProblem } from './ReportProblem';
import { ExpenseAssumptionsFields } from './ExpenseAssumptions';
import { TripPreferenceFields } from './TripPreferenceFields';
import { DestinationSpotCarousel } from './DestinationSpotCarousel';
import { restoredExpenseAssumptions, type ExpenseAssumptions } from '@/lib/expense-assumptions';
import { BudgetReview } from './BudgetReview';
import { HelpUserGuide } from './HelpUserGuide';
import { MyPlan, MonthlyLimitDialog } from './MyPlan';
import { announcePlanLimit, fetchPlan, forgetGenerationKey, persistentGenerationKey, type PlanUsage } from '@/services/plan.service';
import { ApiError } from '@/services/api-response';
import type { HelpGuideId } from '@/lib/help-guides';

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Popover } from 'radix-ui';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowLeft, ArrowRight, BedDouble, Bell, CalendarDays, ChevronRight, CircleHelp, CloudSun, Compass, Home, LoaderCircle, LogOut, MapPin, MessageSquare, UserRound, WalletCards } from 'lucide-react';
import { fetchTripData, fetchWeather, handleResponse, isAuthenticationError, refreshItineraryDayImages, retryItineraryDays, type DayActivity, type ItineraryResponse, type WeatherData } from '@/services/api.service';
import { CURRENCY_NAMES, formatMoney, hasValidCurrencyPrecision, partyBudgetExplanation, partyBudgetLabel, PARTY_TYPE_LABELS, SUPPORTED_CURRENCIES, currencyStep, currencyFractionDigits, type CurrencyCode, type PartyType } from '@/lib/domain';
import type { NotificationsResponse, PageInfo, PlatformActionResponse, PlatformResponse, ProfileResponse, SavedTrip, TripDetailResponse, TripVersionsResponse } from '@/lib/contracts';
import { moveActivity, removeActivity, upsertActivity } from '@/lib/itinerary-editor';
import { applyConditionSnapshot } from '@/lib/conditions';
import { DashboardLoadState } from '@/components/common/DashboardLoadState';
import { ItinerarySkeleton } from '@/components/common/ContentSkeletons';
import { TravelerJourneyOverview } from '@/components/features/traveler/TravelerJourneyOverview';
import { TravelerAccountCenter } from '@/components/features/traveler/TravelerAccountCenter';
import { SavedTripLifecycle } from '@/components/features/traveler/SavedTripLifecycle';
import { SavedTripItineraryDialog } from './SavedTripItineraryDialog';
import { GenerationProgress } from './GenerationProgress';
import { EditTripDialog } from '@/components/features/traveler/EditTripDialog';
import { TripLocationMap } from '@/components/features/traveler/TripLocationMap';
import { SavedTripMapDialog } from './SavedTripMapDialog';
import { tripMapDestination, type MapCoordinates } from '@/lib/trip-map';
import { useModalAccessibility } from '@/hooks/use-modal-accessibility';
import { selectedDestinationAnchor } from '@/lib/destination-identity';
import { useDestinationPlanning } from '@/hooks/use-destination-planning';
import { useStartingLocation } from '@/hooks/use-starting-location';
import { useExchangeRates } from '@/hooks/use-exchange-rates';
import { isCurrencyCode } from '@/lib/currency-conversion';
import { ReferenceAmount } from '@/components/common/ReferenceAmount';
import { ProviderFreshness } from '@/components/common/ProviderFreshness';
import { ItineraryWorkspace } from '@/components/features/traveler/ItineraryWorkspace';
import { ActivityEditorDialog, DayDetailsDialog } from '@/components/features/traveler/TravelerItineraryDialogs';
import { addCalendarDays, localDateInputValue, regenerationDraftDates } from '@/lib/date';
import { AccommodationPicker, type StaySelection } from './AccommodationPicker';
import { DestinationSelector } from './DestinationSelector';
import { TravelerNotifications } from '@/components/features/traveler/TravelerNotifications';
import { signOut, signedOutLocation } from '@/services/session.service';
import { readBrowserStorage, writeBrowserStorage, removeBrowserStorage } from '@/lib/browser-storage';
import { parseItineraryDraft, type ItineraryDraft } from '@/lib/itinerary-draft';
import { RestoreDraftDialog } from './RestoreDraftDialog';
import { UnsavedTripDialog } from './UnsavedTripDialog';
import { TripSaveToast, type TripSaveFeedback } from './TripSaveToast';
import { savedNavigationMessage } from '@/lib/retired-navigation';
import { useItineraryNavigation, type ItineraryView, type TravelerTab } from '@/hooks/use-itinerary-navigation';

type Tab = TravelerTab;
type PreTripCostDraft = {
  airportTransfers: number; passport: number; visaOrAuthorization: number;
  departureTaxes: number; insurance: number; other: number;
};
const EMPTY_PRE_TRIP_COSTS: PreTripCostDraft = { airportTransfers: 0, passport: 0, visaOrAuthorization: 0, departureTaxes: 0, insurance: 0, other: 0 };
const GENERATION_REQUIREMENT_ICONS = {
  'destination-search': MapPin,
  'trip-currency': WalletCards,
  'trip-start-date': CalendarDays,
  'trip-end-date': CalendarDays,
  'trip-budget': WalletCards,
  'trip-travelers': UserRound,
  'trip-accommodation': BedDouble,
};
const TAB_COPY: Record<Tab, { title: string; description: string }> = {
  plan: { title: 'My Plan', description: 'Manage your AI itinerary allowance.' },
  help: { title: 'How can we help you?', description: 'Simple steps for planning and managing your trips.' },
  visited: { title: 'Visited places', description: 'Keep a personal history of the places you have visited.' },
  feedback: { title: 'Feedback and support', description: 'Rate a saved trip or report a problem to the TravelMate team.' },
  overview: { title: 'Your travel home', description: 'See what TravelMate does, where your plans are, and the single best action to take next.' },
  planner: { title: 'Start a new trip', description: 'Begin with four essentials. Optional preferences simply help make the itinerary more personal.' },
  budget: { title: 'Does this plan fit your budget?', description: 'Review estimated spending, remaining money, and optional ways to reduce cost.' },
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

function savedStaySelection(plan: ItineraryResponse): StaySelection | null {
  const planned = plan.plannedAccommodation;
  if (!planned) return null;
  return {
    value: planned.source === 'manual' ? 'manual' : `provider:${planned.sourceId}`,
    planned,
    preview: { ...planned, type: planned.type || 'Accommodation', source: 'Saved accommodation' },
  };
}

function editableItineraryFingerprint(plan: ItineraryResponse | null): string {
  return JSON.stringify(plan?.days.map(day => ({ day: day.day, date: day.date, theme: day.theme,
    activities: day.activities.map(activity => ({ title: activity.title, time: activity.time,
      durationMinutes: activity.durationMinutes, travelMinutes: activity.travelMinutes,
      description: activity.description, estimatedCost: activity.estimatedCost,
      category: activity.category, location: activity.location || '',
    })),
  })) ?? null);
}

async function api(): Promise<PlatformResponse>;
async function api(body: Record<string, unknown>): Promise<PlatformActionResponse>;
async function api(body?: Record<string, unknown>): Promise<PlatformResponse | PlatformActionResponse> {
  const response = await fetch(body ? '/api/platform' : '/api/platform?scope=traveler&summary=true', body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  return body ? handleResponse<PlatformActionResponse>(response) : handleResponse<PlatformResponse>(response);
}

export default function TravelerDashboard(props: { initialTab?: Tab }) {
  return <PlacesPhotoMapBoundary><TravelerDashboardContent {...props}/></PlacesPhotoMapBoundary>;
}

function TravelerDashboardContent({ initialTab }: { initialTab?: Tab }) {
  const router = useRouter();
  const [data, setData] = useState<PlatformResponse | null>(null);
  const [versionPages, setVersionPages] = useState<Record<string, PageInfo>>({});
  const [savedTripsVisited, setSavedTripsVisited] = useState(false);
  const [message, setMessage] = useState('');
  const [planLimit, setPlanLimit] = useState<PlanUsage | null>(null);
  useEffect(() => {
    const show = (event: Event) => {
      const value = (event as CustomEvent<PlanUsage>).detail;
      if (value && Number.isFinite(value.allowance) && typeof value.resetsAt === 'string') setPlanLimit(value);
      else void fetchPlan().then(setPlanLimit).catch(() => undefined);
    };
    window.addEventListener('travelmate-plan-limit', show);
    return () => window.removeEventListener('travelmate-plan-limit', show);
  }, []);
  const sectionVersionRef = useRef(0);
  const workspaceOwnerRef = useRef<string | null>(null);
  const [budgetInput, setBudgetInput] = useState('');
  const budget = Number(budgetInput);
  const setBudget = useCallback((value: number) => setBudgetInput(String(value)), []);
  const [referenceCurrency, setReferenceCurrency] = useState<CurrencyCode>('PHP');
  const [conversionEnabled,setConversionEnabled] = useState(true);
  const [referencePreferenceReady, setReferencePreferenceReady] = useState(false);
  const [partyType, setPartyType] = useState<PartyType>('solo');
  const [travelers, setTravelers] = useState(1);
  const [startDate, setStartDate] = useState(() => localDateInputValue());
  const [endDate, setEndDate] = useState(() => addCalendarDays(localDateInputValue(), 6));
  const {
    destination, selectedDestination,
    currency, currencyResolved, currencyFallbackMessage, currencyNeedsFallback, contextBusy,
    providerAccommodations, providerStatus, providerMessage, providerEnvironment, liveAccommodations, nearbyAccommodations, accommodationNeedsArea, accommodationQueryKey, staysBusy, stayMessage, stayStatus,
    changeDestinationInput, selectDestination, restoreDestination, setManualCurrency,
    retryAccommodations,
  } = useDestinationPlanning(startDate, endDate, travelers);
  const destinationDetails = selectedDestinationAnchor(selectedDestination);
  const [historicalInterests, setHistoricalInterests] = useState<string[]>([]);
  const [travelStyle, setTravelStyle] = useState('balanced');
  const [accommodationPreference, setAccommodationPreference] = useState('no preference');
  const [staySelectionState, setStaySelectionState] = useState<{ key: string; selection: StaySelection } | null>(null);
  const [restoredStaySelection, setRestoredStaySelection] = useState<{ destination: string; selection: StaySelection | null } | null>(null);
  const [budgetedStaySelection, setBudgetedStaySelection] = useState<typeof staySelectionState>(null);
  const staySelection = staySelectionState?.key === accommodationQueryKey ? staySelectionState.selection
    : restoredStaySelection?.destination === destination ? restoredStaySelection.selection : null;
  const selectedStayId = !staySelection?.planned && staySelection?.value.startsWith('local:') ? staySelection.value.slice(6) : '';
  const selectedLiveStayId = !staySelection?.planned && staySelection?.value.startsWith('live:') ? staySelection.value.slice(5) : '';
  const [itinerary, setItinerary] = useState<ItineraryResponse | null>(null);
  const providerBaseRef = useRef<ItineraryResponse | null>(null);
  const [retryingDay, setRetryingDay] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<ItineraryResponse['days'][number] | null>(null);
  const [photoRefreshDay, setPhotoRefreshDay] = useState<number | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [conditionsBusy, setConditionsBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [generationBusy, setGenerationBusy] = useState(false);
  const [generationFailed, setGenerationFailed] = useState(false);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [tripMapSelection, setTripMapSelection] = useState<{ owner: string; tripId: string; dayIndex?: number } | null>(null);
  const [tripEditor, setTripEditor] = useState<{ owner: string; trip: SavedTrip } | null>(null);
  const [visitTripId, setVisitTripId] = useState<string | null>(null);
  const [viewedTripMap, setViewedTripMap] = useState<{ owner: string; tripId: string; destination: string; point: MapCoordinates | null } | null>(null);
  const savePendingRef = useRef(false);
  const [regenerationTargetId, setRegenerationTargetId] = useState<string | null>(null);
  const [activityEditor, setActivityEditor] = useState<{ dayIndex: number; activityIndex: number | null } | null>(null);
  const [manualDirty, setManualDirty] = useState(false);
  const [savedTripOrigin, setSavedTripOrigin] = useState<SavedTrip | null>(null);
  const savedTripsReturnRef = useRef<{ scrollY: number; opener: HTMLElement | null } | null>(null);
  const restoreSavedTripsRef = useRef(false);
  const planningBaselineRef = useRef<string | null>(null);
  const capturePlanningBaselineRef = useRef(false);
  const itineraryBaselineRef = useRef<string | null>(null);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const routeLoadRef = useRef<string | null>(null);
  const backToSavedTripsRef = useRef<HTMLButtonElement>(null);
  const [savingTrip, setSavingTrip] = useState(false);
  const [lastSuccessfulUpdate, setLastSuccessfulUpdate] = useState<{ planning: string; itinerary: string } | null>(null);
  const [saveToast, setSaveToast] = useState<TripSaveFeedback | null>(null);
  const saveToastSequenceRef = useRef(0);
  const dismissSaveToast = useCallback(() => setSaveToast(null), []);
  const startingLocation = useStartingLocation(data?.user.id);
  const { value: flightOrigin, change: setFlightOrigin } = startingLocation;
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [selectedHelpGuide, setSelectedHelpGuide] = useState<HelpGuideId>('create-trip');
  const [expenseAssumptions, setExpenseAssumptions] = useState<ExpenseAssumptions>({});
  const [preTripCosts, setPreTripCosts] = useState<PreTripCostDraft>(EMPTY_PRE_TRIP_COSTS);
  const [includePreTripCosts, setIncludePreTripCosts] = useState(false);
  const [loadError, setLoadError] = useState('');
  const activityModalRef = useRef<HTMLDivElement | null>(null);
  const activityTitleRef = useRef<HTMLInputElement | null>(null);
  const dayModalRef = useRef<HTMLDivElement | null>(null);
  const dayCloseRef = useRef<HTMLButtonElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const workspaceHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const planningFocusRef = useRef<string | null>(null);
  const planningSettingsRef = useRef<HTMLDetailsElement | null>(null);
  const dashboardMountedRef = useRef(false);
  const generationRequestRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const draftCheckedRef = useRef(false);
  const [recoveryDraft, setRecoveryDraft] = useState<ItineraryDraft | null>(null);
  // Compare editable values, excluding provider refreshes and photo metadata.
  const planningFingerprint = JSON.stringify({
    destination, selectedDestination, budgetInput, currency, startDate, endDate,
    partyType, travelers, travelStyle,
    accommodationPreference, staySelection,
    flightOrigin, expenseAssumptions, preTripCosts, includePreTripCosts,
  });
  const itineraryFingerprint = editableItineraryFingerprint(itinerary);
  const withPlanningPreferences = useCallback((plan: ItineraryResponse): ItineraryResponse => ({
    ...plan,
    preferences: {
      ...plan.preferences, travelStyle,
      accommodation: plan.preferences?.accommodation ?? accommodationPreference,
      transportation: plan.preferences?.transportation ?? '',
      activities: plan.preferences?.activities ?? [],
    },
  }), [travelStyle, accommodationPreference]);
  const hasUnsavedTripChanges = () => (itineraryBaselineRef.current !== null ? itineraryBaselineRef.current !== itineraryFingerprint : manualDirty) || (planningBaselineRef.current !== null && planningBaselineRef.current !== planningFingerprint);
  const navigation = useItineraryNavigation(initialTab || 'overview', (target, current) => (current.tab === 'planner' || current.tab === 'budget') && !!savedTripOrigin && hasUnsavedTripChanges() && (!['planner', 'budget'].includes(target.tab) || target.tripId !== visitTripId), () => setLeaveDialogOpen(true));
  const tab = navigation.view.tab;
  useEffect(() => {
    if (tab !== 'planner' || !planningFocusRef.current) return;
    const id = planningFocusRef.current;
    planningFocusRef.current = null;
    const timer = window.setTimeout(() => {
      const field = document.getElementById(id);
      const details = field?.closest('details');
      if (details) details.open = true;
      field?.scrollIntoView({ block: 'center', behavior: 'instant' });
      field?.focus({ preventScroll: true });
    }, 100);
    return () => window.clearTimeout(timer);
  }, [tab]);
  const requestedMap = useRef('');
  useEffect(() => {
    const owner = data?.user.id, tripId = navigation.view.mapTripId;
    if (!owner || navigation.view.tab !== 'bookings' || !tripId) { requestedMap.current = ''; return; }
    const identity = `${owner}:${tripId}:${navigation.view.mapDay || 1}`;
    if (requestedMap.current === identity) return;
    const timer = window.setTimeout(() => {
      requestedMap.current = identity;
      setTripMapSelection({ owner, tripId, dayIndex: (navigation.view.mapDay || 1) - 1 });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [data?.user.id, navigation.view.tab, navigation.view.mapTripId, navigation.view.mapDay]);

  const setTab = (nextTab: Tab, view?: ItineraryView) => {
    sectionVersionRef.current += 1;
    setMessage('');
    navigation.navigate(view || (nextTab === 'planner' || nextTab === 'budget' ? {
      tab: nextTab,
      tripId: navigation.view.tripId || visitTripId || editingTripId || undefined,
      fromSavedTrips: navigation.view.fromSavedTrips ?? !!savedTripOrigin,
      returnToSavedItinerary: nextTab === 'budget' && navigation.view.tab === 'bookings' && !!navigation.view.tripId,
    } : { tab: nextTab }));
    if (nextTab === 'bookings') setSavedTripsVisited(true);
  };
  const latestDraftRef = useRef({ planning: planningFingerprint, itinerary: itineraryFingerprint });
  const tripUpdated = lastSuccessfulUpdate?.planning === planningFingerprint && lastSuccessfulUpdate.itinerary === itineraryFingerprint;
  useEffect(() => {
    latestDraftRef.current = { planning: planningFingerprint, itinerary: itineraryFingerprint };
    if (capturePlanningBaselineRef.current) {
      planningBaselineRef.current = planningFingerprint;
      capturePlanningBaselineRef.current = false;
    }
  });
  const exchangeSourceCurrencies = useMemo(() => {
    const values: unknown[] = [currency, itinerary?.currency, 'PHP'];
    values.push(...liveAccommodations.map((stay) => stay.currency));
    values.push(...(data?.trips.map((trip) => trip.currency) || []));
    return [...new Set(values.filter(isCurrencyCode))];
  }, [currency, itinerary?.currency, liveAccommodations, data?.trips]);
  const { exchangeQuotes, exchangeBusy } = useExchangeRates(
    exchangeSourceCurrencies, referenceCurrency,
    conversionEnabled && referencePreferenceReady && !!data?.user.id && data.user.role === 'traveler' && data.user.accountStatus === 'active',
  );

  const acceptWorkspace = useCallback((workspace: PlatformResponse) => {
    if (workspaceOwnerRef.current && workspaceOwnerRef.current !== workspace.user.id) {
      // Prevent the previous account's origin in a trip/draft from being restored
      // or written into the next account's browser draft.
      setVisitTripId(null); setItinerary(null); setWeather(null); setManualDirty(false);
      setPreTripCosts(EMPTY_PRE_TRIP_COSTS); setIncludePreTripCosts(false);
      setEditingTripId(null); setVisitTripId(null); setRegenerationTargetId(null); setSelectedDay(null);
      setStaySelectionState(null);
      setVersionPages({});
      draftCheckedRef.current = false;
      setRecoveryDraft(null);
      setSavedTripOrigin(null); setSavedTripsVisited(false);
      savedTripsReturnRef.current = null; planningBaselineRef.current = null;
      itineraryBaselineRef.current = null;
      providerBaseRef.current = null;
      setLastSuccessfulUpdate(null); setSaveToast(null); setLeaveDialogOpen(false);
    }
    workspaceOwnerRef.current = workspace.user.id;
    setData(workspace);
  }, [setIncludePreTripCosts, setVisitTripId, setItinerary, setWeather, setEditingTripId, setRegenerationTargetId, setSelectedDay, setLeaveDialogOpen, setManualDirty, setStaySelectionState]);
  const refresh = () => api().then(acceptWorkspace);
  const loadInitial = async () => {
    try { acceptWorkspace(await api()); }
    catch (error) {
      if (isAuthenticationError(error)) { router.replace('/account/appeal'); return; }
      setLoadError(error instanceof Error ? error.message : 'TravelMate could not load your workspace.');
    }
  };
  useEffect(() => {
    void api().then(acceptWorkspace).catch((error: unknown) => {
      if (isAuthenticationError(error)) { router.replace('/account/appeal'); return; }
      setLoadError(error instanceof Error ? error.message : 'TravelMate could not load your workspace.');
    });
  }, [router, acceptWorkspace]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = readBrowserStorage('travelmate-reference-currency');
      if (isCurrencyCode(stored)) setReferenceCurrency(stored);
      setConversionEnabled(readBrowserStorage('travelmate-conversion-enabled') !== 'false');
      setReferencePreferenceReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!referencePreferenceReady) return;
    writeBrowserStorage('travelmate-reference-currency', referenceCurrency);
  }, [referenceCurrency, referencePreferenceReady]);

  useEffect(() => {
    if (!data || draftCheckedRef.current) return;
    const timer = window.setTimeout(() => {
      if (draftCheckedRef.current) return;
      draftCheckedRef.current = true;
      const key = `travelmate-itinerary-draft:${data.user.id}`;
      const stored = readBrowserStorage(key);
      if (!stored) return;
      const draft = parseItineraryDraft(stored, data.user.id);
      if (draft) setRecoveryDraft(draft);
      else removeBrowserStorage(key);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [data]);

  const restoreDraft = (candidate?: ItineraryDraft) => {
    const draft = candidate ?? recoveryDraft;
    if (!draft || draft.trip?.userId !== data?.user.id) return;
    setSavedTripOrigin(null); planningBaselineRef.current = null;
    itineraryBaselineRef.current = null; setLastSuccessfulUpdate(null); setSaveToast(null);
    const plan = draft.itinerary;
    providerBaseRef.current = draft.providerBase ?? null;
    setStaySelectionState(null);
    setRestoredStaySelection({ destination: draft.trip.destination, selection: savedStaySelection(plan) });
    setBudget(draft.trip.budget); setStartDate(draft.trip.startDate); setEndDate(draft.trip.endDate);
    setTravelers(draft.trip.partyType === 'solo' ? 1 : draft.trip.partyType === 'couple' ? 2 : draft.trip.travelers); setPartyType(draft.trip.partyType); setHistoricalInterests(draft.trip.interests ?? []);
    restoreDestination(draft.trip, plan.preferences?.transportation || '');
    setTravelStyle(plan.preferences?.travelStyle || 'balanced');
    setAccommodationPreference(plan.preferences?.accommodation || 'no preference');
    const restoredPreTrip = plan.selectedTravelCosts?.preTrip;
    setFlightOrigin(plan.grounding?.startingLocation || restoredPreTrip?.startingLocation || '');
    setExpenseAssumptions(restoredExpenseAssumptions(plan));
    setPreTripCosts(restoredPreTrip ? { airportTransfers: restoredPreTrip.airportTransferOutbound + restoredPreTrip.airportTransferReturn, passport: restoredPreTrip.passport, visaOrAuthorization: restoredPreTrip.visaOrAuthorization, departureTaxes: restoredPreTrip.departureTaxes, insurance: restoredPreTrip.insurance, other: restoredPreTrip.other } : EMPTY_PRE_TRIP_COSTS);
    setIncludePreTripCosts(Boolean(restoredPreTrip?.total));
    setItinerary(plan); setWeather(draft.weather);
    setEditingTripId(draft.trip.id || null); setVisitTripId(draft.trip.id || null); setRegenerationTargetId(null); setManualDirty(true); setTab('planner', { tab: 'planner', tripId: draft.trip.id || undefined });
    setMessage('Unsaved browser draft restored. Review it, then save your changes.');
    setRecoveryDraft(null);
  };

  useEffect(() => {
    if (!data || !itinerary || !manualDirty) return;
    const key = `travelmate-itinerary-draft:${data.user.id}`;
    const trip: SavedTrip = {
      id: editingTripId || '', userId: data.user.id, destination, destinationCity: selectedDestination?.name,
      destinationRegion: selectedDestination?.region, destinationCountry: selectedDestination?.country,
      destinationCountryCode: selectedDestination?.countryCode, latitude: selectedDestination?.latitude,
      longitude: selectedDestination?.longitude, budget, currency, startDate, endDate, travelers, partyType,
      interests: historicalInterests, itinerary: withPlanningPreferences(itinerary), weather,
      status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    if (!writeBrowserStorage(key, JSON.stringify({ trip, itinerary: trip.itinerary, providerBase: providerBaseRef.current ?? undefined, weather, savedAt: new Date().toISOString() }))) {
      const timer = window.setTimeout(() => setMessage('Your browser could not keep an unsaved draft. Keep this page open and save your trip to keep these changes.'), 0);
      return () => window.clearTimeout(timer);
    }
  }, [data, itinerary, weather, manualDirty, editingTripId, destination, selectedDestination, budget, currency, startDate, endDate, travelers, partyType, historicalInterests, withPlanningPreferences]);

  useEffect(() => {
    if (!manualDirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [manualDirty]);

  useModalAccessibility({
    active: activityEditor !== null,
    containerRef: activityModalRef,
    initialFocusRef: activityTitleRef,
    onClose: () => setActivityEditor(null),
  });

  useEffect(() => {
    if (!dashboardMountedRef.current) {
      dashboardMountedRef.current = true;
      return;
    }
    // The dialog owns focus and scrolling while a saved itinerary is open.
    if (tab === 'bookings' && navigation.view.tripId) return;
    const frame = window.requestAnimationFrame(() => {
      const savedReturn = tab === 'bookings' && !navigation.view.tripId && restoreSavedTripsRef.current ? savedTripsReturnRef.current : null;
      restoreSavedTripsRef.current = false;
      if (savedReturn) {
        (savedReturn.opener?.isConnected ? savedReturn.opener : workspaceHeadingRef.current)?.focus({ preventScroll: true });
        window.scrollTo({ top: savedReturn.scrollY, behavior: 'instant' });
      } else workspaceHeadingRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [tab, navigation.view.tripId]);
  useEffect(() => {
    if (!data?.user.id) return;
    let active = true;
    let loading = false;
    const updateNotifications = async () => {
      if (loading || document.visibilityState === 'hidden') return;
      loading = true;
      try {
        const result = await handleResponse<NotificationsResponse>(await fetch('/api/platform/notifications', { signal: AbortSignal.timeout(10_000) }));
        if (active) setData(current => current?.user.id === data.user.id ? { ...current, notifications: result.notifications } : current);
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

  async function generate() {
    if (busy || savePendingRef.current) return;
    if (generationRequirement) { setMessage(generationRequirement.message); return; }
    if (staySelection?.planned && !staySelection.planned.name.trim()) { setMessage('Enter the accommodation name or choose accommodation later.'); return; }
    if ((selectedLiveStayId || selectedStayId) && staysBusy) { setMessage('Wait for accommodation search to finish, or choose accommodation later.'); return; }
    if (!selectedDestination || !currencyResolved || typeof selectedDestination.latitude !== 'number' || typeof selectedDestination.longitude !== 'number') { setMessage('Resolve a specific destination city or town with coordinates and confirm its currency before generating.'); return; }
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
    if (regenerationTargetId && !window.confirm('AI regeneration uses 1 generation when the validated result is saved by TravelMate. Internal retries count as the same operation. Continue?')) return;
    const generationOwner = data!.user.id;
    savePendingRef.current = true; setBusy(true); setGenerationBusy(true); setMessage('Generating an AI itinerary uses 1 monthly generation when its validated result is saved.');
    try {
      const selectedStay = data?.listings.find((listing) => listing.id === selectedStayId);
      const selectedLiveStay = staySelection?.liveOffer || liveAccommodations.find((stay) => stay.id === selectedLiveStayId);
      if ((selectedStayId && !selectedStay) || (selectedLiveStayId && !selectedLiveStay)) {
        throw new Error('Your selected accommodation is no longer in the current results. Browse accommodations and select a stay again, or choose accommodation later.');
      }
      const options = { ...expenseAssumptions, currency, partyType, travelers, startDate, endDate, startingLocation: flightOrigin.trim() || undefined, destinationDetails, latitude: selectedDestination.latitude, longitude: selectedDestination.longitude, travelStyle, accommodationPreference, accommodationListingId: selectedStay?.id, plannedAccommodation: staySelection?.planned, selectedAccommodationQuote: staySelection?.quoteToken, externalAccommodation: selectedLiveStay ? { fetchedAt: selectedLiveStay.fetchedAt, total: selectedLiveStay.total, hotelId: selectedLiveStay.hotelId, offerId: selectedLiveStay.offerId, name: selectedLiveStay.name, address: selectedLiveStay.address, nightlyRate: selectedLiveStay.nightlyRate, currency: selectedLiveStay.currency, isLive: selectedLiveStay.isLive, selectionToken: selectedLiveStay.selectionToken } : undefined, preTripCosts: includePreTripCosts ? { airportTransferOutbound: preTripCosts.airportTransfers, airportTransferReturn: 0, passport: preTripCosts.passport, visaOrAuthorization: preTripCosts.visaOrAuthorization, departureTaxes: preTripCosts.departureTaxes, insurance: preTripCosts.insurance, other: preTripCosts.other } : undefined };
      const fingerprint = JSON.stringify({ destination: destination.trim(), budget, ...options, regenerationTargetId, regenerationRevision: regenerationTargetId ? savedTripOrigin?.updatedAt || itineraryBaselineRef.current : undefined });
      const idempotencyKey = await persistentGenerationKey(generationOwner, fingerprint);
      generationRequestRef.current = { fingerprint, key: idempotencyKey };
      const result = await fetchTripData(destination.trim(), budget, { ...options, idempotencyKey });
      if (generationOwner !== workspaceOwnerRef.current) return;

      setBudgetedStaySelection(staySelectionState);
      providerBaseRef.current = null;
      setItinerary(result.itinerary); setWeather(result.weather); setManualDirty(false); setActivityEditor(null); setGenerationFailed(false);
      try {
        const response = await api({
          action: regenerationTargetId ? 'update-trip' : 'save-trip', id: regenerationTargetId || undefined,
          destination: destination.trim(), destinationDetails, budget, currency, startDate, endDate, partyType, travelers,
          ...(!regenerationTargetId ? { interests: historicalInterests } : {}), itinerary: result.itinerary, weather: result.weather,
        });
        const saved = response.result as SavedTrip | undefined;
        if (generationOwner !== workspaceOwnerRef.current) return;
        if (saved?.id) {
          setEditingTripId(saved.status && saved.status !== 'active' ? null : saved.id); setVisitTripId(saved.id);
          navigation.replace({ tab: 'planner', tripId: saved.id, fromSavedTrips: !!savedTripOrigin });
        }
        const canonical = savedItinerary(saved?.itinerary);
        if (canonical) setItinerary(canonical);
        if (savedTripOrigin && saved?.id) setSavedTripOrigin({ ...savedTripOrigin, ...saved, itinerary: canonical || result.itinerary });
        setRegenerationTargetId(null);
        planningBaselineRef.current = planningFingerprint;
        itineraryBaselineRef.current = editableItineraryFingerprint(canonical || result.itinerary);
        await refresh().catch(() => setMessage('Trip saved. The saved-trip list could not refresh; reopen Saved trips to retry.'));
        const providerMessage = result.itinerary.days.some(day => day.planningStatus === 'incomplete') ? 'Some days need more activities.' : result.itinerary.source === 'mock' ? 'Demo plan with sample activities and estimates.' : 'Your plan is ready.';
        setMessage(`${providerMessage} ${regenerationTargetId ? 'Saved as a new version.' : 'Saved to your trips.'}`);
      } catch (saveError) {
        if (generationOwner !== workspaceOwnerRef.current) return;
        setManualDirty(true);
        await refresh().catch(() => undefined);
        setMessage(`The itinerary was generated, but automatic saving failed: ${saveError instanceof Error ? saveError.message : 'unknown save error'}. A browser draft will be kept until you save it.`);
      }
    } catch (error) {
      if (generationOwner !== workspaceOwnerRef.current) return;
      announcePlanLimit(error);
      if (error instanceof ApiError && error.code === 'GENERATION_ENDED' && generationRequestRef.current && data) await forgetGenerationKey(data.user.id, generationRequestRef.current.fingerprint);
      setGenerationFailed(true); setMessage(error instanceof Error ? error.message : 'Generation failed. Your current plan is unchanged; please retry.');
    }
    finally { savePendingRef.current = false; setBusy(false); setGenerationBusy(false); }
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
      if (manualDirty && itinerary?.grounding) { if (announce) setMessage("Save manual changes before refreshing photos."); return; }
      const requestedPlan = itinerary;
      const refreshed = await refreshItineraryDayImages(itinerary?.destination || destination.trim(), day, itinerary || undefined);
      const refreshedDay = refreshed.day;
      setItinerary((current) => current && current === requestedPlan ? { ...current, groundingProof: refreshed.groundingProof || current.groundingProof, days: current.days.map((item) => item.day === refreshedDay.day ? refreshedDay : item) } : current);
      setSelectedDay((current) => current === day ? refreshedDay : current);
      if (announce) setMessage(`Activity photos for Day ${day.day} checked against place-linked Wikimedia Commons sources; missing photos retain placeholders.`);
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
    const owner = workspaceOwnerRef.current;
    setBusy(true); setMessage('');
    try {
      const response = await api(body);
      if (owner !== workspaceOwnerRef.current) return true;
      const updated = response.result as SavedTrip | undefined;
      if (updated?.id && ['active', 'completed', 'archived'].includes(updated.status)) {
        setData(current => current?.user.id === owner ? { ...current, trips: current.trips.map(trip => trip.id === updated.id ? { ...trip, ...updated } : trip) } : current);
        setSavedTripOrigin(current => current?.id === updated.id ? { ...current, ...updated } : current);
        if (updated.id === editingTripId && updated.status !== 'active') setEditingTripId(null);
      }
      try { await refresh(); }
      catch { if (sectionVersion === sectionVersionRef.current) setMessage(`${success} The list could not be refreshed; reload to update it.`); return true; }
      const restored = response.result as { legacyContextRecovered?: boolean } | undefined;
      const legacyNote = restored?.legacyContextRecovered ? ' This older snapshot did not record geographic details or interests; those fields were cleared.' : '';
      if (sectionVersion === sectionVersionRef.current) setMessage(success + legacyNote);
      return true;
    }
    catch (error) { if (sectionVersion === sectionVersionRef.current) setMessage(error instanceof Error ? error.message : 'Action failed.'); return false; }
    finally { setBusy(false); }
  }

  async function sendReport(title: string, details: string): Promise<boolean> {
    // A report is saved by the POST; a workspace refresh must not turn that
    // successful write into an apparent failure and encourage duplicate reports.
    await api({ action: 'submit-report', title, details });
    return true;
  }

  async function saveEditedTrip(trip: SavedTrip, plan: ItineraryResponse): Promise<void> {
    const owner = workspaceOwnerRef.current;
    const sectionVersion = sectionVersionRef.current;
    if (!owner || trip.userId !== owner) throw new Error('Your account changed. Reopen the trip to continue.');
    setBusy(true);
    try {
      const response = await api({ action: 'update-trip-itinerary', id: trip.id, itinerary: plan });
      if (owner !== workspaceOwnerRef.current) throw new Error('Your account changed. Reopen the trip to continue.');
      const saved = response.result as SavedTrip | undefined;
      const canonical = savedItinerary(saved?.itinerary);
      if (!saved || saved.id !== trip.id || !canonical) throw new Error('The server did not confirm the saved itinerary. Retry your changes.');
      setData(current => current?.user.id === owner ? { ...current, trips: current.trips.map(existing => existing.id === saved.id ? { ...existing, ...saved } : existing) } : current);
      setSavedTripOrigin(current => current?.id === saved.id ? { ...current, ...saved, itinerary: canonical } : current);
      if (editingTripId === saved.id && !manualDirty) { setItinerary(canonical); setSelectedDay(null); }
      setMessage('Trip changes saved.');
      void refresh().catch(() => {
        if (owner === workspaceOwnerRef.current && sectionVersion === sectionVersionRef.current) setMessage('Trip changes saved. The list could not be refreshed; reload to update it.');
      });
    } finally { setBusy(false); }
  }

  async function deleteSavedTrip(trip: SavedTrip, onError: (message: string) => void): Promise<boolean> {
    const owner = workspaceOwnerRef.current;
    setBusy(true); setMessage('');
    try {
      await api({ action: 'delete-trip', id: trip.id });
      if (owner !== workspaceOwnerRef.current) return true;
      setData(current => current?.user.id === owner ? {
        ...current, trips: current.trips.filter(item => item.id !== trip.id),
        itineraryVersions: current.itineraryVersions.filter(item => item.tripId !== trip.id),
        tripsPage: current.tripsPage ? { ...current.tripsPage, total: Math.max(0, current.tripsPage.total - 1), nextCursor: current.tripsPage.nextCursor === trip.id ? null : current.tripsPage.nextCursor } : undefined,
      } : current);
      if (editingTripId === trip.id) setEditingTripId(null);
      try { await refresh(); setMessage('Archived trip permanently deleted.'); }
      catch { setMessage('Archived trip permanently deleted. The remaining trips could not be refreshed; reload to update the list.'); }
      return true;
    } catch (error) {
      const failure = error instanceof Error ? error.message : 'Could not delete this trip. Please try again.';
      if (owner === workspaceOwnerRef.current) { onError(failure); setMessage(failure); }
      return false;
    } finally { setBusy(false); }
  }

  function acceptTripSave(saved: SavedTrip | undefined, updatePlanningBaseline: boolean) {
    if (!saved?.id || !itinerary) throw new Error('Trip saving could not be confirmed.');
    const canonical = savedItinerary(saved.itinerary) || itinerary;
    const unchanged = latestDraftRef.current.itinerary === itineraryFingerprint;
    setEditingTripId(saved.status && saved.status !== 'active' ? null : saved.id); setVisitTripId(saved.id);
    navigation.replace({ ...navigation.view, tab: 'planner', tripId: saved.id });
    if (unchanged) {
      setItinerary(canonical); setManualDirty(false);
      if (data?.user.id) removeBrowserStorage(`travelmate-itinerary-draft:${data.user.id}`);
    }
    if (savedTripOrigin) setSavedTripOrigin({ ...savedTripOrigin, ...saved, itinerary: canonical });
    setRegenerationTargetId(null);
    if (updatePlanningBaseline) planningBaselineRef.current = planningFingerprint;
    itineraryBaselineRef.current = editableItineraryFingerprint(canonical);
    if (editingTripId) {
      setLastSuccessfulUpdate({ planning: planningBaselineRef.current || planningFingerprint, itinerary: itineraryBaselineRef.current });
      setSaveToast({ id: ++saveToastSequenceRef.current, kind: 'success' });
    }
  }

  function changedExpenseEstimates(plan: ItineraryResponse) {
    const restored = restoredExpenseAssumptions(plan);
    return Object.fromEntries(Object.entries(expenseAssumptions).filter(([key,value]) => value !== undefined && value !== restored[key as keyof ExpenseAssumptions]));
  }
  async function saveCurrentTrip() {
    if (!itinerary || savePendingRef.current) return;
    if (itinerary.partyType !== partyType || itinerary.travelers !== travelers) { setMessage('Traveling mode or traveler count has changed. Generate an updated plan before saving costs for the new party. Your recorded activities and edits are preserved.'); return; }
    savePendingRef.current = true;
    setBusy(true); setSavingTrip(true); setSaveToast(null); setMessage('');
    try {
      const response = await api({ action: editingTripId ? 'update-trip' : 'save-trip', id: editingTripId || undefined, destination, destinationDetails, budget, currency, startDate, endDate, partyType, travelers, ...(!editingTripId ? { interests: historicalInterests } : {}), itinerary: withPlanningPreferences(itinerary), expenseAssumptions: changedExpenseEstimates(itinerary), weather });
      const saved = response.result as SavedTrip | undefined;
      acceptTripSave(saved, true);
      await refresh().catch(() => undefined);
      if (!editingTripId) setMessage('Trip saved. Open Saved trips to view or edit it.');
    } catch (error) {
      if (editingTripId) { setLastSuccessfulUpdate(null); setSaveToast({ id: ++saveToastSequenceRef.current, kind: 'error' }); }
      else setMessage(error instanceof Error ? error.message : 'Trip could not be saved.');
    }
    finally { savePendingRef.current = false; setSavingTrip(false); setBusy(false); }
  }

  async function retryDays(dayIndices: number[], includeNearby: boolean) {
    if (!itinerary || busy || savePendingRef.current) return;
    const owner = data?.user.id;
    const retryFingerprint = itineraryFingerprint;
    setBusy(true); setRetryingDay(dayIndices.length === 1 ? dayIndices[0] : -1); setMessage('Checking for additional verified places…');
    try {
      const result = await retryItineraryDays(itinerary, dayIndices, includeNearby, providerBaseRef.current);
      if (owner !== workspaceOwnerRef.current || latestDraftRef.current.itinerary !== retryFingerprint) return;
      providerBaseRef.current = result.itinerary;
      setItinerary(result.itinerary); setManualDirty(true);
      setMessage(result.added ? `Added ${result.added} verified ${result.added === 1 ? 'stop' : 'stops'}. Existing activities are preserved. Save your changes when ready.` : 'No additional places fit this day within the selected scope. Your existing activities and draft are preserved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not refresh this day. Your draft is preserved; please retry.');
    } finally { setBusy(false); setRetryingDay(null); }
  }
  async function retryDay(dayIndex: number, includeNearby: boolean) {
    return retryDays([dayIndex], includeNearby);
  }

  async function saveManualChanges() {
    if (!itinerary || savePendingRef.current) return;
    if (itinerary.partyType !== partyType || itinerary.travelers !== travelers) { setMessage('Traveling mode or traveler count has changed. Generate an updated plan before saving costs for the new party. Your recorded activities and edits are preserved.'); return; }
    savePendingRef.current = true;
    setBusy(true); setSavingTrip(true); setSaveToast(null); setMessage('');
    try {
      const response = editingTripId
        ? await api({ action: 'update-trip-itinerary', id: editingTripId, itinerary, providerBase: providerBaseRef.current ?? undefined, planningPreferences: withPlanningPreferences(itinerary).preferences, expenseAssumptions: changedExpenseEstimates(itinerary) })
        : await api({ action: 'save-trip', destination, destinationDetails, budget, currency, startDate, endDate, partyType, travelers, ...(!editingTripId ? { interests: historicalInterests } : {}), itinerary: withPlanningPreferences(itinerary), providerBase: providerBaseRef.current ?? undefined, weather });
      const saved = response.result as SavedTrip | undefined;
      acceptTripSave(saved, !editingTripId);
      setSelectedDay(null);
      await refresh().catch(() => undefined);
      if (!editingTripId) setMessage('Edited itinerary saved to your trips.');
    } catch (error) {
      if (editingTripId) { setLastSuccessfulUpdate(null); setSaveToast({ id: ++saveToastSequenceRef.current, kind: 'error' }); }
      else setMessage(error instanceof Error ? error.message : 'Manual changes could not be saved.');
    }
    finally { savePendingRef.current = false; setSavingTrip(false); setBusy(false); }
  }

  function submitActivity(form: HTMLFormElement) {
    if (!itinerary || !activityEditor) return;
    const fields = new FormData(form);
    const draft = {
      time: String(fields.get('time') || ''),
      durationMinutes: fields.get('durationMinutes') ? Number(fields.get('durationMinutes')) : undefined,
      travelMinutes: fields.get('travelMinutes') ? Number(fields.get('travelMinutes')) : undefined,
      location: String(fields.get('location') || ''),
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
    try {
      setItinerary(moveActivity(itinerary, dayIndex, activityIndex, direction)); setManualDirty(true); setSelectedDay(null);
      setMessage('Activity order and suggested times updated with travel buffers. Save your changes. Legacy visits use a 30-minute estimate; review their durations.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Activity order could not be updated.'); }
  }

  function startNewTrip() {
    if (manualDirty && !window.confirm('Start a new trip? Your current unsaved edits remain available in browser draft recovery.')) return;
    if (data && generationRequestRef.current && !generationBusy) { void forgetGenerationKey(data.user.id, generationRequestRef.current.fingerprint); generationRequestRef.current = null; }
    providerBaseRef.current = null;
    const today = localDateInputValue();
    setSavedTripOrigin(null); planningBaselineRef.current = null;
    itineraryBaselineRef.current = null; setLastSuccessfulUpdate(null); setSaveToast(null);
    setEditingTripId(null); setVisitTripId(null); setRegenerationTargetId(null); setVisitTripId(null); setItinerary(null); setWeather(null); setManualDirty(false);
    setStaySelectionState(null); setGenerationFailed(false);
    setRestoredStaySelection(null);
    setHistoricalInterests([]); setTravelStyle('balanced'); setAccommodationPreference('no preference');
    setFlightOrigin(''); setPreTripCosts(EMPTY_PRE_TRIP_COSTS); setIncludePreTripCosts(false);
    changeDestinationInput(''); setStartDate(today); setEndDate(addCalendarDays(today, 6)); setPartyType('solo'); setTravelers(1);
    setTab('planner', { tab: 'planner' }); setMessage('');
  }

  function applyLoadedTrip(trip: SavedTrip, keepPlan: boolean, owner: string | null) {
      providerBaseRef.current = null;
      const recordedPlan = savedItinerary(trip.itinerary);
      const plan = recordedPlan && !recordedPlan.grounding ? { ...recordedPlan, partyType: recordedPlan.partyType ?? trip.partyType, travelers: recordedPlan.travelers ?? trip.travelers } : recordedPlan;
      if (!plan) return;
      capturePlanningBaselineRef.current = true;
      itineraryBaselineRef.current = editableItineraryFingerprint(plan);
      setLastSuccessfulUpdate(null); setSaveToast(null);
      setStaySelectionState(null);
      setRestoredStaySelection({ destination: trip.destination, selection: savedStaySelection(plan) });
      const draftDates = keepPlan ? { startDate: trip.startDate, endDate: trip.endDate, movedForward: false } : regenerationDraftDates(trip.startDate, trip.endDate);
      setBudget(trip.budget); setStartDate(draftDates.startDate); setEndDate(draftDates.endDate);
      setTravelers(trip.partyType === 'solo' ? 1 : trip.partyType === 'couple' ? 2 : trip.travelers); setPartyType(trip.partyType);
      setHistoricalInterests(trip.interests ?? []); setEditingTripId(trip.status === 'active' ? trip.id : null);
      setRegenerationTargetId(keepPlan ? null : trip.id);
      restoreDestination(trip, plan.preferences?.transportation || '');
      const restoredPreTrip = plan.selectedTravelCosts?.preTrip;
      setFlightOrigin(plan.grounding?.startingLocation || restoredPreTrip?.startingLocation || '');
      setExpenseAssumptions(restoredExpenseAssumptions(plan));
      setPreTripCosts(restoredPreTrip ? { airportTransfers: restoredPreTrip.airportTransferOutbound + restoredPreTrip.airportTransferReturn, passport: restoredPreTrip.passport, visaOrAuthorization: restoredPreTrip.visaOrAuthorization, departureTaxes: restoredPreTrip.departureTaxes, insurance: restoredPreTrip.insurance, other: restoredPreTrip.other } : EMPTY_PRE_TRIP_COSTS);
      setIncludePreTripCosts(Boolean(restoredPreTrip?.total));
      setTravelStyle(plan.preferences?.travelStyle || 'balanced');
      setAccommodationPreference(plan.preferences?.accommodation || 'no preference');
      setVisitTripId(keepPlan ? trip.id : null); setItinerary(keepPlan ? plan : null); setWeather(keepPlan && trip.weather && typeof trip.weather === 'object' ? trip.weather as WeatherData : null); setManualDirty(false); setActivityEditor(null); setSelectedDay(null); setGenerationFailed(false);
      setViewedTripMap(keepPlan && owner ? { owner, tripId: trip.id, destination: trip.destination, point: tripMapDestination(trip, plan.grounding?.destination) } : null);
      generationRequestRef.current = null;
  }

  function backToSavedTrips() {
    if (busy || generationBusy || !savedTripOrigin) return;
    if (tab !== 'bookings' && hasUnsavedTripChanges()) { setLeaveDialogOpen(true); return; }
    if (manualDirty) {
      setManualDirty(false);
      if (data?.user.id) removeBrowserStorage(`travelmate-itinerary-draft:${data.user.id}`);
    }
    returnToSavedTrips();
  }

  function returnToSavedTrips(discard = false) {
    if (discard && savedTripOrigin) {
      // Restore the latest saved version locally; never write discarded edits.
      const latest = data?.trips.find(trip => trip.id === (visitTripId || savedTripOrigin.id));
      applyLoadedTrip(latest && savedItinerary(latest.itinerary) ? latest : savedTripOrigin, true, workspaceOwnerRef.current);
      if (data?.user.id) removeBrowserStorage(`travelmate-itinerary-draft:${data.user.id}`);
    }
    setLeaveDialogOpen(false); setSaveToast(null);
    restoreSavedTripsRef.current = true;
    setSavedTripsVisited(true);
    sectionVersionRef.current += 1;
    setMessage('');
    if (!navigation.confirmPending()) navigation.returnTo({ tab: 'bookings' });
  }

  async function loadTrip(summary: SavedTrip, keepPlan = true, routeView?: ItineraryView) {
    const owner = workspaceOwnerRef.current;
    const fromSavedTrips = routeView ? routeView.tab === 'bookings' || !!routeView.fromSavedTrips : tab === 'bookings';
    const returnState = fromSavedTrips ? { scrollY: window.scrollY, opener: document.activeElement instanceof HTMLElement ? document.activeElement : null } : null;
    setBusy(true);
    try {
      const trip = savedItinerary(summary.itinerary) ? summary : (await handleResponse<TripDetailResponse>(await fetch(`/api/platform/trips/${encodeURIComponent(summary.id)}`, { signal: AbortSignal.timeout(15_000) }))).trip;
      if (owner !== workspaceOwnerRef.current) return;
      if (trip.id !== summary.id) throw new Error('The saved itinerary did not match the selected trip. Please try again.');
      const plan = savedItinerary(trip.itinerary);
      if (!plan) { setMessage('This saved trip does not contain a usable itinerary.'); return; }
      applyLoadedTrip(trip, keepPlan, owner);
      setSavedTripOrigin(fromSavedTrips ? trip : null);
      if (!routeView) savedTripsReturnRef.current = returnState;
      const draftDates = regenerationDraftDates(trip.startDate, trip.endDate);
      if (!routeView) setTab(fromSavedTrips && keepPlan ? 'bookings' : 'planner', fromSavedTrips && keepPlan
        ? { tab: 'bookings', tripId: trip.id, fromSavedTrips: true }
        : { tab: 'planner', tripId: keepPlan ? trip.id : undefined, fromSavedTrips });
      setMessage(trip.status === 'completed' ? 'Completed trip. Changes save as a new trip.' : keepPlan ? '' : draftDates.movedForward ? `Past travel dates. Review the new draft dates: ${draftDates.startDate}–${draftDates.endDate}. Your saved plan is unchanged.` : 'No itinerary yet. Generate a plan to continue.');
    } catch (error) {
      if (owner !== workspaceOwnerRef.current) return;
      if (isAuthenticationError(error)) router.replace('/account/appeal');
      else setMessage(error instanceof Error ? error.message : 'This saved trip could not be loaded.');
    } finally { setBusy(false); }
  }

  const applyRouteView = useEffectEvent(() => {
    if (tab === 'bookings') {
      setSavedTripsVisited(true);
      restoreSavedTripsRef.current = true;
    }
    const tripId = navigation.view.tripId;
    if ((tab !== 'planner' && tab !== 'budget' && tab !== 'bookings') || !tripId || visitTripId === tripId || !data || busy || routeLoadRef.current === tripId) return;
    const summary = data.trips.find(trip => trip.id === tripId);
    routeLoadRef.current = tripId;
    // A refreshed URL loads once. Same-trip overview/day transitions use memory.
    void loadTrip(summary || { id: tripId } as SavedTrip, true, navigation.view);
  });
  useEffect(() => {
    const timer = window.setTimeout(() => applyRouteView(), 0);
    return () => window.clearTimeout(timer);
  }, [tab, navigation.view, visitTripId, data, busy]);

  const loadVersions = useCallback(async (tripId: string, cursor?: string) => {
    const owner = workspaceOwnerRef.current;
    try {
      const suffix = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
      const result = await handleResponse<TripVersionsResponse>(await fetch(`/api/platform/trips/${encodeURIComponent(tripId)}/versions${suffix}`, { signal: AbortSignal.timeout(15_000) }));
      if (owner !== workspaceOwnerRef.current) return;
      setData(current => current?.user.id === owner ? { ...current, itineraryVersions: [...(current.itineraryVersions || []).filter(version => cursor ? !result.versions.some(next => next.id === version.id) : version.tripId !== tripId), ...result.versions] } : current);
      setVersionPages(current => ({ ...current, [tripId]: result.page }));
    } catch (error) {
      if (isAuthenticationError(error)) router.replace('/account/appeal');
      throw error;
    }
  }, [router]);

  async function loadMoreTrips() {
    if (!data?.tripsPage?.nextCursor) return;
    const cursor = data.tripsPage.nextCursor;
    const owner = workspaceOwnerRef.current;
    setBusy(true);
    try {
      const result = await handleResponse<PlatformResponse>(await fetch(`/api/platform?scope=traveler&summary=true&cursor=${encodeURIComponent(cursor)}`, { signal: AbortSignal.timeout(15_000) }));
      if (owner !== workspaceOwnerRef.current) return;
      setData(current => current?.user.id === owner ? { ...current, trips: [...current.trips.filter(trip => !result.trips.some(next => next.id === trip.id)), ...result.trips], tripsPage: result.tripsPage } : current);
    } catch (error) {
      if (isAuthenticationError(error)) router.replace('/account/appeal');
      else setMessage(error instanceof Error ? error.message : 'More trips could not be loaded.');
    } finally { setBusy(false); }
  }

  async function saveProfile(form: HTMLFormElement) {
    const fields = new FormData(form);
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: fields.get('name'), phone: fields.get('phone'), bio: fields.get('bio'), avatarUrl: fields.get('avatarUrl') }),
      });
      await handleResponse<ProfileResponse>(response);
      await refresh();
      setMessage('Profile updated.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Profile update failed.'); }
    finally { setBusy(false); }
  }

  async function logout() {
    setProfileMenuOpen(false);
    setMessage('');
    try { router.replace(signedOutLocation(await signOut())); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not sign out. Please try again.'); }
  }
  if (!data) return <DashboardLoadState label="your TravelMate workspace" variant={tab === 'planner' ? 'planner' : 'traveler'} screen={tab} error={loadError} onRetry={() => { setLoadError(''); void loadInitial(); }} />;
  const tripDays = Math.floor((new Date(`${endDate}T00:00:00.000Z`).getTime() - new Date(`${startDate}T00:00:00.000Z`).getTime()) / 86_400_000) + 1;
  const maximumEndDate = startDate && Number.isFinite(Date.parse(startDate)) ? addCalendarDays(startDate, 30) : undefined;
  const datesReady = Number.isFinite(tripDays) && tripDays >= 1 && tripDays <= 31;
  const budgetReady = Number.isFinite(budget) && budget > 0 && budget <= 1_000_000_000 && hasValidCurrencyPrecision(budget, currency);
  const generationRequirements = (() => {
    const requirements: { message: string; field: string; action: string }[] = [];
    if (!selectedDestination) requirements.push({ message: 'Choose and confirm a destination to continue.', field: 'destination-search', action: 'Choose destination' });
    else {
      if (accommodationNeedsArea || !Number.isFinite(selectedDestination.latitude) || !Number.isFinite(selectedDestination.longitude)) requirements.push({ message: 'Choose a specific city or town to continue.', field: 'destination-search', action: 'Choose destination' });
      if (!currencyResolved) requirements.push({ message: contextBusy ? 'Detecting the destination currency…' : 'Confirm the destination currency to continue.', field: 'trip-currency', action: 'Review currency' });
    }
    if (!datesReady) requirements.push({ message: 'Choose start and end dates for a trip of 1–31 days.', field: !startDate ? 'trip-start-date' : 'trip-end-date', action: 'Review dates' });
    else if (startDate < localDateInputValue()) requirements.push({ message: 'Choose a start date today or later.', field: 'trip-start-date', action: 'Review dates' });
    if (!budgetReady) {
      const message = budget > 1_000_000_000 ? 'Enter a total trip budget of 1,000,000,000 or less.'
        : budget > 0 && !hasValidCurrencyPrecision(budget, currency) ? `${currency} budgets must use ${currencyFractionDigits(currency) === 0 ? 'whole currency units' : `no more than ${currencyFractionDigits(currency)} decimal places`}.`
          : 'Enter a total trip budget greater than zero to continue.';
      requirements.push({ message, field: 'trip-budget', action: budget > 0 ? 'Review budget' : 'Add budget' });
    }
    if (!Number.isInteger(travelers) || travelers < (partyType === 'solo' ? 1 : 2) || travelers > 20) requirements.push({ message: 'Choose a valid number of travelers for your group.', field: 'trip-travelers', action: 'Review travelers' });
    if (staySelection?.planned && !staySelection.planned.name.trim()) requirements.push({ message: 'Enter the accommodation name or choose accommodation later.', field: 'trip-accommodation', action: 'Review accommodation' });
    else if ((selectedLiveStayId || selectedStayId) && staysBusy) requirements.push({ message: 'Wait for the selected accommodation to finish loading, or choose it later.', field: 'trip-accommodation', action: 'Review accommodation' });
    return requirements;
  })();
  const generationRequirement = generationRequirements[0] ?? null;
  const reviewGenerationRequirement = (fieldId: string) => {
    const field = document.getElementById(fieldId);
    if (!field) return;
    field.scrollIntoView({ block: 'center', behavior: 'instant' });
    if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) field.focus({ preventScroll: true });
    else (field.querySelector<HTMLElement>('input:not(:disabled)') || field.querySelector<HTMLElement>('button:not(:disabled)'))?.focus({ preventScroll: true });
  };
  const budgetItinerary = navigation.view.tripId && visitTripId !== navigation.view.tripId ? null : itinerary;
  const budgetReviewOptions = {
    party: { partyType, travelers },
    budget: itinerary && budgetReady && currency === itinerary.currency ? budget : undefined,
    accommodation: staySelection && staySelectionState !== budgetedStaySelection ? {
      selected: staySelection.value !== 'later',
      name: staySelection.planned?.name || staySelection.preview?.name,
      amount: staySelection.confirmedQuote?.isLive ? staySelection.confirmedQuote.budgetTotal ?? staySelection.confirmedQuote.total : staySelection.liveOffer?.isLive ? staySelection.liveOffer.total : undefined,
      currency: staySelection.confirmedQuote?.currency ?? staySelection.liveOffer?.currency ?? currency,
    } : undefined,
  };
  const localMunicipality = selectedDestination?.name;
  const stayOptions = currency === 'PHP' && selectedDestination?.countryCode === 'PH' ? data.listings.filter((listing) => listing.category === 'stay' && listing.status === 'approved' && listing.municipality.toLowerCase() === localMunicipality?.toLowerCase()) : [];
  const preTripTotal = preTripCosts.airportTransfers + preTripCosts.passport + preTripCosts.visaOrAuthorization + preTripCosts.departureTaxes + preTripCosts.insurance + preTripCosts.other;
  const updatePreTripAmount = (field: keyof PreTripCostDraft, value: string) => {
    const amount = value === '' ? 0 : Number(value);
    setPreTripCosts((current) => ({ ...current, [field]: Number.isFinite(amount) && amount >= 0 ? amount : 0 }));
  };
  const today = localDateInputValue();
  const upcomingTrip = [...data.trips].filter((trip) => trip.status === 'active' && trip.endDate >= today).sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  const userInitials = data.user.name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'TM';
  const isSavedItineraryView = tab === 'bookings' && !!navigation.view.tripId && navigation.view.tripId === visitTripId && !!itinerary;
  const viewedSavedTrip = isSavedItineraryView
    ? data.trips.find(trip => trip.id === visitTripId) || (savedTripOrigin?.id === visitTripId ? savedTripOrigin : null)
    : null;
  const currentTabCopy = tab === 'planner' && itinerary
    ? { title: 'Review and shape your trip', description: 'Inspect the generated days, edit activities, check conditions, and save only when the plan is ready.' }
    : tab === 'planner' && editingTripId
      ? { title: 'Regenerate a saved trip', description: 'The saved details are loaded. Adjust them, generate a fresh itinerary, then choose Update saved trip.' }
      : TAB_COPY[tab];
  const editorDay = activityEditor && itinerary ? itinerary.days[activityEditor.dayIndex] : undefined;
  const editorActivity = activityEditor?.activityIndex !== null && activityEditor?.activityIndex !== undefined ? editorDay?.activities[activityEditor.activityIndex] : undefined;
  const changePartyType = (nextPartyType: PartyType) => {
    setPartyType(nextPartyType);
    setTravelers(nextPartyType === 'solo' ? 1 : nextPartyType === 'couple' ? 2 : (partyType === 'family' || partyType === 'friends') && Number.isInteger(travelers) && travelers >= 2 && travelers <= 20 ? travelers : nextPartyType === 'family' ? 4 : 3);
    setStaySelectionState(null);
    setMessage(itinerary ? 'Party details changed. Your recorded itinerary and edits are preserved. Generate an updated plan before saving costs for the new party.' : '');
  };
  const changeCurrency = (nextCurrency: CurrencyCode) => {
    if (nextCurrency === currency) return;
    setBudgetInput('');
    setExpenseAssumptions({});
    setPreTripCosts(EMPTY_PRE_TRIP_COSTS); setIncludePreTripCosts(false);
    setManualCurrency(nextCurrency);
    setStaySelectionState(null);
    setItinerary(null);
    setManualDirty(false);
    setMessage(`Enter a new budget and any expense estimates in ${nextCurrency}.`);
  };
  const confirmDestination = async (location: NonNullable<typeof selectedDestination>, preserveBrowsing = false) => {
    const changed = selectedDestination?.id !== location.id;
    if (!await selectDestination(location, preserveBrowsing)) return false;
    if (changed) {
    setBudgetInput('');
    setExpenseAssumptions({});
    setPreTripCosts(EMPTY_PRE_TRIP_COSTS); setIncludePreTripCosts(false);
    }
    setStaySelectionState(null);
    setRestoredStaySelection(null);
    setItinerary(null);
    setWeather(null);
    setMessage('');
    return true;
  };
  return (
    <ConversionPreference.Provider value={conversionEnabled}><ConversionLoading.Provider value={exchangeBusy}><div ref={pageRef} inert={isSavedItineraryView || undefined} className={`${styles.theme} ${tab === 'overview' ? styles.homeTheme : ''} ${tab === 'planner' && itinerary ? styles.itineraryTheme : ''} traveler-dashboard min-h-screen w-full max-w-full overflow-x-clip bg-[#0b1d1a] pt-[calc(3.5rem+max(0.5rem,env(safe-area-inset-top)))] sm:pt-[calc(4rem+max(1rem,env(safe-area-inset-top)))] text-slate-100`}>
      <a href="#traveler-main-content" className="sr-only z-[100] bg-[#f1ead8] px-4 py-2 font-bold text-[#14231f] focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to trip workspace</a>
      {recoveryDraft && recoveryDraft.trip.userId === data.user.id && <RestoreDraftDialog destination={recoveryDraft.trip.destination} savedAt={recoveryDraft.savedAt} returnFocusRef={workspaceHeadingRef} onClose={() => setRecoveryDraft(null)} onRestore={restoreDraft}/>}
      <header className="fixed inset-x-0 top-0 z-40 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-6 sm:pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex h-14 w-full max-w-[1380px] items-center justify-between gap-3 border border-white/15 bg-[#102824]/88 px-3 text-white shadow-[0_18px_50px_rgba(8,24,22,.22)] backdrop-blur-xl sm:h-16 sm:px-6">
          <Link href="/" className="group flex min-h-11 shrink-0 items-center gap-2 font-semibold sm:gap-3" aria-label="TravelMate home">
            <span className="grid size-8 place-items-center bg-[#ffcf70] text-[#102824] transition-transform duration-500 group-hover:-rotate-6 sm:size-9"><Compass size={20} strokeWidth={2.2} className="size-[18px] sm:size-5"/></span>
            <span className="text-base sm:text-lg">TravelMate</span>
          </Link>
          <Popover.Root open={profileMenuOpen} onOpenChange={setProfileMenuOpen} modal={false}>
            <Popover.Trigger asChild>
              <button type="button" aria-label={`Open profile menu for ${data.user.name}`} className="flex size-11 shrink-0 items-center justify-center gap-2 border border-white/15 bg-white/[0.04] p-1.5 text-left transition-colors hover:border-[#ffcf70]/50 hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffcf70] sm:h-auto sm:w-auto sm:min-w-0 sm:justify-start sm:gap-3 sm:pr-3">
                <span className="grid size-7 shrink-0 place-items-center bg-[#ffcf70] text-[10px] font-black text-[#102824] sm:size-9 sm:text-xs">{userInitials}</span>
                <span className="hidden min-w-0 sm:block"><strong className="block max-w-40 truncate text-sm font-bold text-white">{data.user.name}</strong><span className="block max-w-48 truncate text-[10px] text-white/60">{data.user.email}</span></span>
                <UserRound size={15} className="hidden shrink-0 text-[#ffcf70] sm:block" />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content aria-label="Profile menu" side="bottom" align="end" sideOffset={8} collisionPadding={12} className={styles.profilePopover}>
                <button type="button" onClick={() => { setProfileMenuOpen(false); setTab('profile'); }} className={styles.profileMenuItem}><UserRound size={17} aria-hidden="true"/>Account settings</button>
                <button type="button" onClick={() => void logout()} className={styles.profileMenuItem}><LogOut size={17} aria-hidden="true"/>Sign out</button>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1600px] grid-cols-[minmax(0,1fr)] gap-0 px-4 lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-10 lg:px-6 xl:gap-14">
        <aside className="min-w-0 max-w-[calc(100vw-2rem)] py-4 lg:sticky lg:top-24 lg:max-w-none lg:self-start lg:py-8">
          <div data-traveler-rail className="lg:flex lg:h-[calc(100vh-144px)] lg:w-[248px] lg:flex-col">
            <nav aria-label="Traveler workspace" className="traveler-mobile-nav flex max-w-full snap-x gap-px overflow-x-auto border border-white/10 bg-white/10 p-px lg:flex-col lg:overflow-visible">
              {([['overview','Home',Home],['planner','Plan a trip',MapPin],['bookings','Saved trips',CalendarDays],['visited','Visited places',MapPin],['feedback','Feedback',MessageSquare],['notifications','Notifications',Bell]] as const).map(([id,label,Icon]) => {
                const active = tab === id;
                return <button key={id} aria-current={active?'page':undefined} onClick={() => { if (id === 'planner') startNewTrip(); else { setTab(id); } }} className={`group relative flex shrink-0 snap-start items-center gap-3 px-4 py-3.5 text-sm font-semibold transition-colors lg:w-full ${active?'bg-[#f1ead8] text-[#14231f]':'bg-[#0b1d1a] text-white/55 hover:bg-[#16302b] hover:text-white'}`}><span className={`absolute inset-y-0 left-0 w-0.5 ${active?'bg-amber-400':'bg-transparent'}`}/><Icon size={17}/>{label}{id === 'notifications' && data.notifications.filter((item) => !item.readAt).length > 0 && <span className="ml-auto bg-amber-300 px-1.5 text-[10px] font-black text-[#14231f]">{data.notifications.filter((item) => !item.readAt).length}</span>}</button>;
              })}
              <div className="hidden px-4 pb-2 pt-6 text-[10px] font-bold uppercase tracking-[0.16em] text-white/28 lg:block">Use with a plan</div>
              {([['budget','Budget review',WalletCards],['help','Help / User Guide',CircleHelp],['plan','My Plan',WalletCards]] as const).map(([id,label,Icon]) => <button key={id} type="button" aria-current={tab===id?'page':undefined} onClick={() => setTab(id)} className={`group relative flex shrink-0 snap-start items-center gap-3 px-4 py-3.5 text-sm font-semibold transition-colors lg:w-full ${tab===id?'bg-[#f1ead8] text-[#14231f]':'bg-[#0b1d1a] text-white/55 hover:bg-[#16302b] hover:text-white'}`}><span className={`absolute inset-y-0 left-0 w-0.5 ${tab===id?'bg-amber-400':'bg-transparent'}`}/><Icon size={17}/>{label}</button>)}
            </nav>
            <div className="mt-8 hidden border-t border-white/10 pt-5 lg:block"><p className="max-w-[23ch] text-xs leading-5 text-white/38">Start with Plan a trip. Budget review becomes useful after TravelMate creates your itinerary.</p></div>
          </div>
        </aside>

        <main id="traveler-main-content" tabIndex={-1} className="min-w-0 w-full max-w-[calc(100vw-2rem)] overflow-x-hidden pb-20 pt-5 outline-none lg:max-w-none lg:pt-10">
          {tab !== 'budget' && tab !== 'help' && tab !== 'plan' && <div style={tab === 'planner' && itinerary ? { display: 'none' } : undefined} className="mb-7 flex flex-col items-start gap-3 border-b border-white/10 pb-6 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div className="min-w-0 max-w-4xl"><h1 ref={workspaceHeadingRef} tabIndex={-1} className="break-words text-[clamp(2rem,4vw,3.75rem)] font-black leading-[0.96] tracking-[-0.05em] outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-4 focus-visible:ring-offset-[#0b1d1a]">{currentTabCopy.title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/52">{currentTabCopy.description}</p></div>
            <span className={`w-fit shrink-0 border px-3 py-2 text-[11px] font-bold tracking-wide ${data.user.emailVerified?'border-emerald-400/40 bg-emerald-400/10 text-emerald-200':'border-amber-300/40 bg-amber-300/10 text-amber-200'}`}>{data.user.emailVerified?'Email verified':'Email not verified'}</span>
          </div>}
          {message && !((tab === 'planner' && itinerary) || isSavedItineraryView) && <div role="status" aria-live="polite" className="mb-6 border-l-2 border-amber-300 bg-white/[0.055] px-4 py-3 text-sm text-white/80">{message}</div>}

          {tab === 'overview' && <TravelerJourneyOverview
            userName={data.user.name}
                        savedTripCount={data.tripsPage?.total ?? data.trips.length}
            currentPlan={itinerary ? { destination: itinerary.destination, days: itinerary.days.length } : null}
            upcomingTrip={upcomingTrip ? { destination: upcomingTrip.destination, startDate: upcomingTrip.startDate, endDate: upcomingTrip.endDate, travelers: upcomingTrip.travelers, budget: upcomingTrip.budget, currency: upcomingTrip.currency } : null}
            referenceCurrency={referenceCurrency}
            exchangeQuotes={exchangeQuotes}
            onStartPlanning={startNewTrip}
            onOpenCurrentPlan={() => setTab('planner')}
            onOpenUpcomingTrip={() => { if (upcomingTrip) loadTrip(upcomingTrip, true); }}
            onOpenSavedTrips={() => setTab('bookings')}
            onOpenBudget={() => setTab('budget')}
          />}

          {tab === 'planner' && <>
            {itinerary && savedTripOrigin && navigation.view.day === undefined && <button ref={backToSavedTripsRef} type="button" disabled={busy || generationBusy} onClick={backToSavedTrips} className={styles.savedTripsBack}><ArrowLeft size={16} aria-hidden="true"/>Back to saved trips</button>}
            {itinerary && <ItineraryWorkspace
              notice={message}
              headingRef={workspaceHeadingRef}
              selectedDayIndex={navigation.view.day === undefined ? null : itinerary.days.findIndex(day => day.day === navigation.view.day)}
              onViewDay={dayIndex => navigation.navigate({ tab: 'planner', tripId: visitTripId || editingTripId || undefined, fromSavedTrips: !!savedTripOrigin, day: itinerary.days[dayIndex].day })}
              onBackToOverview={navigation.backToOverview}
              itinerary={itinerary}
              weather={weather}
              manualDirty={manualDirty}
              editingTripId={editingTripId}
              busy={busy}
              savingTrip={savingTrip}
              updated={tripUpdated}
              travelers={travelers}
              party={{ partyType, travelers }}
              referenceCurrency={referenceCurrency}
              exchangeQuotes={exchangeQuotes}
              onSave={() => void (manualDirty ? saveManualChanges() : saveCurrentTrip())}
              onReviewBudget={() => setTab('budget')}
              onRetryDay={(dayIndex, includeNearby) => void retryDay(dayIndex, includeNearby)}
              onRetryIncompleteDays={() => void retryDays(itinerary.days.flatMap((day, index) => day.planningStatus === 'incomplete' ? [index] : []), false)}
              retryingDay={retryingDay}
              visitTripId={manualDirty ? null : visitTripId}
              onReorderActivity={reorderActivity}
              onEditActivity={(dayIndex, activityIndex) => setActivityEditor({ dayIndex, activityIndex })}
              onRemoveActivity={confirmRemoveActivity}
              onOpenDay={openDayDetails}
            />}

            <details ref={planningSettingsRef} open={!itinerary} className="my-4 text-sm"><summary hidden={!itinerary} className="cursor-pointer py-2 font-semibold">Trip planning settings</summary>
            {itinerary && <div className="mb-4 flex flex-wrap items-center gap-3"><p className="text-sm">{currentTabCopy.description}</p><span className={`w-fit shrink-0 border px-3 py-2 text-[11px] font-bold tracking-wide ${data.user.emailVerified?'border-emerald-400/40 bg-emerald-400/10 text-emerald-200':'border-amber-300/40 bg-amber-300/10 text-amber-200'}`}>{data.user.emailVerified?'Email verified':'Email not verified'}</span></div>}
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
                    <div className="flex min-w-0 items-start gap-3 border border-[#14231f]/15 bg-white/25 px-3 py-3"><WalletCards size={16} className="mt-0.5 shrink-0 text-[#b24d32]" /><span className="min-w-0 flex-1"><span className="block text-[10px] font-bold uppercase tracking-wider text-[#49635c]">Budget</span><strong className="mt-1 block leading-5 [overflow-wrap:anywhere]">{currencyResolved ? (budgetReady ? formatMoney(budget, currency) : 'Budget required') : 'Set after destination'}</strong></span></div>
                  </div>
                </div>
              </section>

              <section className="relative grid grid-cols-1 grid-flow-dense gap-px overflow-hidden border border-emerald-100/10 bg-emerald-100/10 xl:grid-cols-12 [&_input]:min-h-12 [&_select]:min-h-12 [&_input]:border-white/15 [&_select]:border-white/15 [&_label]:text-white/75">
                <article className="bg-[#14302a] p-5 sm:p-7 xl:col-span-7">
                  <div className="mb-7 flex items-start gap-4 border-b border-white/12 pb-5"><span className="grid h-11 w-11 shrink-0 place-items-center border border-cyan-300/35 bg-cyan-300/5 text-cyan-200"><MapPin size={19}/></span><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-cyan-200/70">01 · Start with the essentials</p><h2 className="mt-1 text-xl font-black tracking-[-0.03em]">Required trip details</h2><p className="mt-1 text-xs text-white/50">These fields give TravelMate enough information to build a plan.</p></div></div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <DestinationSelector selected={selectedDestination} onSelect={confirmDestination} onClear={()=>{changeDestinationInput('');setRestoredStaySelection(null);setStaySelectionState(null);setItinerary(null);setWeather(null);setMessage('');}} budget={budget} currency={currency} currencyResolved={currencyResolved} travelers={travelers} days={tripDays} interests="" />
                    <label className="text-xs font-medium text-slate-300">{partyBudgetLabel(partyType, travelers)}<input id="trip-budget" type="number" min={currencyStep(currency)} max="1000000000" step={currencyStep(currency)} value={budgetInput} placeholder="Enter total budget" onChange={e=>setBudgetInput(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-2 text-white transition hover:border-slate-600 focus:border-amber-400" /><span className="mt-1.5 block text-[11px] font-normal text-amber-200">{budget > 0 ? partyBudgetExplanation(partyType, travelers) : 'Enter your total trip budget to continue.'}</span>{budgetReady && currencyResolved && <ReferenceAmount amount={budget} currency={currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes} className="mt-1 block text-[11px] font-normal text-cyan-200"/>}</label>
                    <div className="text-xs font-medium text-slate-300"><div className="grid grid-cols-2 gap-2"><label>Destination currency<select id="trip-currency" value={selectedDestination&&currencyResolved?currency:''} disabled={!selectedDestination||contextBusy} onChange={e=>changeCurrency(e.target.value as CurrencyCode)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-white transition hover:border-slate-600 focus:border-amber-400 disabled:opacity-60"><option value="">{contextBusy?'Detecting...':selectedDestination?'Select':'Auto'}</option>{SUPPORTED_CURRENCIES.map(code=><option key={code} value={code}>{code} · {CURRENCY_NAMES[code]}</option>)}</select></label><label>Show equivalents in<select id="trip-reference-currency" value={conversionEnabled?referenceCurrency:''} onChange={e=>{setConversionEnabled(Boolean(e.target.value));writeBrowserStorage('travelmate-conversion-enabled',String(Boolean(e.target.value)));if(e.target.value)setReferenceCurrency(e.target.value as CurrencyCode);}} className="mt-1.5 w-full rounded-xl border border-cyan-700/70 bg-slate-950/80 px-3 py-2 text-white transition hover:border-cyan-500 focus:border-cyan-400"><option value="">None</option>{SUPPORTED_CURRENCIES.map(code=><option key={code} value={code}>{code} · {CURRENCY_NAMES[code]}</option>)}</select></label></div><span className="mt-1.5 block text-[10px] text-slate-500">{currencyResolved?`${currency} · ${CURRENCY_NAMES[currency]}`:currencyNeedsFallback?currencyFallbackMessage:'Select a destination first.'}</span>{currencyResolved&&<ConversionDetails currency={currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes} busy={exchangeBusy}/>}</div>
                    <label className="text-xs font-medium text-slate-300">Start date<input id="trip-start-date" required type="date" min={localDateInputValue()} value={startDate} onChange={e=>{const next=e.target.value;setStartDate(next);if(next && Number.isFinite(Date.parse(next)) && (endDate<next||endDate>addCalendarDays(next,30)))setEndDate(addCalendarDays(next,6));setStaySelectionState(null);setItinerary(null);setWeather(null);}} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-white transition hover:border-slate-600 focus:border-cyan-400" /></label>
                    <label className="text-xs font-medium text-slate-300">End date<input id="trip-end-date" required type="date" min={startDate} max={maximumEndDate} value={endDate} onChange={e=>{setEndDate(e.target.value);setStaySelectionState(null);setItinerary(null);setWeather(null);}} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-white transition hover:border-slate-600 focus:border-cyan-400" /><span className={`mt-1.5 block text-[10px] ${tripDays>=1&&tripDays<=31?'text-emerald-300':'text-amber-300'}`}>{tripDays>=1&&tripDays<=31?`${tripDays} travel day${tripDays===1?'':'s'} selected`:'Choose 1–31 days'}</span></label>
                    <label className="text-xs font-medium text-slate-300">Traveling as<select id="trip-party-type" value={partyType} onChange={e=>changePartyType(e.target.value as PartyType)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-white transition hover:border-slate-600 focus:border-cyan-400">{Object.entries(PARTY_TYPE_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
                    <label className="text-xs font-medium text-slate-300">Travelers<input id="trip-travelers" type="number" min={partyType==='solo'?1:2} max="20" disabled={partyType==='solo'||partyType==='couple'} value={travelers} onChange={e=>{setTravelers(Number(e.target.value));setStaySelectionState(null);}} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-2 text-white transition hover:border-slate-600 focus:border-cyan-400 disabled:opacity-50" /></label>
                  </div>
                </article>

                <article className="bg-[#19362f] p-5 sm:p-7 xl:col-span-5">
                  <div className="mb-7 flex items-start gap-4 border-b border-white/12 pb-5"><span className="grid h-11 w-11 shrink-0 place-items-center border border-amber-300/35 bg-amber-300/5 text-amber-200"><Compass size={19}/></span><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-amber-200/70">02 · Make it feel like yours</p><h2 className="mt-1 text-xl font-black tracking-[-0.03em]">Stays and preferences</h2><p className="mt-1 text-xs text-white/50">Choose a stay and add preferences to shape your trip.</p></div></div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div id="trip-accommodation" className="sm:col-span-2 min-w-0">
                    <p className="mb-1.5 text-xs font-medium text-slate-300">Accommodation suggestions</p>
                    <AccommodationPicker travelStyle={travelStyle} stayPreference={accommodationPreference} key={accommodationQueryKey} destinationLabel={selectedDestination?.label} latitude={selectedDestination?.latitude} longitude={selectedDestination?.longitude} providerAccommodations={providerAccommodations} providerStatus={providerStatus} providerMessage={providerMessage} providerEnvironment={providerEnvironment} suggestionsOnly enabled={Boolean(selectedDestination)} needsArea={accommodationNeedsArea} busy={staysBusy} message={stayMessage} currency={currency} offers={liveAccommodations} nearby={nearbyAccommodations} listings={stayOptions} selection={staySelection} onChange={selection => { setRestoredStaySelection(null); setStaySelectionState({ key: accommodationQueryKey, selection }); }} onRefresh={retryAccommodations} status={stayStatus} destinationName={selectedDestination?.name} />
                    </div>
                    <TripPreferenceFields travelStyle={travelStyle} onTravelStyleChange={setTravelStyle} />
                  </div>
                </article>
                <article className="min-w-0 bg-[#102822] p-5 sm:p-7 xl:col-span-12">
                  <DestinationSpotCarousel busy={busy} onPlan={(location, spot) => {
                    confirmDestination(location);
                    setVisitTripId(null); setEditingTripId(null); setRegenerationTargetId(null); setManualDirty(false); setSelectedDay(null);
                      setGenerationFailed(false);
                    setMessage(`Planning a visit to ${spot.name} in ${spot.country}. Review your dates and budget before generating.`);
                  }}/>
                  <details className="mt-6 border-t border-white/10 pt-4">
                    <summary className="cursor-pointer text-xs font-bold text-amber-200">Budget details (optional){includePreTripCosts ? ` · ${formatMoney(preTripTotal, currency)} pre-trip` : ''}</summary>
                  <div className="mt-6 grid gap-4 border-t border-white/10 pt-5"><button type="button" aria-pressed={includePreTripCosts} onClick={()=>setIncludePreTripCosts(value=>!value)} className={`min-h-12 w-fit border px-5 py-3 text-sm font-bold transition ${includePreTripCosts?'border-amber-300 bg-amber-300 text-[#14231f]':'border-white/20 text-white hover:border-amber-300/60'}`}>{includePreTripCosts?'Remove pre-trip expenses':'Add pre-trip expenses (optional)'}</button></div>
                  {includePreTripCosts&&<div className="mt-6 border-t border-white/10 pt-5"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{([['airportTransfers','Airport transfers'],['passport','Passport / renewal'],['visaOrAuthorization','Visa / authorization'],['departureTaxes','Travel tax'],['insurance','Insurance'],['other','Other costs']] as const).map(([field,label])=><label key={field} className="text-xs font-medium text-slate-300">{label}<input name={`preTripCost-${field}`} type="number" min="0" step={currencyStep(currency)} value={preTripCosts[field]||''} onChange={e=>updatePreTripAmount(field,e.target.value)} placeholder="0" className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-2 text-white placeholder:text-slate-600"/></label>)}</div><p className="mt-5 border-l-2 border-amber-300/50 pl-3 text-[11px] leading-5 text-white/48">Enter whole-party estimates in {currency}. Verify passport, visa, and tax amounts using official sources; leave non-applicable costs at zero.</p></div>}
                  <ExpenseAssumptionsFields value={expenseAssumptions} onChange={setExpenseAssumptions} currency={currency} travelers={travelers} quotedStay={Boolean(selectedLiveStayId)}/>
                  </details>
                </article>
              </section>

              <section aria-label="Trip generation" aria-busy={generationBusy} className="grid min-w-0 gap-4 rounded-2xl border border-white/15 bg-[#102824] p-4 text-white md:grid-cols-[minmax(0,1fr)_auto] md:gap-x-6 sm:p-5">
                <div className="flex min-w-0 items-start gap-3">
                  <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#ffcf70]/10 text-[#ffcf70]"><MapPin size={19}/></span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#ffcf70]/80">{generationBusy ? 'Building your trip' : busy ? 'Updating your workspace' : generationRequirement ? 'Complete your trip details' : 'Ready to generate'}</p>
                    <h2 className="mt-1 text-lg font-bold leading-6 tracking-tight [overflow-wrap:anywhere]">{selectedDestination ? destination : 'Your next destination'}</h2>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] leading-4 text-white/65">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-white/5 px-2 py-1"><CalendarDays aria-hidden="true" size={12}/>{datesReady ? `${tripDays} day${tripDays === 1 ? '' : 's'}` : 'Dates required'}</span>
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-white/5 px-2 py-1"><UserRound aria-hidden="true" size={12}/>{Number.isInteger(travelers) && travelers > 0 ? `${travelers} traveler${travelers === 1 ? '' : 's'}` : 'Travelers required'}</span>
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-white/5 px-2 py-1"><WalletCards aria-hidden="true" size={12}/>{budgetReady ? (currencyResolved ? formatMoney(budget, currency) : 'Currency pending') : 'Budget required'}</span>
                    </div>
                    {currencyResolved && budgetReady && <ReferenceAmount amount={budget} currency={currency} referenceCurrency={referenceCurrency} quotes={exchangeQuotes} className="mt-1 block text-[11px] text-white/55"/>}
                  </div>
                </div>
                {!busy && generationRequirement && <div id="generation-requirements" role="status" className="min-w-0 border-t border-white/10 pt-3 md:col-span-2">
                  <p className="mb-2 text-xs font-medium text-white/65">Complete these details to generate your trip</p>
                  <ul className={`grid gap-2 sm:grid-cols-2 ${generationRequirements.length > 2 ? 'xl:grid-cols-3' : generationRequirements.length === 1 ? 'sm:max-w-xl sm:grid-cols-1' : ''}`}>{generationRequirements.map(requirement => {
                    const RequirementIcon = GENERATION_REQUIREMENT_ICONS[requirement.field as keyof typeof GENERATION_REQUIREMENT_ICONS] || Compass;
                    return <li key={requirement.field} className="min-w-0">
                      <button type="button" aria-label={requirement.action} aria-describedby={`generation-detail-${requirement.field}`} disabled={requirement.field === 'trip-currency' && contextBusy} onClick={() => reviewGenerationRequirement(requirement.field)} className="group flex h-full min-h-16 w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[.025] px-3 py-2.5 text-left transition-colors enabled:hover:border-[#ffcf70]/40 enabled:hover:bg-[#ffcf70]/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffcf70] disabled:cursor-wait disabled:opacity-60">
                        <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#ffcf70]/10 text-[#ffcf70]"><RequirementIcon size={15}/></span>
                        <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-[#ffcf70]">{requirement.action}</span><span id={`generation-detail-${requirement.field}`} className="mt-0.5 block text-[11px] leading-4 text-white/60">{requirement.message}</span></span>
                        <ChevronRight aria-hidden="true" size={15} className="shrink-0 text-white/35 transition-colors group-enabled:hover:text-[#ffcf70]"/>
                      </button>
                    </li>;
                  })}</ul>
                </div>}
                {generationBusy ? <GenerationProgress/> : busy && <p id="generation-progress" role="status" className="text-xs leading-5 text-white/65 md:col-span-2">Please wait for the current workspace update to finish before generating a trip.</p>}
                {generationFailed && message && <p role="alert" className="rounded-lg border border-amber-300/20 bg-amber-300/5 px-3 py-2 text-sm leading-5 text-amber-200 md:col-span-2">{message}</p>}
                <div className="flex min-w-0 flex-col gap-1.5 md:col-start-2 md:row-start-1 md:w-52 md:self-center">
                  <button type="button" disabled={busy || Boolean(generationRequirement)} aria-describedby={busy ? 'generation-progress' : generationRequirement ? 'generation-requirements' : undefined} onClick={generate} className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#ffcf70] bg-[#ffcf70] px-4 py-3 text-sm font-bold text-[#102824] transition-colors enabled:hover:bg-[#ffdc91] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ffcf70] disabled:cursor-not-allowed disabled:border-white/15 disabled:bg-white/[.07] disabled:text-white/50">{generationBusy ? 'Building your trip...' : busy ? 'Please wait…' : generationFailed ? 'Retry generation' : 'Generate my trip'}{busy ? <LoaderCircle aria-hidden="true" size={17} className="motion-safe:animate-spin"/> : <ArrowRight aria-hidden="true" size={17} className="transition-transform group-enabled:hover:translate-x-1"/>}</button>
                  {!busy && <p className="text-center text-[11px] leading-4 text-white/50">{generationRequirement ? `${generationRequirements.length} detail${generationRequirements.length === 1 ? '' : 's'} left to complete` : 'Review and edit your plan after generating'}</p>}
                </div>
              </section>
            </div>
            </details>
            {generationBusy && !itinerary && <ItinerarySkeleton days={tripDays} />}
            {weather && <details className="my-4 text-sm"><summary className="cursor-pointer py-2 font-semibold">Weather &amp; source details</summary><section aria-busy={conditionsBusy} aria-labelledby="conditions-heading" className={`my-5 border-l-2 bg-white/[0.025] p-4 ${weather.source==='unavailable'?'border-amber-400':'border-cyan-400'}`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3"><CloudSun className={`mt-0.5 shrink-0 ${weather.source==='unavailable'?'text-amber-300':'text-cyan-300'}`}/><div><h2 id="conditions-heading" className="font-bold">{weather.source==='unavailable'?`Weather unavailable for ${weather.city}`:<>{weather.city}: {weather.temperature}°C, {weather.description}</>}</h2><p className="mt-1 text-xs leading-5 text-slate-400">{weather.source==='unavailable'?'No current conditions or alerts are being claimed.':weather.alerts[0] || (weather.source==='mock'?'No live alert data.':'No severe current-weather alert.')} · Source: {weather.source === 'open-meteo' ? 'Open-Meteo API' : weather.source === 'openweathermap' ? 'OpenWeatherMap API' : weather.source === 'unavailable' ? 'unavailable' : 'legacy mock/demo data'}</p><p className={`mt-1 text-xs ${weather.forecastAvailable?'text-cyan-200':'text-amber-300'}`}>{weather.forecastMessage}</p><div className="mt-2"><ProviderFreshness freshness={weather.freshness}/></div></div></div>
                <button type="button" disabled={conditionsBusy} onClick={()=>void refreshConditions()} className="min-h-10 shrink-0 border border-cyan-300/35 px-4 py-2 text-xs font-bold text-cyan-200 transition hover:bg-cyan-200 hover:text-[#14231f] disabled:opacity-50">{conditionsBusy?'Refreshing conditions...':'Refresh conditions'}</button>
              </div>
              {weather.forecast.length>0&&<div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">{weather.forecast.map(day=><article key={day.date} className="rounded-md border border-slate-800 bg-slate-900/60 p-2"><p className="text-xs font-semibold">{new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined,{weekday:'short'})}</p><p className="mt-1 text-sm font-mono">{day.tempMin}°–{day.tempMax}°C</p><p className="truncate text-xs capitalize text-slate-400">{day.description}</p><p className="text-xs text-cyan-300">Rain {day.precipitationProbability}%</p></article>)}</div>}
            </section></details>}
            {itinerary && viewedTripMap?.owner === data.user.id && viewedTripMap.tripId === visitTripId && <PlacesAwareTripMap><TripLocationMap key={`${viewedTripMap.owner}:${viewedTripMap.tripId}`} destination={viewedTripMap.destination} point={viewedTripMap.point} onNavigate={() => setTripMapSelection({ owner: data.user.id, tripId: viewedTripMap.tripId })}/></PlacesAwareTripMap>}
          </>}
          {tab === 'budget' && <BudgetReview
            itinerary={budgetItinerary}
            options={budgetReviewOptions}
            loading={busy && !!navigation.view.tripId && visitTripId !== navigation.view.tripId}
            headingRef={workspaceHeadingRef}
            onBack={() => navigation.view.returnToSavedItinerary && navigation.view.tripId ? setTab('bookings', { tab: 'bookings', tripId: navigation.view.tripId, fromSavedTrips: true }) : setTab('planner')}
            onEditBudget={() => { planningFocusRef.current = 'trip-budget'; setTab('planner'); }}
            onTripDetails={() => { planningFocusRef.current = 'trip-budget'; setTab('planner'); }}
          />}
          {(tab === 'bookings' || savedTripsVisited) && <div key={`saved-trips:${data.user.id}`} hidden={tab !== 'bookings'} className="space-y-8">
            {navigation.view.navigationMoved && <p role="status" className="rounded-lg border border-[#D8E1D7] bg-[#E5EDDF] p-4 text-sm text-[#24564B]">{savedNavigationMessage}</p>}
            <SavedTripLifecycle
              trips={data.trips}
              versions={data.itineraryVersions || []}
              generations={data.itineraryGenerations || []}
              busy={busy}
              tripsPage={data.tripsPage}
              versionPages={versionPages}
              onLoadMoreTrips={loadMoreTrips}
              onLoadVersions={loadVersions}
              onPlanFirstTrip={startNewTrip}
              onView={(trip)=>void loadTrip(trip,true)}
              onMap={trip => setTripMapSelection({ owner: data.user.id, tripId: trip.id })}
              onEdit={(trip)=>setTripEditor({ owner: data.user.id, trip })}
              onAction={action}
              onDelete={deleteSavedTrip}
              onVisitsSaved={() => setTab('visited')}
            />
          </div>}
          {tab === 'help' && <HelpUserGuide selectedGuide={selectedHelpGuide} onSelectGuide={setSelectedHelpGuide} headingRef={workspaceHeadingRef} onNavigate={destination => { if (destination === 'planner') startNewTrip(); else setTab(destination); }} onFeedback={() => setTab('feedback')}/>}
          {tab === 'plan' && <MyPlan key={data.user.id} headingRef={workspaceHeadingRef} onHelp={() => setTab('help')} onSavedTrips={() => setTab('bookings')} onRecover={plan => {
            if (manualDirty && !window.confirm('Open this recovered result? Your current unsaved draft will be replaced only after you confirm.')) return;
            const trip: SavedTrip = { id: '', userId: data.user.id, destination: plan.destination, budget: plan.totalBudget, currency: plan.currency, travelers: plan.travelers ?? 1, partyType: plan.partyType ?? 'solo', startDate: plan.days[0].date, endDate: plan.days.at(-1)!.date, interests: plan.preferences?.interests ?? [], itinerary: plan, weather: null, status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            restoreDraft({ trip, itinerary: plan, weather: null, savedAt: new Date().toISOString() });
          }}/>}
          {tab === 'visited' && <VisitedPlaces key={`visited-places:${data.user.id}`} onOpenTrip={id => { const summary = data.trips.find(trip => trip.id === id); void loadTrip(summary || { id } as SavedTrip); }}/> }
          {tab === 'feedback' && <section className="space-y-5"><div className="rounded-xl border border-white/15 p-5"><h2 className="font-bold">Feedback about a trip</h2><p className="mt-2 text-sm text-white/55">Open a saved itinerary and use Rate this trip to share feedback about its budget, weather, route or recommendations.</p><button onClick={() => setTab('bookings')} className="mt-4 min-h-11 border border-white/20 px-4 text-sm">View saved trips</button></div><ReportProblem busy={busy} onSubmit={sendReport}/></section>}
          {tab === 'notifications' && <TravelerNotifications data={data} busy={busy} action={action}/>}
          {tab === 'profile' && <TravelerAccountCenter user={data.user} busy={busy} onSaveProfile={saveProfile} onReport={sendReport}  />}
        </main>
      </div>
      {isSavedItineraryView && viewedSavedTrip && itinerary && <SavedTripItineraryDialog
        key={`${data.user.id}:${viewedSavedTrip.id}`}
        onClose={() => { if (!busy) returnToSavedTrips(); }}
        workspace={{
          selectedDayIndex: navigation.view.day === undefined ? null : itinerary.days.findIndex(day => day.day === navigation.view.day),
          onViewDay: dayIndex => navigation.navigate({ tab: 'bookings', tripId: viewedSavedTrip.id, fromSavedTrips: true, day: itinerary.days[dayIndex].day }),
          onBackToOverview: navigation.backToOverview,
          itinerary,
          weather,
          manualDirty: false,
          editingTripId: null,
          busy,
          travelers,
          referenceCurrency,
          exchangeQuotes,
          onSave: () => {},
          onReviewBudget: () => setTab('budget', { tab: 'budget', tripId: viewedSavedTrip.id, fromSavedTrips: true, returnToSavedItinerary: true }),
          visitTripId: viewedSavedTrip.id,
          onReorderActivity: () => {},
          onEditActivity: () => {},
          onRemoveActivity: () => {},
          onOpenDay: openDayDetails,
        }}
      />}
      {tripMapSelection && tripMapSelection.owner === data.user.id && <SavedTripMapDialog
        key={`${tripMapSelection.owner}:${tripMapSelection.tripId}`}
        tripId={tripMapSelection.tripId}
        initialDayIndex={tripMapSelection.dayIndex}
        onTripUpdated={trip => { setData(current => current?.user.id === tripMapSelection.owner ? { ...current, trips: current.trips.map(saved => saved.id === trip.id ? { ...saved, ...trip } : saved), itineraryVersions: (current.itineraryVersions || []).filter(version => version.tripId !== trip.id) } : current); }}
        onReviewDay={day => { setTripMapSelection(null); navigation.navigate({ tab: 'bookings', tripId: tripMapSelection.tripId, fromSavedTrips: true, day }); }}
        onClose={() => { setTripMapSelection(null); if (navigation.view.mapTripId) navigation.replace({ tab: 'bookings', navigationMoved: navigation.view.navigationMoved }); }}
      />}
      {tripEditor && tripEditor.owner === data.user.id && <EditTripDialog
        key={`${tripEditor.owner}:${tripEditor.trip.id}`}
        trip={tripEditor.trip}
        onClose={() => setTripEditor(null)}
        onSave={async (trip, plan) => { await saveEditedTrip(trip, plan); setTripEditor(null); }}
        onManage={(trip, dayIndex) => { setTripEditor(null); setTripMapSelection({ owner: data.user.id, tripId: trip.id, dayIndex }); }}
        onChangeDetails={trip => { setTripEditor(null); void loadTrip(trip, false); }}
      />}
      {leaveDialogOpen && <UnsavedTripDialog returnFocusRef={backToSavedTripsRef} onClose={() => { navigation.cancelPending(); setLeaveDialogOpen(false); }} onDiscard={() => returnToSavedTrips(true)}/>}
      {saveToast && <TripSaveToast key={saveToast.id} toast={saveToast} onDismiss={dismissSaveToast}/>}
      <MonthlyLimitDialog usage={planLimit} onClose={() => setPlanLimit(null)} onPlans={() => { setPlanLimit(null); setTab('plan'); }} onSavedTrips={() => { setPlanLimit(null); setTab('bookings'); }}/>
      {activityEditor && editorDay && <ActivityEditorDialog editor={activityEditor} day={editorDay} activity={editorActivity} currency={itinerary?.currency || currency} modalRef={activityModalRef} titleRef={activityTitleRef} onClose={() => setActivityEditor(null)} onSubmit={submitActivity} />}
      {selectedDay && itinerary && <DayDetailsDialog weather={weather} visitTripId={visitTripId} draft={manualDirty} day={selectedDay} itinerary={itinerary} travelers={travelers} referenceCurrency={referenceCurrency} exchangeQuotes={exchangeQuotes} photoRefreshDay={photoRefreshDay} retryingDay={retryingDay} busy={busy} modalRef={dayModalRef} closeRef={dayCloseRef} onClose={() => setSelectedDay(null)} onRefreshPhotos={(day) => void refreshDayPhotos(day, true)} onFindActivities={dayIndex => void retryDay(dayIndex, false)} />}
    </div></ConversionLoading.Provider></ConversionPreference.Provider>
  );
}
