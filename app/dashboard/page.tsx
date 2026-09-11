'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowRight, BedDouble, BusFront, CalendarDays, ChevronDown, ChevronUp, Clock3, CloudSun, Compass, Copy, Eye, LayoutDashboard, LogOut, MapPin, Pencil, Plane, Plus, Save, ShieldCheck, Sparkles, Ticket, Trash2, UserRound, WalletCards, X } from 'lucide-react';
import { fetchTripData, handleResponse, isAuthenticationError, type DayActivity, type ItineraryResponse, type WeatherData } from '@/lib/apiService';
import { PARTY_TYPE_LABELS, type Booking, type Listing, type PartyType, type PublicUser, type SavedTrip } from '@/lib/domain';
import { CEBU_COORDINATES, CEBU_LOCATIONS } from '@/data/cebu-locations';
import type { LiveAccommodation, LocationSuggestion, TravelOptionsResponse } from '@/lib/contracts';
import { moveActivity, removeActivity, upsertActivity } from '@/lib/itinerary-editor';
import { DashboardLoadState } from '@/components/DashboardLoadState';

type Platform = { user: PublicUser; listings: Listing[]; bookings: Booking[]; trips: SavedTrip[] };
type Tab = 'overview' | 'planner' | 'budget' | 'compare' | 'market' | 'bookings' | 'profile';
const LOCAL_DAY_IMAGES = ['/travel-illustration.png', '/mountain-hero-bg.png', '/beach-bg.png', '/travel-illustration.png', '/beach-bg.png', '/mountain-hero-bg.png', '/travel-illustration.png'] as const;

function addDays(dateText: string, days: number): string {
  const date = new Date(`${dateText}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function savedItinerary(value: unknown): ItineraryResponse | null {
  if (!value || typeof value !== 'object') return null;
  const itinerary = value as Partial<ItineraryResponse>;
  return typeof itinerary.destination === 'string' && Array.isArray(itinerary.days) && itinerary.days.length > 0 ? itinerary as ItineraryResponse : null;
}

function placeImage(source: string | undefined, fallback: string): string {
  return source?.startsWith('/') || source?.startsWith('https://upload.wikimedia.org/') || source?.startsWith('https://thumb.wikimedia.org/') ? source : fallback;
}

function offerTime(value: string | undefined): string {
  if (!value) return 'Unavailable';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : value;
}

async function api(body?: Record<string, unknown>) {
  const response = await fetch(body ? '/api/platform' : '/api/platform?scope=traveler', body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  return handleResponse<Platform & { result?: unknown }>(response);
}

export default function TravelerDashboard() {
  const router = useRouter();
  const [data, setData] = useState<Platform | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [destination, setDestination] = useState('Cordova, Cebu, Philippines');
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(CEBU_COORDINATES.Cordova);
  const [budget, setBudget] = useState(20000);
  const [partyType, setPartyType] = useState<PartyType>('solo');
  const [travelers, setTravelers] = useState(1);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => addDays(new Date().toISOString().slice(0, 10), 6));
  const [interests, setInterests] = useState('food, culture, nature');
  const [travelStyle, setTravelStyle] = useState('balanced');
  const [preferredActivities, setPreferredActivities] = useState('local food, sightseeing');
  const [accommodationPreference, setAccommodationPreference] = useState('budget-friendly');
  const [transportationPreference, setTransportationPreference] = useState('public transport and walking');
  const [selectedStayId, setSelectedStayId] = useState('lst_solea_mactan');
  const [selectedLiveStayId, setSelectedLiveStayId] = useState('');
  const [liveAccommodations, setLiveAccommodations] = useState<LiveAccommodation[]>([]);
  const [staysBusy, setStaysBusy] = useState(false);
  const [stayMessage, setStayMessage] = useState('');
  const [itinerary, setItinerary] = useState<ItineraryResponse | null>(null);
  const [selectedDay, setSelectedDay] = useState<ItineraryResponse['days'][number] | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [activityEditor, setActivityEditor] = useState<{ dayIndex: number; activityIndex: number | null } | null>(null);
  const [manualDirty, setManualDirty] = useState(false);
  const [flightOrigin, setFlightOrigin] = useState('Manila, Philippines');
  const [travelOptions, setTravelOptions] = useState<TravelOptionsResponse | null>(null);
  const [comparisonBusy, setComparisonBusy] = useState(false);
  const [comparisonMessage, setComparisonMessage] = useState('');
  const [loadError, setLoadError] = useState('');

  const refresh = () => api().then(setData);
  const loadInitial = async () => {
    try { setData(await api()); }
    catch (error) {
      if (isAuthenticationError(error)) { router.replace('/'); return; }
      setLoadError(error instanceof Error ? error.message : 'TravelMate could not load your workspace.');
    }
  };
  useEffect(() => {
    void api().then(setData).catch((error: unknown) => {
      if (isAuthenticationError(error)) { router.replace('/'); return; }
      setLoadError(error instanceof Error ? error.message : 'TravelMate could not load your workspace.');
    });
  }, [router]);
  useEffect(() => {
    if (destination.trim().length < 2) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      void fetch(`/api/locations?q=${encodeURIComponent(destination.trim())}`, { signal: controller.signal })
        .then((response) => response.ok ? handleResponse<{ locations?: LocationSuggestion[] }>(response) : { locations: [] })
        .then((result: { locations?: LocationSuggestion[] }) => setLocationSuggestions(result.locations || []))
        .catch((error: unknown) => { if (!(error instanceof DOMException && error.name === 'AbortError')) setLocationSuggestions([]); });
    }, 300);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [destination]);
  useEffect(() => {
    if (!activityEditor && !selectedDay) return;
    const closeDialog = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setActivityEditor(null); setSelectedDay(null); }
    };
    document.addEventListener('keydown', closeDialog);
    return () => document.removeEventListener('keydown', closeDialog);
  }, [activityEditor, selectedDay]);

  async function searchLiveAccommodations() {
    if (travelers > 9) { setStayMessage('Live hotel search currently supports up to 9 travelers.'); return; }
    setStaysBusy(true); setStayMessage(''); setLiveAccommodations([]); setSelectedLiveStayId('');
    try {
      const checkOutDate = endDate === startDate ? addDays(startDate, 1) : endDate;
      const params = new URLSearchParams({ destination: destination.trim(), checkInDate: startDate, checkOutDate, adults: String(travelers) });
      if (coordinates) { params.set('latitude', String(coordinates.latitude)); params.set('longitude', String(coordinates.longitude)); }
      const response = await fetch(`/api/accommodations?${params}`);
      const result = await handleResponse<{ accommodations?: LiveAccommodation[]; message?: string }>(response);
      const accommodations = result.accommodations || [];
      setLiveAccommodations(accommodations);
      setStayMessage(result.message || 'Live accommodation search complete.');
      if (!selectedStayId && accommodations[0]) setSelectedLiveStayId(accommodations[0].id);
    } catch (error) { setStayMessage(error instanceof Error ? error.message : 'Live accommodation search failed.'); }
    finally { setStaysBusy(false); }
  }

  async function searchComparison() {
    if (travelers > 9) { setComparisonMessage('Live provider comparison currently supports up to 9 travelers.'); return; }
    if (flightOrigin.trim().length < 2 || destination.trim().length < 2) { setComparisonMessage('Enter a valid flight origin and destination.'); return; }
    setComparisonBusy(true); setComparisonMessage(''); setTravelOptions(null); setLiveAccommodations([]);
    try {
      const comparisonParams = new URLSearchParams({ origin: flightOrigin.trim(), destination: destination.trim(), departureDate: startDate, returnDate: endDate, adults: String(travelers) });
      const checkOutDate = endDate === startDate ? addDays(startDate, 1) : endDate;
      const stayParams = new URLSearchParams({ destination: destination.trim(), checkInDate: startDate, checkOutDate, adults: String(travelers) });
      if (coordinates) {
        comparisonParams.set('latitude', String(coordinates.latitude)); comparisonParams.set('longitude', String(coordinates.longitude));
        stayParams.set('latitude', String(coordinates.latitude)); stayParams.set('longitude', String(coordinates.longitude));
      }
      const [comparisonResult, stayResult] = await Promise.allSettled([
        fetch(`/api/travel-options?${comparisonParams}`).then((response) => handleResponse<TravelOptionsResponse>(response)),
        fetch(`/api/accommodations?${stayParams}`).then((response) => handleResponse<{ accommodations?: LiveAccommodation[]; message?: string }>(response)),
      ]);
      if (comparisonResult.status === 'fulfilled') setTravelOptions(comparisonResult.value);
      if (stayResult.status === 'fulfilled') setLiveAccommodations(stayResult.value.accommodations || []);
      const messages = [
        comparisonResult.status === 'fulfilled' ? `${comparisonResult.value.flightMessage} ${comparisonResult.value.activityMessage}` : comparisonResult.reason instanceof Error ? comparisonResult.reason.message : 'Flight and activity comparison failed.',
        stayResult.status === 'fulfilled' ? stayResult.value.message : stayResult.reason instanceof Error ? stayResult.reason.message : 'Hotel comparison failed.',
      ].filter(Boolean);
      setComparisonMessage(messages.join(' '));
    } finally { setComparisonBusy(false); }
  }

  async function generate() {
    setBusy(true); setMessage('');
    try {
      const selectedStay = data?.listings.find((listing) => listing.id === selectedStayId);
      const selectedLiveStay = liveAccommodations.find((stay) => stay.id === selectedLiveStayId);
      const result = await fetchTripData(destination.trim(), budget, { partyType, travelers, startDate, endDate, latitude: coordinates?.latitude, longitude: coordinates?.longitude, interests: interests.split(',').map((x) => x.trim()).filter(Boolean), preferredActivities: preferredActivities.split(',').map((x) => x.trim()).filter(Boolean), travelStyle, accommodationPreference, transportationPreference, accommodationListingId: selectedStay?.id, externalAccommodation: selectedLiveStay ? { hotelId: selectedLiveStay.hotelId, offerId: selectedLiveStay.offerId, name: selectedLiveStay.name, address: selectedLiveStay.address, nightlyRate: selectedLiveStay.nightlyRate, isLive: selectedLiveStay.isLive, selectionToken: selectedLiveStay.selectionToken } : undefined });
      setItinerary(result.itinerary); setWeather(result.weather); setManualDirty(false); setActivityEditor(null); setMessage(result.itinerary.source === 'mock' ? 'Demo fallback plan ready. Its recommendations and prices are estimates.' : `Your ${result.itinerary.days.length}-day ${result.itinerary.source === 'gemini' ? 'Gemini' : 'OpenAI'} plan is ready.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Generation failed.'); }
    finally { setBusy(false); }
  }

  async function action(body: Record<string, unknown>, success: string): Promise<boolean> {
    setBusy(true); setMessage('');
    try { await api(body); await refresh(); setMessage(success); return true; }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Action failed.'); return false; }
    finally { setBusy(false); }
  }

  async function saveCurrentTrip() {
    if (!itinerary) return;
    setBusy(true); setMessage('');
    try {
      const response = await api({ action: editingTripId ? 'update-trip' : 'save-trip', id: editingTripId || undefined, destination, budget, startDate, endDate, partyType, travelers, interests: interests.split(',').map((item) => item.trim()).filter(Boolean), itinerary, weather });
      const saved = response.result as SavedTrip | undefined;
      if (saved?.id) setEditingTripId(saved.id);
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
        : await api({ action: 'save-trip', destination, budget, startDate, endDate, partyType, travelers, interests: interests.split(',').map((item) => item.trim()).filter(Boolean), itinerary, weather });
      const saved = response.result as SavedTrip | undefined;
      const canonical = saved ? savedItinerary(saved.itinerary) : null;
      if (saved?.id) setEditingTripId(saved.id);
      if (canonical) setItinerary(canonical);
      setSelectedDay(null); setManualDirty(false);
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

  function loadTrip(trip: SavedTrip, keepPlan = true) {
    const plan = savedItinerary(trip.itinerary);
    if (!plan) { setMessage('This saved trip does not contain a usable itinerary.'); return; }
    setDestination(trip.destination); setBudget(trip.budget); setStartDate(trip.startDate); setEndDate(trip.endDate);
    const municipality = CEBU_LOCATIONS.find((item) => trip.destination.toLowerCase().startsWith(item.toLowerCase()));
    setCoordinates(municipality && /\bcebu\b|\bphilippines\b/i.test(trip.destination) ? CEBU_COORDINATES[municipality] : null);
    setTravelers(trip.travelers); setPartyType(trip.travelers === 1 ? 'solo' : trip.travelers === 2 ? 'couple' : 'friends');
    setInterests(trip.interests.join(', ')); setEditingTripId(trip.id);
    if (plan.preferences) { setTravelStyle(plan.preferences.travelStyle); setAccommodationPreference(plan.preferences.accommodation); setTransportationPreference(plan.preferences.transportation); setPreferredActivities(plan.preferences.activities.join(', ')); }
    setItinerary(keepPlan ? plan : null); setWeather(keepPlan && trip.weather && typeof trip.weather === 'object' ? trip.weather as WeatherData : null); setManualDirty(false); setActivityEditor(null);
    setTab('planner'); setMessage(keepPlan ? 'Saved trip loaded. Change the form, regenerate if needed, then update it.' : 'Trip details loaded. Generate a fresh itinerary, then update the saved trip.');
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
      await handleResponse<{ profile: PublicUser }>(response);
      await refresh();
      setMessage('Profile updated.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Profile update failed.'); }
    finally { setBusy(false); }
  }

  async function logout() { await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) }); router.replace('/'); }
  if (!data) return <DashboardLoadState label="your TravelMate workspace" error={loadError} onRetry={() => { setLoadError(''); void loadInitial(); }} />;
  const tripDays = Math.floor((new Date(`${endDate}T00:00:00.000Z`).getTime() - new Date(`${startDate}T00:00:00.000Z`).getTime()) / 86_400_000) + 1;
  const maximumEndDate = addDays(startDate, 13);
  const split = itinerary?.budgetSummary as (ItineraryResponse['budgetSummary'] & { reserve?: number; dailyAverage?: number }) | undefined;
  const optimization = itinerary?.budgetOptimization;
  const localMunicipality = CEBU_LOCATIONS.find((location) => destination.toLowerCase().startsWith(location.toLowerCase()));
  const stayOptions = data.listings.filter((listing) => listing.category === 'stay' && listing.status === 'approved' && listing.municipality === localMunicipality);
  const selectedLiveAccommodation = liveAccommodations.find((stay) => stay.id === selectedLiveStayId);
  const today = new Date().toISOString().slice(0, 10);
  const upcomingTrip = [...data.trips].filter((trip) => trip.endDate >= today).sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  const activeBookings = data.bookings.filter((booking) => !['cancelled', 'completed'].includes(booking.status));
  const upcomingPlan = upcomingTrip ? savedItinerary(upcomingTrip.itinerary) : null;
  const upcomingTripImage = placeImage(upcomingPlan?.days[0]?.imageUrl, '/beach-bg.png');
  const userInitials = data.user.name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'TM';
  const overviewStats = [
    { label: 'Saved trips', value: String(data.trips.length), description: 'Plans in your account', icon: CalendarDays, color: 'text-cyan-300', surface: 'bg-cyan-400/10' },
    { label: 'Active bookings', value: String(activeBookings.length), description: 'Current stay requests', icon: BedDouble, color: 'text-emerald-300', surface: 'bg-emerald-400/10' },
    { label: 'Trust score', value: `${data.user.trustScore}/100`, description: data.user.profileStatus === 'verified' ? 'Verified profile' : 'Limited Mode', icon: ShieldCheck, color: 'text-amber-300', surface: 'bg-amber-400/10' },
    { label: 'Current plan', value: itinerary ? `${itinerary.days.length} days` : 'None yet', description: itinerary ? itinerary.destination : 'Ready when you are', icon: MapPin, color: 'text-violet-300', surface: 'bg-violet-400/10' },
  ];
  const editorDay = activityEditor && itinerary ? itinerary.days[activityEditor.dayIndex] : undefined;
  const editorActivity = activityEditor?.activityIndex !== null && activityEditor?.activityIndex !== undefined ? editorDay?.activities[activityEditor.activityIndex] : undefined;
  const changePartyType = (nextPartyType: PartyType) => {
    setPartyType(nextPartyType);
    setTravelers(nextPartyType === 'solo' ? 1 : nextPartyType === 'couple' ? 2 : nextPartyType === 'family' ? 4 : 3);
    setLiveAccommodations([]); setSelectedLiveStayId(''); setStayMessage(''); setTravelOptions(null); setComparisonMessage('');
    setItinerary(null);
    setMessage('');
  };
  const changeDestination = (location: string) => {
    setDestination(location);
    const selectedLocation = locationSuggestions.find((item) => item.label === location);
    const municipality = CEBU_LOCATIONS.find((item) => location.toLowerCase().startsWith(item.toLowerCase()));
    setCoordinates(selectedLocation ? { latitude: selectedLocation.latitude, longitude: selectedLocation.longitude } : municipality && /\bcebu\b|\bphilippines\b/i.test(location) ? CEBU_COORDINATES[municipality] : null);
    if (selectedLocation) setLocationSuggestions([]);
    const firstStay = data.listings.find((listing) => listing.category === 'stay' && listing.status === 'approved' && listing.municipality === municipality);
    setSelectedStayId(firstStay?.id || '');
    setSelectedLiveStayId('');
    setLiveAccommodations([]);
    setStayMessage('');
    setTravelOptions(null);
    setComparisonMessage('');
    setItinerary(null);
    setWeather(null);
    setMessage('');
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#07111f] text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#07111f]/95 backdrop-blur px-5 py-3 flex items-center justify-between">
        <button className="flex items-center gap-2 font-extrabold text-lg" onClick={() => router.push('/')}><Compass className="text-amber-400" />TravelMate</button>
        <div className="flex items-center gap-3"><span className="hidden sm:block text-sm text-slate-400">{data.user.name}</span><button type="button" aria-label="Sign out" title="Sign out" onClick={logout} className="p-2 hover:bg-slate-800 rounded-md"><LogOut size={18} /></button></div>
      </header>
      <div className="mx-auto grid w-full max-w-7xl grid-cols-[minmax(0,1fr)] gap-0 px-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8 lg:px-8">
        <aside className="min-w-0 max-w-[calc(100vw-2rem)] py-4 lg:sticky lg:top-[65px] lg:flex lg:h-[calc(100vh-65px)] lg:max-w-none lg:flex-col lg:py-8">
          <nav aria-label="Traveler workspace" className="flex max-w-full snap-x gap-2 overflow-x-auto pb-2 [scrollbar-width:thin] lg:flex-col lg:overflow-visible lg:pb-0">
            {([['overview','Dashboard',LayoutDashboard],['planner','Plan',MapPin],['budget','Budget',WalletCards],['compare','Compare',Plane],['market','Stays',BedDouble],['bookings','Trips',CalendarDays],['profile','Verification',ShieldCheck]] as const).map(([id,label,Icon]) => <button key={id} aria-current={tab===id?'page':undefined} onClick={() => setTab(id)} className={`flex shrink-0 snap-start items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${tab===id?'bg-amber-400 text-slate-950 shadow-lg shadow-amber-950/20':'text-slate-400 hover:bg-slate-900 hover:text-slate-100'}`}><Icon size={16}/>{label}</button>)}
          </nav>
          <button onClick={() => setTab('profile')} className={`mt-auto hidden w-full items-center gap-3 rounded-2xl border p-3 text-left transition lg:flex ${tab==='profile'?'border-amber-400/50 bg-amber-400/10':'border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900'}`} aria-label="Open user profile">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-300 to-orange-500 text-sm font-black text-slate-950 shadow-lg shadow-amber-950/30">{userInitials}</span>
            <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-100">{data.user.name}</strong><span className="block truncate text-[11px] text-slate-500">{data.user.email}</span></span>
            <UserRound size={16} className="shrink-0 text-amber-300" />
          </button>
        </aside>
        <main className="min-w-0 w-full max-w-[calc(100vw-2rem)] overflow-x-hidden py-5 lg:max-w-none lg:py-8">
          <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"><div className="min-w-0 max-w-full"><p className="text-xs uppercase tracking-widest text-amber-400">Traveler workspace</p><h1 className="break-words text-2xl font-bold">{tab === 'overview' ? 'Dashboard' : tab === 'planner' ? 'Build your trip plan' : tab === 'compare' ? 'Compare travel options' : tab === 'market' ? 'Stay booking' : tab === 'bookings' ? 'Trips' : tab[0].toUpperCase()+tab.slice(1)}</h1></div><span className={`w-fit shrink-0 text-xs px-3 py-1 rounded-full border ${data.user.profileStatus==='verified'?'border-emerald-500 text-emerald-300':'border-amber-500 text-amber-300'}`}>{data.user.profileStatus==='verified'?'Verified profile':'Limited Mode'}</span></div>
          {message && <div role="status" className="mb-5 border border-slate-700 bg-slate-900 px-4 py-3 rounded-md text-sm">{message}</div>}

          {tab === 'overview' && <div className="space-y-6">
            <section className="relative min-h-[310px] overflow-hidden rounded-3xl border border-white/10 shadow-2xl shadow-black/20">
              <Image src="/beach-bg.png" alt="Tropical beach inspiration for your next trip" fill priority sizes="(max-width: 1024px) 100vw, 980px" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#06111f] via-[#06111f]/85 to-[#06111f]/15" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#06111f]/80 via-transparent to-transparent" />
              <div className="relative flex min-h-[310px] w-full max-w-2xl flex-col items-start justify-center p-6 sm:p-10">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-slate-950/35 px-3 py-1.5 text-xs font-semibold text-cyan-100 backdrop-blur"><Sparkles size={14} className="text-amber-300"/>AI-powered trip planning</span>
                <p className="mt-5 text-sm font-medium text-white/70">Welcome back, {data.user.name.split(' ')[0]}.</p>
                <h2 className="mt-2 max-w-xl text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl">Your next great story starts with a place.</h2>
                <p className="mt-3 max-w-lg text-sm leading-6 text-slate-200/80">Turn your dates, interests, and budget into a personalized itinerary—complete with stays, weather, and cost estimates.</p>
                <button onClick={()=>setTab('planner')} className="group mt-6 inline-flex items-center gap-2 rounded-full bg-amber-400 px-5 py-3 text-sm font-extrabold text-slate-950 shadow-lg shadow-amber-950/30 transition hover:-translate-y-0.5 hover:bg-amber-300">Plan a new trip <ArrowRight size={16} className="transition-transform group-hover:translate-x-1"/></button>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {overviewStats.map(({label,value,description,icon:StatIcon,color,surface})=><article key={label} className="group rounded-2xl border border-slate-800/90 bg-slate-900/55 p-4 transition hover:-translate-y-0.5 hover:border-slate-700 hover:bg-slate-900/80"><div className="flex items-start justify-between gap-3"><p className="text-xs uppercase tracking-wider text-slate-500">{label}</p><span className={`grid h-9 w-9 place-items-center rounded-xl ${surface} ${color}`}><StatIcon size={17}/></span></div><strong className="mt-2 block truncate text-xl text-slate-100">{value}</strong><p className="mt-1 truncate text-xs text-slate-500">{description}</p></article>)}
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/45">
                <div className="relative h-44 bg-slate-900 sm:h-52"><Image src={upcomingTripImage} alt={upcomingTrip ? `Preview of ${upcomingTrip.destination}` : 'Travel destination inspiration'} fill sizes="(max-width: 1024px) 100vw, 620px" className="object-cover"/><div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/35 to-transparent"/><div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5"><div><p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Next trip</p><h2 className="mt-1 text-xl font-bold text-white">{upcomingTrip ? upcomingTrip.destination : 'No upcoming trip yet'}</h2></div><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 bg-slate-950/50 text-cyan-200 backdrop-blur"><CalendarDays size={20}/></span></div></div>
                <div className="p-5 sm:px-6">
                  {upcomingTrip ? <><div className="grid gap-3 sm:grid-cols-3"><div><p className="text-xs text-slate-500">Dates</p><strong className="text-sm">{upcomingTrip.startDate} – {upcomingTrip.endDate}</strong></div><div><p className="text-xs text-slate-500">Travelers</p><strong className="text-sm">{upcomingTrip.travelers}</strong></div><div><p className="text-xs text-slate-500">Budget</p><strong className="text-sm">PHP {upcomingTrip.budget.toLocaleString()}</strong></div></div><button onClick={()=>loadTrip(upcomingTrip,true)} className="group mt-5 inline-flex items-center gap-2 text-sm font-bold text-amber-300 hover:text-amber-200">Open saved plan <ArrowRight size={15} className="transition-transform group-hover:translate-x-1"/></button></> : <div className="rounded-lg border border-dashed border-slate-700 p-5 text-center"><p className="text-sm text-slate-400">Create and save an itinerary to see your next trip here.</p><button onClick={()=>setTab('planner')} className="mt-3 text-sm font-bold text-amber-300 hover:text-amber-200">Start planning</button></div>}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/70 to-slate-900/35 p-5 sm:p-6"><p className="text-xs uppercase tracking-wider text-emerald-300">Quick actions</p><h2 className="mt-1 font-bold">What would you like to do?</h2><div className="mt-4 grid gap-2">{[[MapPin,'Build a trip','planner'],[Plane,'Compare prices','compare'],[CalendarDays,'Open saved trips','bookings']] .map(([Icon,label,target])=>{const ActionIcon=Icon as typeof MapPin;return <button key={String(label)} onClick={()=>setTab(target as Tab)} className="group flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/45 px-4 py-3 text-left text-sm font-semibold transition hover:border-amber-400/30 hover:bg-slate-900"><span className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-800 text-slate-300 group-hover:bg-amber-400/10 group-hover:text-amber-300"><ActionIcon size={16}/></span>{String(label)}</span><ArrowRight size={14} className="text-slate-600 transition-transform group-hover:translate-x-1 group-hover:text-amber-300"/></button>})}</div><button onClick={()=>setTab('profile')} className="mt-4 flex w-full items-center gap-3 border-t border-slate-800 pt-4 text-left"><span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-400 text-xs font-black text-slate-950">{userInitials}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{data.user.name}</strong><span className="block text-[11px] text-slate-500">Manage profile & verification</span></span><ArrowRight size={14} className="text-slate-600"/></button></div>
            </section>
          </div>}

          {tab === 'planner' && <>
            <div className="space-y-5">
              <section className="relative min-h-[210px] overflow-hidden rounded-3xl border border-white/10 shadow-xl shadow-black/20">
                <Image src="/mountain-hero-bg.png" alt="Mountain destination at sunrise" fill priority sizes="(max-width: 1024px) 100vw, 980px" className="object-cover object-center" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#07111f] via-[#07111f]/85 to-[#07111f]/20" />
                <div className="relative flex min-h-[210px] w-full max-w-full flex-col justify-center p-6 sm:p-8">
                  <span className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1.5 text-xs font-bold text-amber-200 backdrop-blur"><Sparkles size={14}/>Smart trip builder</span>
                  <h2 className="mt-4 max-w-lg text-2xl font-black tracking-tight sm:text-3xl">Let&apos;s design a trip that feels like you.</h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Share the essentials and a few preferences. TravelMate will balance your itinerary, estimated budget, weather, and stays.</p>
                  <div className="mt-5 flex flex-wrap items-center gap-2 text-[11px] font-semibold"><span className="rounded-full bg-amber-400 px-3 py-1.5 text-slate-950">1&nbsp; Trip details</span><span className="rounded-full border border-white/15 bg-slate-950/40 px-3 py-1.5 text-slate-200 backdrop-blur">2&nbsp; Personalize</span><span className="rounded-full border border-white/15 bg-slate-950/40 px-3 py-1.5 text-slate-200 backdrop-blur">3&nbsp; Your itinerary</span></div>
                </div>
              </section>

              <section className="grid gap-4 xl:grid-cols-[1.02fr_.98fr] [&_input]:min-h-12 [&_select]:min-h-12">
                <article className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/80 to-slate-900/35 p-5 shadow-lg shadow-black/10 sm:p-6">
                  <div className="mb-5 flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300"><MapPin size={19}/></span><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-cyan-300">Step 1</p><h2 className="font-bold">Trip essentials</h2><p className="mt-0.5 text-xs text-slate-500">Where, when, and how much?</p></div></div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="sm:col-span-2 text-xs font-medium text-slate-300">Destination<input required minLength={2} list="global-destinations" value={destination} onChange={e=>changeDestination(e.target.value)} placeholder="e.g. Kyoto, Japan" autoComplete="off" className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-2 text-white transition placeholder:text-slate-600 hover:border-slate-600 focus:border-cyan-400"/><datalist id="global-destinations">{locationSuggestions.map(location=><option key={location.id} value={location.label}/>)}</datalist></label>
                    <label className="sm:col-span-2 text-xs font-medium text-slate-300">Total group budget (PHP)<span className="relative mt-1.5 block"><span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-bold text-amber-300">₱</span><input type="number" min="1000" value={budget} onChange={e=>setBudget(Number(e.target.value))} className="w-full rounded-xl border border-slate-700 bg-slate-950/80 py-2 pl-9 pr-4 text-white transition hover:border-slate-600 focus:border-amber-400" /></span></label>
                    <label className="text-xs font-medium text-slate-300">Start date<input required type="date" min={new Date().toISOString().slice(0,10)} value={startDate} onChange={e=>{const next=e.target.value;setStartDate(next);if(endDate<next||endDate>addDays(next,13))setEndDate(addDays(next,6));setLiveAccommodations([]);setSelectedLiveStayId('');setStayMessage('');setTravelOptions(null);setComparisonMessage('');setItinerary(null);setWeather(null);}} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-white transition hover:border-slate-600 focus:border-cyan-400" /></label>
                    <label className="text-xs font-medium text-slate-300">End date<input required type="date" min={startDate} max={maximumEndDate} value={endDate} onChange={e=>{setEndDate(e.target.value);setLiveAccommodations([]);setSelectedLiveStayId('');setStayMessage('');setTravelOptions(null);setComparisonMessage('');setItinerary(null);setWeather(null);}} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-white transition hover:border-slate-600 focus:border-cyan-400" /><span className={`mt-1.5 block text-[10px] ${tripDays>=1&&tripDays<=14?'text-emerald-300':'text-amber-300'}`}>{tripDays>=1&&tripDays<=14?`${tripDays} travel day${tripDays===1?'':'s'} selected`:'Choose 1–14 days'}</span></label>
                    <label className="text-xs font-medium text-slate-300">Traveling as<select value={partyType} onChange={e=>changePartyType(e.target.value as PartyType)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-white transition hover:border-slate-600 focus:border-cyan-400">{Object.entries(PARTY_TYPE_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
                    <label className="text-xs font-medium text-slate-300">Travelers<input type="number" min={partyType==='solo'?1:2} max="20" disabled={partyType==='solo'||partyType==='couple'} value={travelers} onChange={e=>{setTravelers(Number(e.target.value));setLiveAccommodations([]);setSelectedLiveStayId('');setStayMessage('');setTravelOptions(null);setComparisonMessage('');}} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-2 text-white transition hover:border-slate-600 focus:border-cyan-400 disabled:opacity-50" /></label>
                  </div>
                </article>

                <article className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/80 to-slate-900/35 p-5 shadow-lg shadow-black/10 sm:p-6">
                  <div className="mb-5 flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-400/10 text-violet-300"><Sparkles size={19}/></span><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-violet-300">Step 2</p><h2 className="font-bold">Make it yours</h2><p className="mt-0.5 text-xs text-slate-500">Optional choices for a more personal plan.</p></div></div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2 text-xs font-medium text-slate-300"><div className="flex items-center justify-between gap-2"><label htmlFor="accommodation">Accommodation</label><button type="button" disabled={staysBusy||destination.trim().length<2||tripDays<1||tripDays>14} onClick={()=>void searchLiveAccommodations()} className="font-bold text-cyan-300 hover:text-cyan-200 disabled:opacity-50">{staysBusy?'Searching...':'Find live stays'}</button></div><select id="accommodation" value={selectedLiveStayId?`live:${selectedLiveStayId}`:selectedStayId?`local:${selectedStayId}`:''} onChange={e=>{const [source,...idParts]=e.target.value.split(':');const id=idParts.join(':');setSelectedStayId(source==='local'?id:'');setSelectedLiveStayId(source==='live'?id:'');}} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-white transition hover:border-slate-600 focus:border-violet-400"><option value="">No accommodation</option>{stayOptions.length>0&&<optgroup label="TravelMate stays">{stayOptions.map(stay=><option key={stay.id} value={`local:${stay.id}`}>{stay.name} - PHP {stay.price.toLocaleString()}/night</option>)}</optgroup>}{liveAccommodations.length>0&&<optgroup label="Amadeus availability">{liveAccommodations.map(stay=><option key={stay.id} value={`live:${stay.id}`}>{stay.isLive?'LIVE':'TEST'} · {stay.name} - {stay.currency} {stay.nightlyRate.toLocaleString()}/night</option>)}</optgroup>}</select>{selectedLiveAccommodation&&<p className="mt-1 text-[11px] text-cyan-200">{selectedLiveAccommodation.currency} {selectedLiveAccommodation.total.toLocaleString()} for {Math.max(1,tripDays-1)} night{Math.max(1,tripDays-1)===1?'':'s'} · {selectedLiveAccommodation.roomDescription}</p>}{stayMessage&&<p className="mt-1 text-[11px] text-slate-500">{stayMessage}</p>}</div>
                    <label className="sm:col-span-2 text-xs font-medium text-slate-300">Interests<input value={interests} onChange={e=>setInterests(e.target.value)} placeholder="food, culture, nature" className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-2 text-white transition placeholder:text-slate-600 hover:border-slate-600 focus:border-violet-400" /></label>
                    <label className="text-xs font-medium text-slate-300">Travel style<select value={travelStyle} onChange={e=>setTravelStyle(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-white transition hover:border-slate-600 focus:border-violet-400"><option value="budget">Budget</option><option value="balanced">Balanced</option><option value="comfort">Comfort</option><option value="luxury">Luxury</option><option value="family-friendly">Family-friendly</option></select></label>
                    <label className="text-xs font-medium text-slate-300">Stay preference<select value={accommodationPreference} onChange={e=>setAccommodationPreference(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-white transition hover:border-slate-600 focus:border-violet-400"><option value="budget-friendly">Budget-friendly</option><option value="central location">Central location</option><option value="resort">Resort</option><option value="family-friendly">Family-friendly</option><option value="luxury">Luxury</option></select></label>
                    <label className="sm:col-span-2 text-xs font-medium text-slate-300">Preferred activities<input value={preferredActivities} onChange={e=>setPreferredActivities(e.target.value)} placeholder="island hopping, museums" className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-2 text-white transition placeholder:text-slate-600 hover:border-slate-600 focus:border-violet-400" /></label>
                    <label className="sm:col-span-2 text-xs font-medium text-slate-300">Transportation<select value={transportationPreference} onChange={e=>setTransportationPreference(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-white transition hover:border-slate-600 focus:border-violet-400"><option value="public transport and walking">Public transport & walking</option><option value="private car">Private car</option><option value="ride-hailing and taxi">Ride-hailing & taxi</option><option value="motorbike">Motorbike</option><option value="mixed practical transport">Mixed practical transport</option></select></label>
                  </div>
                </article>
              </section>

              <section className="flex flex-col gap-5 overflow-hidden rounded-2xl border border-amber-300/20 bg-gradient-to-r from-amber-400/15 via-amber-300/5 to-cyan-400/10 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="flex min-w-0 items-start gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-400 text-slate-950 shadow-lg shadow-amber-950/30"><Sparkles size={22}/></span><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-amber-300">Ready to create</p><h2 className="mt-1 truncate text-lg font-bold">{destination || 'Your next destination'}</h2><p className="mt-1 text-xs text-slate-400">{tripDays>=1&&tripDays<=14?`${tripDays} days`: 'Select valid dates'} · {travelers} traveler{travelers===1?'':'s'} · PHP {Number.isFinite(budget)?budget.toLocaleString():'0'} budget</p></div></div>
                <button disabled={busy||tripDays<1||tripDays>14||destination.trim().length<2||!Number.isFinite(budget)||budget<1000} onClick={generate} className="group inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-400 px-6 py-3 font-extrabold text-slate-950 shadow-lg shadow-amber-950/25 transition hover:-translate-y-0.5 hover:bg-amber-300 disabled:translate-y-0 disabled:opacity-50">{busy?'Building your trip...':'Generate my trip'}<ArrowRight size={17} className="transition-transform group-hover:translate-x-1"/></button>
              </section>
            </div>
            {weather && <section className={`my-5 border-l-2 pl-4 ${weather.source==='unavailable'?'border-amber-400':'border-cyan-400'}`}><div className="flex items-center gap-3"><CloudSun className={`shrink-0 ${weather.source==='unavailable'?'text-amber-300':'text-cyan-300'}`}/><div><strong>{weather.source==='unavailable'?`Weather unavailable for ${weather.city}`:<>{weather.city}: {weather.temperature}°C, {weather.description} <span className="text-xs font-normal text-slate-400">{weather.source==='mock'?'(legacy demo fallback, not live)':'(current)'}</span></>}</strong><p className="text-xs text-slate-400">{weather.source==='unavailable'?'No current conditions or alerts are being claimed.':weather.alerts[0] || (weather.source==='mock'?'No live alert data.':'No severe current-weather alert.')} · Source: {weather.source === 'open-meteo' ? 'Open-Meteo API' : weather.source === 'openweathermap' ? 'OpenWeatherMap API' : weather.source === 'unavailable' ? 'unavailable' : 'legacy mock/demo data'}</p><p className={weather.forecastAvailable?'text-xs text-cyan-200':'text-xs text-amber-300'}>{weather.forecastMessage}</p></div></div>{weather.forecast.length>0&&<div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">{weather.forecast.map(day=><article key={day.date} className="rounded-md border border-slate-800 bg-slate-900/60 p-2"><p className="text-xs font-semibold">{new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined,{weekday:'short'})}</p><p className="mt-1 text-sm font-mono">{day.tempMin}°–{day.tempMax}°C</p><p className="truncate text-xs capitalize text-slate-400">{day.description}</p><p className="text-xs text-cyan-300">Rain {day.precipitationProbability}%</p></article>)}</div>}</section>}
            {itinerary && <>
              <div className="my-5 flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="text-xl font-bold">{itinerary.destination}</h2><p className="text-xs uppercase tracking-widest text-cyan-300">{itinerary.source === 'gemini' ? 'Gemini generated' : itinerary.source === 'openai' ? 'OpenAI generated' : 'Demo fallback'}{itinerary.manuallyEdited || manualDirty ? ' · manually edited' : ''}</p></div>
                <button disabled={busy} onClick={()=>void (manualDirty ? saveManualChanges() : saveCurrentTrip())} className={`flex min-h-10 items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition disabled:opacity-50 ${manualDirty?'bg-amber-400 text-slate-950 hover:bg-amber-300':'border border-slate-600 hover:bg-slate-800'}`}><Save size={15}/>{busy?'Saving...':manualDirty?'Save manual changes':editingTripId?'Update saved trip':'Save trip'}</button>
              </div>
              {itinerary.costSharing && <section className="mb-5 grid gap-3 border-y border-slate-800 py-4 sm:grid-cols-3"><div><p className="text-xs uppercase text-slate-500">Party</p><strong>{PARTY_TYPE_LABELS[itinerary.costSharing.partyType]} · {itinerary.costSharing.travelers} traveler{itinerary.costSharing.travelers===1?'':'s'}</strong></div><div><p className="text-xs uppercase text-slate-500">Group plan spend</p><strong>PHP {itinerary.costSharing.plannedGroupSpend.toLocaleString()}</strong></div><div><p className="text-xs uppercase text-slate-500">Equal share</p><strong>PHP {itinerary.costSharing.plannedSpendShares[0].toLocaleString()}{travelers>1?' per traveler':' total'}</strong>{new Set(itinerary.costSharing.plannedSpendShares).size>1&&<p className="text-xs text-slate-500">PHP 1 remainder is assigned to the first traveler.</p>}</div></section>}
              {itinerary.accommodation && <section className="mb-5 grid sm:grid-cols-[1fr_auto] gap-4 border-b border-slate-800 pb-4 items-center"><div className="flex items-start gap-3"><BedDouble className="text-amber-300 shrink-0"/><div><strong>{itinerary.accommodation.name}</strong><p className="text-sm text-slate-400">{itinerary.accommodation.address || itinerary.destination}</p><p className="text-sm">PHP {itinerary.accommodation.nightlyRate.toLocaleString()}/night x {itinerary.accommodation.nights} nights = <strong>PHP {itinerary.accommodation.total.toLocaleString()} group total</strong></p>{itinerary.costSharing&&<p className="text-xs text-slate-400">Equal accommodation share: PHP {itinerary.costSharing.accommodationShares[0].toLocaleString()}{travelers>1?' per traveler':''}</p>}</div></div>{itinerary.accommodation.source==='amadeus'?<span className="rounded-md border border-cyan-700 px-4 py-2 text-sm text-cyan-200">{itinerary.accommodation.isLive?'Live':'Test'} Amadeus offer selected</span>:<button disabled={busy} onClick={()=>void action({action:'book',listingId:itinerary.accommodation!.listingId,guests:travelers,nights:itinerary.accommodation!.nights},'Stay booked by the lead traveler; payment status is simulated as PAID_HELD until PayMongo is configured.')} className="bg-emerald-400 text-slate-950 px-4 py-2 rounded-md text-sm font-bold">Book as lead traveler</button>}</section>}
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {itinerary.days.map((day,dayIndex)=><article key={day.day} className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50">
                  <div className="relative aspect-[16/9] bg-slate-900">
                    <Image src={placeImage(day.imageUrl, LOCAL_DAY_IMAGES[day.day - 1] || '/travel-illustration.png')} alt={`${day.theme} in ${itinerary.destination}`} fill sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw" className="object-cover" />
                    <span className="absolute left-3 top-3 bg-slate-950/85 px-2 py-1 text-xs text-amber-300 font-bold">DAY {day.day}</span>
                    <span className="absolute right-3 top-3 bg-slate-950/85 px-2 py-1 text-sm font-mono">PHP {day.totalCost.toLocaleString()}</span>
                    {day.imageAttribution&&<a href={day.imageAttribution.sourceUrl} target="_blank" rel="noreferrer" title={`${day.imageAttribution.creator} · ${day.imageAttribution.license}`} className="absolute bottom-2 right-2 max-w-[75%] truncate rounded bg-slate-950/80 px-2 py-1 text-[9px] text-slate-300">Photo: {day.imageAttribution.creator} · {day.imageAttribution.license}</a>}
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold">{day.theme}</h3>
                    <p className="text-xs text-slate-500">{day.date}</p>
                    {day.travelNote && <p className="mt-2 flex items-start gap-2 text-xs leading-relaxed text-cyan-200"><Clock3 size={14} className="mt-0.5 shrink-0" />{day.travelNote}</p>}
                    {day.crowdLevel && <p className="mt-2 text-xs text-violet-200" title={day.crowdNote}>Estimated crowd: <strong className="capitalize">{day.crowdLevel}</strong> · low confidence · not live data</p>}
                    {weather?.forecast.find(forecast=>forecast.date===day.date) && <p className="mt-2 text-xs text-sky-200"><CloudSun size={14} className="mr-1 inline"/>{weather.forecast.find(forecast=>forecast.date===day.date)!.description}, {weather.forecast.find(forecast=>forecast.date===day.date)!.tempMin}°–{weather.forecast.find(forecast=>forecast.date===day.date)!.tempMax}°C · {weather.forecast.find(forecast=>forecast.date===day.date)!.precipitationProbability}% rain</p>}
                    {weather?.forecast.find(forecast=>forecast.date===day.date)?.weatherAlert && <p className="mt-1 text-xs text-amber-300">{weather.forecast.find(forecast=>forecast.date===day.date)!.weatherAlert}</p>}
                    <p className="mt-2 flex items-center gap-2 text-xs text-emerald-200"><BusFront size={14}/>Estimated ride/boat fare: PHP {(day.rideFare||0).toLocaleString()}</p>
                    <ul className="mt-3 space-y-2" aria-label={`Day ${day.day} activities`}>{day.activities.length===0?<li className="rounded-lg border border-dashed border-slate-700 px-3 py-5 text-center text-xs text-slate-500">No activities yet. Add one to build this day.</li>:day.activities.map((item,i)=><li key={`${item.time}-${item.title}-${i}`} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm"><div className="flex items-start justify-between gap-3"><span className="min-w-0"><span className="mr-2 text-xs text-cyan-300">{item.time}</span><strong className="font-semibold">{item.title}</strong><small className="mt-1 block text-slate-500">PHP {item.estimatedCost.toLocaleString()} group estimate</small></span><span className="flex shrink-0 items-center gap-0.5"><button disabled={i===0} onClick={()=>reorderActivity(dayIndex,i,-1)} aria-label={`Move ${item.title} earlier`} title="Move earlier" className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-25"><ChevronUp size={14}/></button><button disabled={i===day.activities.length-1} onClick={()=>reorderActivity(dayIndex,i,1)} aria-label={`Move ${item.title} later`} title="Move later" className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-25"><ChevronDown size={14}/></button><button onClick={()=>setActivityEditor({dayIndex,activityIndex:i})} aria-label={`Edit ${item.title}`} title="Edit activity" className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-cyan-300"><Pencil size={14}/></button><button onClick={()=>confirmRemoveActivity(dayIndex,i)} aria-label={`Remove ${item.title}`} title="Remove activity" className="rounded p-1.5 text-slate-400 hover:bg-red-950 hover:text-red-300"><Trash2 size={14}/></button></span></div></li>)}</ul>
                    {day.returnToStayAt && itinerary.accommodation && <p className="mt-3 border-t border-slate-800 pt-3 flex items-center gap-2 text-xs text-amber-200"><BedDouble size={14}/>Return to {itinerary.accommodation.name} by {day.returnToStayAt}</p>}
                    <div className="mt-4 grid grid-cols-2 gap-2"><button disabled={day.activities.length>=8} onClick={()=>setActivityEditor({dayIndex,activityIndex:null})} className="flex items-center justify-center gap-2 rounded-md border border-amber-500/40 px-3 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-400/10 disabled:opacity-40"><Plus size={15}/>Add activity</button><button onClick={()=>setSelectedDay(day)} className="flex items-center justify-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-sm font-semibold hover:bg-slate-800"><Eye size={15}/>Full details</button></div>
                  </div>
                </article>)}
              </div>
            </>}
          </>}
          {tab === 'budget' && <div>{split ? <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['Total group budget',split.total],['Estimated group spend',split.plannedSpend||0],[split.shortfall?'Budget shortfall':'Unspent / reserve',split.shortfall||split.remainingBudget||0],['Safety reserve target',split.reserve||0]].map(([label,value])=><div key={String(label)} className="border-t border-slate-700 py-5"><p className="text-xs uppercase text-slate-500">{label}</p><strong className={`text-2xl ${label==='Budget shortfall'?'text-red-300':''}`}>PHP {Number(value).toLocaleString()}</strong></div>)}</div>
            {optimization && <section className={`mt-5 rounded-xl border p-5 ${optimization.status==='over_budget'?'border-red-500/40 bg-red-500/5':optimization.status==='near_limit'?'border-amber-400/40 bg-amber-400/5':'border-emerald-400/30 bg-emerald-400/5'}`} aria-labelledby="budget-optimization-heading">
              <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-950/60"><WalletCards size={19} className={optimization.status==='over_budget'?'text-red-300':optimization.status==='near_limit'?'text-amber-300':'text-emerald-300'}/></span><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Budget optimization</p><h2 id="budget-optimization-heading" className="mt-1 font-bold">{optimization.status==='over_budget'?`Reduce the estimate by PHP ${optimization.amountToTarget.toLocaleString()}`:optimization.status==='near_limit'?`Save PHP ${optimization.amountToTarget.toLocaleString()} to protect the reserve`:'Plan is within budget with the reserve protected'}</h2><p className="mt-1 text-sm text-slate-400">Target spend: PHP {optimization.targetSpend.toLocaleString()}.</p></div></div>{optimization.suggestions.length>0&&<button onClick={()=>setTab('planner')} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-600 px-4 py-2 text-sm font-bold hover:bg-slate-800">Review itinerary<ArrowRight size={15}/></button>}</div>
              {optimization.suggestions.length>0&&<><div className="mt-5 grid gap-3 lg:grid-cols-2">{optimization.suggestions.map(suggestion=><article key={suggestion.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-4"><div className="flex items-start justify-between gap-3"><div><span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">{suggestion.category}{suggestion.affectedDay?` · Day ${suggestion.affectedDay}`:''}</span><h3 className="mt-1 font-bold">{suggestion.title}</h3></div><strong className="shrink-0 text-emerald-300">Save ~PHP {suggestion.estimatedSavings.toLocaleString()}</strong></div><p className="mt-3 text-sm text-slate-300">{suggestion.description}</p><p className="mt-2 text-xs leading-relaxed text-amber-200"><strong>Tradeoff:</strong> {suggestion.tradeoff}</p></article>)}</div><div className="mt-4 grid gap-3 border-t border-slate-800 pt-4 sm:grid-cols-2"><div><p className="text-xs uppercase text-slate-500">Potential combined savings</p><strong className="text-xl text-emerald-300">~PHP {optimization.combinedEstimatedSavings.toLocaleString()}</strong></div><div><p className="text-xs uppercase text-slate-500">Projected spend if all are applied</p><strong className="text-xl">~PHP {optimization.projectedSpendIfAllApplied.toLocaleString()}</strong>{optimization.remainingGapAfterSuggestions>0&&<p className="mt-1 text-xs text-red-300">Still PHP {optimization.remainingGapAfterSuggestions.toLocaleString()} above the target.</p>}</div></div></>}
              <p className="mt-4 text-xs text-slate-500">{optimization.disclaimer}</p>
            </section>}
            {itinerary?.costSharing&&<div className="mt-5 rounded-md border border-slate-800 p-4"><h2 className="font-bold">Equal-share guide</h2><p className="mt-1 text-sm text-slate-400">{PARTY_TYPE_LABELS[itinerary.costSharing.partyType]} group with {itinerary.costSharing.travelers} traveler{itinerary.costSharing.travelers===1?'':'s'}. The lead traveler pays the booking hold; the group settles these shares separately.</p><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{itinerary.costSharing.plannedSpendShares.map((amount,index)=><div key={index} className="border-t border-slate-700 py-2"><small className="text-slate-500">Traveler {index+1}</small><p className="font-mono">PHP {amount.toLocaleString()}</p></div>)}</div></div>}
            <p className="mt-4 text-xs text-slate-500">Accommodation is shared by the group. Food, transport, and activities are estimated per person and multiplied once. Final venue prices may change.</p>
          </> : <p className="text-slate-400">Generate a plan to calculate accommodation and estimated local costs.</p>}</div>}
          {tab === 'compare' && <div className="space-y-6">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 sm:p-6">
              <div className="flex max-w-full items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300"><Plane size={20}/></span><div className="min-w-0"><h2 className="break-words font-bold">Search one trip across providers</h2><p className="mt-1 break-words text-sm text-slate-400">Compare normalized flight, hotel, and activity results. Prices are references only; TravelMate does not complete external bookings.</p></div></div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-xs text-slate-400">Flight origin<input value={flightOrigin} onChange={event=>{setFlightOrigin(event.target.value);setTravelOptions(null);}} placeholder="Manila, Philippines" className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white"/></label><label className="text-xs text-slate-400">Destination<input value={destination} onChange={event=>changeDestination(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white"/></label><label className="text-xs text-slate-400">Departure<input type="date" value={startDate} readOnly className="mt-1 min-h-11 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 text-slate-300"/></label><label className="text-xs text-slate-400">Return<input type="date" value={endDate} readOnly className="mt-1 min-h-11 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 text-slate-300"/></label></div>
              <div className="mt-4 flex flex-wrap items-center gap-3"><button disabled={comparisonBusy||travelers>9||flightOrigin.trim().length<2||destination.trim().length<2} onClick={()=>void searchComparison()} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-amber-400 px-5 py-2 font-extrabold text-slate-950 hover:bg-amber-300 disabled:opacity-50">{comparisonBusy?'Checking providers...':'Compare prices'}<ArrowRight size={16}/></button><p className="text-xs text-slate-500">{travelers} traveler{travelers===1?'':'s'} · dates and party size come from the Plan tab</p></div>
              {comparisonMessage&&<p role="status" className="mt-4 rounded-lg border border-slate-700 bg-slate-950/50 px-4 py-3 text-sm text-slate-300">{comparisonMessage}</p>}
            </section>

            <section aria-labelledby="flight-results-heading"><div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-800 pb-3"><div><p className="text-xs font-bold uppercase tracking-wider text-cyan-300">Flights</p><h2 id="flight-results-heading" className="text-lg font-bold">{flightOrigin} to {destination}</h2></div>{travelOptions&&<span className="text-xs text-slate-500">Fetched {new Date(travelOptions.fetchedAt).toLocaleString()} · {travelOptions.provider.isLive?'Amadeus production':'Amadeus test/non-live'}</span>}</div>
              {!travelOptions?<p className="py-8 text-center text-sm text-slate-500">Run a comparison to retrieve flight offers.</p>:travelOptions.flights.length===0?<p className="py-8 text-center text-sm text-slate-400">{travelOptions.flightMessage}</p>:<div className="mt-4 grid gap-3 lg:grid-cols-2">{travelOptions.flights.map(flight=><article key={flight.id} className="rounded-xl border border-slate-800 bg-slate-900/45 p-4"><div className="flex items-start justify-between gap-3"><div><span className="text-xs font-bold uppercase text-cyan-300">{flight.airline} · {flight.stops===0?'Nonstop':`${flight.stops} stop${flight.stops===1?'':'s'}`}</span><h3 className="mt-1 text-lg font-bold">{flight.origin} → {flight.destination}</h3></div><strong className="text-lg text-amber-300">{flight.currency} {flight.price.toLocaleString()}</strong></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><small className="text-slate-500">Depart</small><p>{offerTime(flight.departure)}</p></div><div><small className="text-slate-500">Arrive</small><p>{offerTime(flight.arrival)}</p></div>{flight.returnDeparture&&<div><small className="text-slate-500">Return departure</small><p>{offerTime(flight.returnDeparture)}</p></div>}{flight.returnArrival&&<div><small className="text-slate-500">Return arrival</small><p>{offerTime(flight.returnArrival)}</p></div>}</div><p className="mt-3 text-xs text-slate-500">Duration {flight.duration} · {flight.seatsAvailable===undefined?'Seat count unavailable':`${flight.seatsAvailable} bookable seat${flight.seatsAvailable===1?'':'s'}`} · fetched {new Date(flight.fetchedAt).toLocaleString()}</p><p className="mt-2 text-xs text-amber-200">Search result only. Recheck fare and availability with the provider before booking.</p></article>)}</div>}
            </section>

            <section aria-labelledby="hotel-results-heading"><div className="border-b border-slate-800 pb-3"><p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Hotels</p><h2 id="hotel-results-heading" className="text-lg font-bold">TravelMate listings and Amadeus offers</h2></div><div className="mt-4 grid gap-3 lg:grid-cols-2">{stayOptions.map(stay=>{const nights=Math.max(1,tripDays-1);return <article key={`compare-${stay.id}`} className="rounded-xl border border-slate-800 bg-slate-900/45 p-4"><span className="text-xs font-bold uppercase text-emerald-300">TravelMate database · not live</span><h3 className="mt-1 font-bold">{stay.name}</h3><p className="text-sm text-slate-400">{stay.address}</p><strong className="mt-3 block text-amber-300">PHP {(stay.price*nights).toLocaleString()} · {nights} night{nights===1?'':'s'}</strong><p className="mt-2 text-xs text-slate-500">PHP {stay.price.toLocaleString()}/night · {stay.available}/{stay.capacity} guest slots recorded</p><button onClick={()=>{setSelectedStayId(stay.id);setSelectedLiveStayId('');setTab('planner');setMessage(`${stay.name} selected for the itinerary.`);}} className="mt-4 rounded-lg border border-emerald-500/50 px-3 py-2 text-sm font-bold text-emerald-300">Select for plan</button></article>})}{liveAccommodations.map(stay=><article key={`compare-${stay.id}`} className="rounded-xl border border-slate-800 bg-slate-900/45 p-4"><span className="text-xs font-bold uppercase text-cyan-300">Amadeus {stay.isLive?'live':'test/non-live'}</span><h3 className="mt-1 font-bold">{stay.name}</h3><p className="text-sm text-slate-400">{stay.address}</p><strong className="mt-3 block text-amber-300">{stay.currency} {stay.total.toLocaleString()} total</strong><p className="mt-2 text-xs text-slate-500">{stay.currency} {stay.nightlyRate.toLocaleString()}/night · fetched {new Date(stay.fetchedAt).toLocaleString()}</p><p className="mt-2 text-xs text-slate-400">{stay.roomDescription}</p><button onClick={()=>{setSelectedStayId('');setSelectedLiveStayId(stay.id);setTab('planner');setMessage(`${stay.name} selected for the itinerary. Its signed offer price will be verified by the server.`);}} className="mt-4 rounded-lg border border-cyan-500/50 px-3 py-2 text-sm font-bold text-cyan-300">Select for plan</button></article>)}</div>{travelOptions&&stayOptions.length===0&&liveAccommodations.length===0&&<p className="py-8 text-center text-sm text-slate-400">No hotel options were returned for this destination and date.</p>}
            </section>

            <section aria-labelledby="activity-results-heading"><div className="border-b border-slate-800 pb-3"><p className="text-xs font-bold uppercase tracking-wider text-violet-300">Activities</p><h2 id="activity-results-heading" className="text-lg font-bold">Local and external experiences</h2></div>{!travelOptions?<p className="py-8 text-center text-sm text-slate-500">Run a comparison to retrieve activity options.</p>:travelOptions.activities.length===0?<p className="py-8 text-center text-sm text-slate-400">{travelOptions.activityMessage}</p>:<div className="mt-4 grid gap-3 lg:grid-cols-2">{travelOptions.activities.map(activity=><article key={activity.id} className="rounded-xl border border-slate-800 bg-slate-900/45 p-4"><div className="flex items-start justify-between gap-3"><div><span className="text-xs font-bold uppercase text-violet-300">{activity.provider==='amadeus'?`Amadeus ${activity.isLive?'live':'test/non-live'}`:'TravelMate approved listing'}</span><h3 className="mt-1 font-bold">{activity.name}</h3></div><strong className="shrink-0 text-amber-300">{activity.currency} {activity.price.toLocaleString()}</strong></div><p className="mt-2 text-sm text-slate-400">{activity.description}</p><p className="mt-3 text-xs text-slate-500">{activity.location}{activity.rating!==undefined?` · Rating ${activity.rating}/5`:''} · fetched {new Date(activity.fetchedAt).toLocaleString()}</p><div className="mt-4 flex flex-wrap gap-2"><button onClick={()=>addComparedActivity(activity.name)} className="inline-flex items-center gap-2 rounded-lg border border-violet-500/50 px-3 py-2 text-sm font-bold text-violet-300"><Ticket size={14}/>Add to preferences</button>{activity.referenceUrl&&<a href={activity.referenceUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-bold">Provider details</a>}</div></article>)}</div>}
            </section>
          </div>}
          {tab === 'market' && <div className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-800 pb-4"><label className="w-full max-w-sm text-xs text-slate-400">Show TravelMate stays in<select value={localMunicipality||''} onChange={e=>changeDestination(`${e.target.value}, Cebu, Philippines`)} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-white"><option value="" disabled>Select a supported Cebu location</option>{CEBU_LOCATIONS.map(location=><option key={location} value={location}>{location}, Cebu</option>)}</select></label><p className="text-sm text-slate-400">{stayOptions.length} approved {stayOptions.length===1?'stay':'stays'} found</p></div>{stayOptions.length===0?<p className="py-10 text-center text-slate-400">No approved hotel, inn, or stay is available in {destination} yet.</p>:<div className="grid md:grid-cols-2 gap-4">{stayOptions.map(item=>{const nights=Math.max(1,tripDays-1);return <article key={item.id} className="overflow-hidden border border-slate-800 rounded-md"><div className="relative aspect-[16/9] bg-slate-900"><Image src={item.imageUrl?.startsWith('/')?item.imageUrl:'/travel-illustration.png'} alt={item.name} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover"/></div><div className="p-5"><span className="text-xs uppercase text-cyan-300">{item.municipality} · hotel / inn / stay</span><h3 className="font-bold text-lg">{item.name}</h3><p className="mt-1 text-sm text-slate-400">{item.address}</p><p className="mt-3">Owner-listed PHP {item.price.toLocaleString()}/night</p><strong className="text-lg text-amber-300">{nights} night{nights===1?'':'s'}: PHP {(item.price*nights).toLocaleString()}</strong><p className="mt-2 text-xs text-slate-500">Database listing · not a live external price · {item.amenities.join(' · ')} · {item.available}/{item.capacity} guest slots available</p><p className="mt-2 text-xs leading-relaxed text-slate-400">{item.description}</p><button disabled={busy||item.available<travelers} onClick={()=>void action({action:'book',listingId:item.id,guests:travelers,nights},'Stay booked by the lead traveler; payment status is simulated as PAID_HELD until PayMongo is configured.')} className="mt-4 bg-emerald-400 text-slate-950 px-3 py-2 rounded-md font-bold text-sm">Book {nights}-night stay</button></div></article>})}</div>}</div>}
          {tab === 'bookings' && <div className="space-y-8">
            <section>
              <h2 className="font-bold">Saved plans ({data.trips.length})</h2>
              <p className="mt-1 text-sm text-slate-400">These plans belong only to your account and remain available after signing out.</p>
              {data.trips.length===0?<p className="mt-4 rounded-md border border-dashed border-slate-700 p-8 text-center text-slate-400">No saved trips yet. Generate a plan and choose Save trip.</p>:<div className="mt-4 grid gap-3 md:grid-cols-2">{data.trips.map(trip=>{
                const plan=savedItinerary(trip.itinerary);const source=plan?.source==='openai'?'OpenAI generated':plan?.source==='gemini'?'Gemini generated':'Demo/estimated fallback';const past=trip.endDate<new Date().toISOString().slice(0,10);
                return <article key={trip.id} className="min-w-0 max-w-full rounded-md border border-slate-800 bg-slate-900/50 p-4"><div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-3"><div className="min-w-0 max-w-full"><span className={`text-[10px] uppercase tracking-wider ${past?'text-slate-500':'text-emerald-300'}`}>{past?'Previous trip':'Upcoming trip'}</span><h3 className="break-words font-bold">{trip.destination}</h3><p className="break-words text-xs text-slate-400">{trip.startDate} – {trip.endDate} · {trip.travelers} traveler{trip.travelers===1?'':'s'}</p></div><strong className="shrink-0 font-mono text-sm">PHP {trip.budget.toLocaleString()}</strong></div><p className="mt-2 break-words text-xs text-cyan-200">{source} · saved {new Date(trip.createdAt).toLocaleDateString()}</p><div className="mt-4 flex flex-wrap gap-2"><button disabled={busy} onClick={()=>loadTrip(trip,true)} className="flex items-center gap-1 rounded border border-slate-600 px-2 py-1 text-xs"><Eye size={13}/>View</button><button disabled={busy} onClick={()=>loadTrip(trip,false)} className="flex items-center gap-1 rounded border border-slate-600 px-2 py-1 text-xs"><Pencil size={13}/>Edit / regenerate</button><button disabled={busy} onClick={()=>void action({action:'duplicate-trip',id:trip.id},'Trip duplicated.')} className="flex items-center gap-1 rounded border border-slate-600 px-2 py-1 text-xs"><Copy size={13}/>Duplicate</button><button disabled={busy} onClick={()=>{if(window.confirm(`Delete the saved trip to ${trip.destination}? This cannot be undone.`))void action({action:'delete-trip',id:trip.id},'Saved trip deleted.').then(ok=>{if(ok&&editingTripId===trip.id)setEditingTripId(null);});}} className="flex items-center gap-1 rounded border border-red-800 px-2 py-1 text-xs text-red-300"><Trash2 size={13}/>Delete</button></div></article>;
              })}</div>}
            </section>
            <section>
              <h2 className="font-bold">Accommodation bookings ({data.bookings.length})</h2>
              {data.bookings.length===0?<p className="mt-3 text-sm text-slate-400">No accommodation bookings yet.</p>:data.bookings.map(item=><article key={item.id} className="border-b border-slate-800 py-4 flex flex-wrap justify-between gap-3"><div><strong>{data.listings.find(x=>x.id===item.listingId)?.name || item.listingId}</strong><p className="text-xs text-slate-400">{item.status} · {item.paymentStatus} · {item.nights > 1 ? `${item.nights} nights · ` : ''}PHP {item.amount.toLocaleString()}</p></div><div className="flex gap-2"><button disabled={busy||item.status==='cancelled'||item.status==='completed'} onClick={()=>void action({action:'request-change',id:item.id,reason:'Traveler requested a modification.'},'Modification sent for review.')} className="border border-slate-600 px-2 py-1 rounded text-xs disabled:opacity-40">Change</button><button disabled={busy||item.status==='cancelled'||item.status==='completed'} onClick={()=>void action({action:'request-cancel',id:item.id,reason:'Traveler requested cancellation.'},'Cancellation sent for review.')} className="border border-red-700 text-red-300 px-2 py-1 rounded text-xs disabled:opacity-40">Cancel</button></div></article>)}</section>
          </div>}
          {tab === 'profile' && <section className="max-w-xl space-y-7">
            <div><p className="text-slate-400 mb-4">Manage your contact details independently from profile verification.</p><div className="grid grid-cols-2 gap-3"><div className="border-t border-slate-700 py-3"><small>Email status</small><p>{data.user.emailVerified?'Verified':'Unverified'}</p></div><div className="border-t border-slate-700 py-3"><small>Trust score</small><p>{data.user.trustScore}/100</p></div></div></div>
            <form onSubmit={e=>{e.preventDefault();void saveProfile(e.currentTarget);}} className="space-y-3">
              <label className="block text-xs text-slate-400">Name<input required minLength={2} maxLength={80} name="name" defaultValue={data.user.name} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-white"/></label>
              <label className="block text-xs text-slate-400">Email<input readOnly value={data.user.email} className="mt-1 w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-slate-400"/></label>
              <label className="block text-xs text-slate-400">Phone<input maxLength={30} name="phone" defaultValue={data.user.phone || ''} placeholder="Phone number" className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-white"/></label>
              <label className="block text-xs text-slate-400">Bio<textarea maxLength={500} name="bio" defaultValue={data.user.bio || ''} rows={4} placeholder="Tell us about your travel preferences" className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-white"/></label>
              <button disabled={busy} className="bg-amber-400 text-slate-950 px-4 py-2 rounded-md font-bold disabled:opacity-50">{busy?'Saving...':'Save profile'}</button>
            </form>
            {data.user.profileStatus!=='verified'&&<form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void action({action:'submit-profile',phone:f.get('phone'),bio:f.get('bio')},'Profile submitted for admin review.')}} className="space-y-3 border-t border-slate-800 pt-6"><div><h2 className="font-bold">Profile verification</h2><p className="mt-1 text-sm text-slate-400">Verification does not block login. Until approved, booking and listing publication remain unavailable in Limited Mode.</p></div><input required maxLength={30} name="phone" defaultValue={data.user.phone || ''} placeholder="Verification phone number" className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2"/><textarea required maxLength={500} name="bio" defaultValue={data.user.bio || ''} placeholder="Verification details" className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2"/><button disabled={busy} className="border border-amber-500 text-amber-300 px-4 py-2 rounded-md font-bold disabled:opacity-50">Submit for verification</button></form>}
          </section>}
        </main>
      </div>
      {activityEditor && editorDay && <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="activity-editor-title" onMouseDown={(event)=>{if(event.target===event.currentTarget)setActivityEditor(null);}}>
        <form key={`${activityEditor.dayIndex}-${activityEditor.activityIndex ?? 'new'}`} onSubmit={(event)=>{event.preventDefault();submitActivity(event.currentTarget);}} className="mx-auto mt-8 max-w-xl rounded-2xl border border-slate-700 bg-[#0b1626] p-5 shadow-2xl sm:p-6">
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-amber-300">Day {editorDay.day} · {editorDay.date}</p><h2 id="activity-editor-title" className="mt-1 text-xl font-bold">{editorActivity?'Edit activity':'Add custom activity'}</h2><p className="mt-1 text-sm text-slate-400">Costs are entered for the whole group and totals update automatically.</p></div><button type="button" onClick={()=>setActivityEditor(null)} aria-label="Close activity editor" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"><X size={18}/></button></div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2 text-xs font-medium text-slate-300">Activity title<input autoFocus required maxLength={160} name="title" defaultValue={editorActivity?.title || ''} placeholder="e.g. Visit the National Museum" className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-600 focus:border-amber-400"/></label>
            <label className="text-xs font-medium text-slate-300">Time<input required maxLength={30} name="time" defaultValue={editorActivity?.time || '09:00 AM'} placeholder="09:00 AM" className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-amber-400"/></label>
            <label className="text-xs font-medium text-slate-300">Category<select required name="category" defaultValue={editorActivity?.category || 'activity'} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-amber-400"><option value="activity">Activity</option><option value="food">Food</option><option value="transport">Transport</option><option value="accommodation">Accommodation</option><option value="misc">Miscellaneous</option></select></label>
            <label className="sm:col-span-2 text-xs font-medium text-slate-300">Estimated group cost (PHP)<input required type="number" min="0" max="10000000" step="0.01" name="estimatedCost" defaultValue={editorActivity?.estimatedCost ?? 0} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-amber-400"/></label>
            <label className="sm:col-span-2 text-xs font-medium text-slate-300">Description<textarea maxLength={1000} name="description" defaultValue={editorActivity?.description || ''} rows={4} placeholder="Add helpful details, location, or reminders." className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-600 focus:border-amber-400"/></label>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={()=>setActivityEditor(null)} className="min-h-11 rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-800">Cancel</button><button type="submit" className="min-h-11 rounded-lg bg-amber-400 px-5 py-2 text-sm font-extrabold text-slate-950 hover:bg-amber-300">{editorActivity?'Save activity':'Add activity'}</button></div>
        </form>
      </div>}
      {selectedDay && itinerary && <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={`Day ${selectedDay.day} full itinerary`}>
        <div className="mx-auto max-w-4xl overflow-hidden rounded-md border border-slate-700 bg-[#07111f] shadow-2xl">
          <div className="relative aspect-[21/9] min-h-[180px]">
            <Image src={placeImage(selectedDay.imageUrl, LOCAL_DAY_IMAGES[selectedDay.day-1] || '/travel-illustration.png')} alt={`${selectedDay.theme} in ${itinerary.destination}`} fill sizes="(max-width: 900px) 100vw, 900px" className="object-cover" />
            <button type="button" onClick={()=>setSelectedDay(null)} aria-label="Close day details" title="Close details" className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-md bg-slate-950/90 hover:bg-slate-800"><X size={20}/></button>
            <span className="absolute bottom-3 left-3 bg-slate-950/90 px-3 py-2 text-sm font-bold text-amber-300">DAY {selectedDay.day}</span>
            {selectedDay.imageAttribution&&<a href={selectedDay.imageAttribution.sourceUrl} target="_blank" rel="noreferrer" title={`${selectedDay.imageAttribution.creator} · ${selectedDay.imageAttribution.license}`} className="absolute bottom-3 right-3 max-w-[65%] truncate rounded bg-slate-950/85 px-2 py-1 text-[10px] text-slate-200">Photo: {selectedDay.imageAttribution.creator} · {selectedDay.imageAttribution.license}</a>}
          </div>
          <div className="p-4 sm:p-6">
            <div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-bold">{selectedDay.theme}</h2><p className="text-sm text-slate-400">{selectedDay.date} · {itinerary.destination}</p></div><div className="text-right"><strong className="font-mono text-lg">PHP {selectedDay.totalCost.toLocaleString()}</strong><p className="flex items-center justify-end gap-1 text-xs text-emerald-200"><BusFront size={13}/>Ride/boat fare PHP {(selectedDay.rideFare||0).toLocaleString()}</p></div></div>
            {selectedDay.travelNote && <p className="mt-4 flex items-start gap-2 border-l-2 border-cyan-400 pl-3 text-sm text-cyan-100"><Clock3 size={16} className="mt-0.5 shrink-0"/>{selectedDay.travelNote}</p>}
            {selectedDay.crowdLevel && <p className="mt-3 rounded-md border border-violet-900 bg-violet-950/30 px-3 py-2 text-xs text-violet-200"><strong className="capitalize">{selectedDay.crowdLevel} estimated crowd.</strong> {selectedDay.crowdNote}</p>}
            <div className="mt-6 divide-y divide-slate-800 border-y border-slate-800">{selectedDay.activities.map((item,index)=><article key={`${item.time}-${index}`} className="grid grid-cols-[88px_1fr] gap-3 py-4 sm:grid-cols-[128px_1fr_auto] sm:items-center">
              <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-slate-900"><Image src={placeImage(item.imageUrl, placeImage(selectedDay.imageUrl, '/travel-illustration.png'))} alt={`${item.title} in ${itinerary.destination}`} fill sizes="128px" className="object-cover" />{item.imageAttribution&&<a href={item.imageAttribution.sourceUrl} target="_blank" rel="noreferrer" title={`${item.imageAttribution.creator} · ${item.imageAttribution.license}`} className="absolute bottom-1 right-1 rounded bg-slate-950/85 px-1 text-[8px] text-slate-200">Photo info</a>}</div>
              <div><p className="text-xs uppercase text-cyan-300">{item.time} · {item.category}</p><h3 className="font-semibold">{item.title}</h3><p className="mt-1 text-xs leading-relaxed text-slate-400">{item.description}</p><p className="mt-2 font-mono text-sm sm:hidden">Estimated price: {travelers>1&&item.unitCost!==undefined?`PHP ${item.unitCost.toLocaleString()}/person · PHP ${item.estimatedCost.toLocaleString()} group`:`PHP ${item.estimatedCost.toLocaleString()}`}</p></div>
              <p className="hidden text-right font-mono text-sm sm:block"><span className="text-xs uppercase tracking-wide text-slate-500">Estimated price</span><br/>{travelers>1&&item.unitCost!==undefined?<>PHP {item.unitCost.toLocaleString()}/person<small className="block text-slate-500">PHP {item.estimatedCost.toLocaleString()} group</small></>:<>PHP {item.estimatedCost.toLocaleString()}</>}</p>
            </article>)}</div>
            {itinerary.accommodation && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm"><div className="flex items-center gap-2 text-amber-200"><BedDouble size={17}/><span>{itinerary.accommodation.name} · PHP {itinerary.accommodation.nightlyRate.toLocaleString()}/night</span></div>{selectedDay.returnToStayAt&&<strong>Return by {selectedDay.returnToStayAt}</strong>}</div>}
          </div>
        </div>
      </div>}
    </div>
  );
}
