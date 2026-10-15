'use client';
import { useNonGoogleMapView } from '@/components/common/PlacesPhotoMapBoundary';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Bike, Car, Footprints, LocateFixed, MapPin, Navigation, Search, Square, X } from 'lucide-react';
import { useModalAccessibility } from '@/hooks/use-modal-accessibility';
import { useTripLocation, type TripLocation } from '@/hooks/use-trip-location';
import { useRouteGuidance } from '@/hooks/use-route-guidance';
import { navigationDistance, navigationDuration } from '@/lib/navigation';
import type { NavigationDestination, NavigationMode } from '@/lib/contracts';
import type { ActivityMapWeather, DayMapRoute, MapSelection, TripMapActivity, TripMapManifest } from '@/lib/trip-navigation';
import { createTripNavigationClient } from '@/services/trip-navigation.service';
import { searchNavigationPlaces } from '@/services/navigation.service';
import { SavedTripCoverPhoto } from './SavedTripCoverPhoto';
import { SmartDayManager } from './SmartDayManager';
import type { SavedTrip } from '@/lib/contracts';
import type { ManagedTripState } from '@/services/smart-itinerary.service';
import { DayActivityTimeline } from './DayActivityTimeline';
import { dayTimeline, timelineSchedule } from '@/lib/trip-map-timeline';
import { TripDayMapCanvas } from './TripDayMapCanvas';
import styles from './SavedTripMap.module.css';

const modes = [{ id: 'walking', label: 'Walking', Icon: Footprints }, { id: 'cycling', label: 'Cycling', Icon: Bike }, { id: 'driving', label: 'Driving', Icon: Car }] as const;
export function SavedTripMapDialog({ tripId, onClose, initialDayIndex = 0, onTripUpdated }: { tripId: string; onClose: () => void; initialDayIndex?: number; onTripUpdated?: (trip: SavedTrip) => void }) {
  useNonGoogleMapView();
  const dialog = useRef<HTMLDivElement>(null), close = useRef<HTMLButtonElement>(null), lookupController = useRef<AbortController | null>(null), routeController = useRef<AbortController | null>(null);
  const client = useMemo(() => createTripNavigationClient(tripId), [tripId]);
  const [manifest, setManifest] = useState<TripMapManifest | null>(null), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  const [dayIndex, setDayIndex] = useState(initialDayIndex), [selected, setSelected] = useState(0), [resolved, setResolved] = useState<Record<string, TripMapActivity>>({});
  const [choices, setChoices] = useState<Record<string, MapSelection>>({}), [candidates, setCandidates] = useState<NavigationDestination[]>([]);
  const [query, setQuery] = useState(''), [lookupBusy, setLookupBusy] = useState(false), [lookupMessage, setLookupMessage] = useState('');
  const [mode, setMode] = useState<NavigationMode>('walking'), [dayRoute, setDayRoute] = useState<{ key: string; value: DayMapRoute } | null>(null), [routeBusy, setRouteBusy] = useState(false), [routeMessage, setRouteMessage] = useState('');
  const [weather, setWeather] = useState<{ key: string; value: ActivityMapWeather } | null>(null), [showCurrent, setShowCurrent] = useState(false);
  const [navActive, setNavActive] = useState(false), [manualOrigin, setManualOrigin] = useState<(NavigationDestination & { selectedAt: number }) | null>(null), [originQuery, setOriginQuery] = useState(''), [originResults, setOriginResults] = useState<NavigationDestination[]>([]);
  const [originBusy, setOriginBusy] = useState(false), [originMessage, setOriginMessage] = useState('');
  const restoreSelection = useRef<{ activityId?: string; dayIndex: number } | null>(null);
  const gps = useTripLocation();
  useModalAccessibility({ active: true, containerRef: dialog, initialFocusRef: close, onClose });
  const day = manifest?.days[dayIndex];
  const activities = useMemo(() => day?.activities.map(activity => resolved[dayIndex + ':' + activity.index] || activity) || [], [day, resolved, dayIndex]);
  const { timeline, budget, stops } = useMemo(() => dayTimeline(activities), [activities]);
  const activity = activities.find(item => item.index === selected && !item.budgetOnly), activityKey = dayIndex + ':' + selected;
  const selection = choices[activityKey] || { dayIndex, activityIndex: selected };
  const selectionKey = JSON.stringify(selection), pointKey = activity?.place ? activity.place.latitude + ':' + activity.place.longitude : '';
  const weatherKey = activityKey + ':' + pointKey + ':' + selectionKey + ':' + showCurrent;
  const routeKey = dayIndex + ':' + mode + ':' + JSON.stringify(activities.map(item => item.place?.id || null));
  const selectedDestination = navActive && activity?.place ? activity.place : null;
  const manualPosition = useMemo<TripLocation | null>(() => manualOrigin ? { latitude: manualOrigin.latitude, longitude: manualOrigin.longitude, accuracy: 0, timestamp: manualOrigin.selectedAt } : null, [manualOrigin]);
  const live = gps.status === 'live', origin = manualPosition || gps.position;
  const canRoute = Boolean(manualPosition || live && gps.position && gps.position.accuracy <= 100);
  const guidance = useRouteGuidance(origin, canRoute, selectedDestination, mode);
  const roadRoute = navActive ? guidance.route : dayRoute?.key === routeKey ? dayRoute.value.route : null;
  const displayedWeather = weather?.key === weatherKey ? weather.value : null;

  useEffect(() => {
    const controller = new AbortController();
    void client.manifest(controller.signal).then(value => { if (!controller.signal.aborted) { const focus = restoreSelection.current; const foundDay = focus?.activityId ? value.days.findIndex(day => day.activities.some(activity => activity.activityId === focus.activityId)) : -1; const nextDay = foundDay >= 0 ? foundDay : Math.min(focus?.dayIndex ?? initialDayIndex, Math.max(0, value.days.length - 1)); setManifest(value); setDayIndex(nextDay); setSelected((focus?.activityId ? value.days[nextDay]?.activities.find(activity => activity.activityId === focus.activityId)?.index : undefined) ?? dayTimeline(value.days[nextDay]?.activities || []).timeline[0]?.index ?? -1); restoreSelection.current = null; } })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'This trip map could not load.'); });
    return () => controller.abort();
  }, [client, attempt, initialDayIndex]);
  useEffect(() => {
    if (!manifest || !activity) return;
    const controller = new AbortController();
    const input = JSON.parse(selectionKey) as MapSelection;
    void client.activity(input, controller.signal).then(result => {
      if (!controller.signal.aborted && result.activity.index === input.activityIndex) setResolved(current => ({ ...current, [activityKey]: result.activity }));
    }).catch(() => { /* Saved evidence and the photo placeholder remain usable. */ });
    return () => controller.abort();
    // A photo response must not start another request for itself.
  }, [client, manifest, activityKey, selectionKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!manifest || !pointKey) return;
    const controller = new AbortController();
    void client.weather(JSON.parse(selectionKey), showCurrent, controller.signal).then(value => {
      if (!controller.signal.aborted) setWeather({ key: weatherKey, value });
    }).catch(reason => {
      if (!controller.signal.aborted) setWeather({ key: weatherKey, value: { status: 'unavailable', kind: showCurrent ? 'current' : 'forecast', message: reason instanceof Error ? reason.message : 'Weather is unavailable.' } });
    });
    return () => controller.abort();
  }, [client, manifest, pointKey, selectionKey, showCurrent, weatherKey]);
  useEffect(() => () => { lookupController.current?.abort(); routeController.current?.abort(); }, []);

  function endNavigation() { guidance.reset(); gps.stop(); setNavActive(false); setManualOrigin(null); setOriginResults([]); setOriginBusy(false); }
  function managedTripSaved(state: ManagedTripState, activityId?: string) {
    restoreSelection.current = { activityId, dayIndex };
    endNavigation(); lookupController.current?.abort(); routeController.current?.abort(); client.invalidate();
    setResolved({}); setChoices({}); setDayRoute(null); setWeather(null); setRouteBusy(false); setLookupBusy(false); setRouteMessage(''); setLookupMessage(''); setCandidates([]); setQuery(''); setManifest(null); setError(''); setAttempt(value => value + 1);
    onTripUpdated?.(state.trip);
  }
  function chooseActivity(index: number) {
    endNavigation(); lookupController.current?.abort(); setLookupBusy(false); setCandidates([]); setLookupMessage(''); setQuery('');
    setSelected(index);
  }
  function changeDay(index: number) {
    endNavigation(); lookupController.current?.abort(); routeController.current?.abort(); setRouteBusy(false); setLookupBusy(false); setCandidates([]); setLookupMessage(''); setRouteMessage(''); setQuery('');
    setDayIndex(index); setSelected(dayTimeline(manifest?.days[index]?.activities || []).timeline[0]?.index ?? -1);
  }
  function changeMode(next: NavigationMode) { guidance.reset(); routeController.current?.abort(); setRouteBusy(false); setRouteMessage(''); setMode(next); }
  async function lookup(event?: FormEvent, placeId?: string) {
    event?.preventDefault();
    const search = query.trim() || activity?.title || '';
    if (search.length < 2) return;
    lookupController.current?.abort();
    const controller = new AbortController(); lookupController.current = controller;
    setLookupBusy(true); setLookupMessage('');
    try {
      const input = { dayIndex, activityIndex: selected, query: search, ...(placeId ? { placeId } : {}) };
      const result = await client.activity(input, controller.signal);
      if (controller.signal.aborted) return;
      setCandidates(result.candidates.map(place => ({ ...place, label: place.address }))); setLookupMessage(result.message);
      if (result.activity.place) {
        guidance.reset(); setResolved(current => ({ ...current, [activityKey]: result.activity })); setChoices(current => ({ ...current, [activityKey]: input })); setCandidates([]);
      }
    } catch (reason) { if (!controller.signal.aborted) setLookupMessage(reason instanceof Error ? reason.message : 'Place search is unavailable.'); }
    finally { if (!controller.signal.aborted) setLookupBusy(false); }
  }
  async function routeDay() {
    routeController.current?.abort();
    const controller = new AbortController(); routeController.current = controller; setRouteBusy(true); setRouteMessage('');
    try {
      const value = await client.route(dayIndex, mode, Object.values(choices).filter(item => item.dayIndex === dayIndex), controller.signal);
      if (!controller.signal.aborted) { setDayRoute({ key: routeKey, value }); }
    } catch (reason) { if (!controller.signal.aborted) setRouteMessage(reason instanceof Error ? reason.message : 'A road route is unavailable. The dashed preview is not navigable.'); }
    finally { if (!controller.signal.aborted) setRouteBusy(false); }
  }
  async function searchOrigin(event: FormEvent) {
    event.preventDefault(); lookupController.current?.abort();
    const controller = new AbortController(); lookupController.current = controller;
    setOriginBusy(true); setOriginMessage('');
    try {
      const matches = await searchNavigationPlaces(originQuery, controller.signal);
      if (!controller.signal.aborted) { setOriginResults(matches); setOriginMessage(matches.length ? 'Choose the exact starting point.' : 'No starting points found. Add a street, city and country.'); }
    } catch (reason) { if (!controller.signal.aborted) setOriginMessage(reason instanceof Error ? reason.message : 'Starting point search is unavailable.'); }
    finally { if (!controller.signal.aborted) setOriginBusy(false); }
  }
  return createPortal(<div className={styles.backdrop}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="trip-map-title" tabIndex={-1} className={styles.dialog}>
      <header className={styles.header}><div><p className={styles.eyebrow}>TravelMate · saved itinerary map</p><h2 id="trip-map-title">{manifest?.destination || 'Your saved trip'}</h2><p>Explore each day’s saved stops, then choose how to reach an exact place.</p></div><button ref={close} onClick={onClose} aria-label="Close trip map" className={styles.close}><X size={22}/></button></header>
      {!manifest && <div role="status" className={styles.loading}>{error || 'Loading this saved itinerary…'}{error && <button onClick={() => { setError(''); setAttempt(value => value + 1); }}>Retry trip map</button>}</div>}
      {manifest && !manifest.days.length && <p className={styles.notice}>This saved trip does not contain a usable daily itinerary.</p>}
      {manifest && day && <>
        <nav aria-label="Itinerary days" className={styles.days}>{manifest.days.map((item, index) => <button key={index} aria-current={dayIndex === index ? 'date' : undefined} onClick={() => changeDay(index)}>Day {item.day}<span>{item.date}</span></button>)}</nav>
        <div className={styles.dayHeading}><div><h3>Day {day.day}: {day.theme || manifest.destination}</h3><p>{day.date} · {activities.length} planned activities · times are local to the place</p></div><span>{activities.filter(item => item.place).length} mapped stops</span></div>
        {!manifest.anchor && <p role="status" className={styles.notice}>A verified destination is missing. Uncertain locations will not be pinned.</p>}
        <div className={styles.workspace}>
          <div className={styles.mapColumn}>
            <div className={styles.routeControls}><div role="group" aria-label="Travel mode">{modes.map(({ id, label, Icon }) => <button key={id} aria-pressed={mode === id} onClick={() => changeMode(id)}><Icon size={16}/>{label}</button>)}</div><button className={styles.primary} disabled={routeBusy || activities.filter(item => item.place && item.status !== 'skipped').length < 2 || navActive} onClick={() => void routeDay()}><Navigation size={16}/>{routeBusy ? 'Finding route…' : 'Show day route'}</button></div>
            <TripDayMapCanvas activities={stops} selected={selected} onSelect={chooseActivity} anchor={manifest.anchor} dayKey={tripId + ':' + dayIndex} route={roadRoute} position={gps.position} live={live}/>
            <p role="status" className={styles.routeNote}>{roadRoute ? navigationDistance(roadRoute.distanceMeters) + ' · ' + navigationDuration(roadRoute.durationSeconds) + ' estimated · OSRM road/path route · no live traffic' : 'Choose Show day route for roads and walking paths. Straight-line previews are not directions.'} {navActive ? guidance.message : routeMessage}</p>
            {dayRoute?.key === routeKey && !navActive && <p className={styles.routeNote}>{dayRoute.value.message}</p>}
            {navActive && <section aria-label="Navigate to selected activity" className={styles.navigation}>
              <h3>Navigate to {activity?.place?.name}</h3><p>Routes are estimates. GPS accuracy and mapped entrances affect the final approach.</p>
              <div className={styles.inline}><button className={styles.primary} onClick={() => { setManualOrigin(null); guidance.reset(); gps.start(); }}><LocateFixed size={16}/>Use live GPS</button><button onClick={endNavigation}><Square size={15}/>End navigation</button></div>
              <p role="status">{manualOrigin ? 'Manual start: ' + manualOrigin.label : gps.status === 'locating' ? 'Waiting for location permission and a GPS reading…' : gps.message || 'Location permission is requested only when you choose Use live GPS.'}</p>
              {gps.position && <p>Accuracy ±{Math.round(gps.position.accuracy)} m · GPS updated {new Date(gps.position.timestamp).toLocaleTimeString()}{gps.status === 'waiting' ? ' · last known position, signal lost' : ''}</p>}
              {gps.position && gps.position.accuracy > 100 && <p className={styles.notice}>GPS accuracy is poor. Wait for a better fix or choose a manual starting point.</p>}
              <form onSubmit={event => void searchOrigin(event)} className={styles.search}><label htmlFor="trip-map-origin">Manual starting point<input id="trip-map-origin" value={originQuery} onChange={event => { lookupController.current?.abort(); setOriginBusy(false); setOriginResults([]); setOriginMessage(''); guidance.reset(); setManualOrigin(null); setOriginQuery(event.target.value); }} placeholder="Street address, city, country" maxLength={200}/></label><button disabled={originBusy || originQuery.trim().length < 2}><Search size={16}/>{originBusy ? 'Searching…' : 'Find start'}</button></form>
              <p role="status">{originMessage}</p>{originResults.map(result => <button className={styles.result} key={result.id} onClick={() => { guidance.reset(); gps.stop(); setManualOrigin({ ...result, selectedAt: Date.now() }); setOriginResults([]); }}>{result.label}</button>)}
              <div className={styles.inline}><button className={styles.primary} disabled={!canRoute || guidance.routing} onClick={() => void guidance.requestRoute()}>{guidance.routing ? 'Finding route…' : 'Show route here'}</button>{guidance.route && !manualOrigin && <button disabled={!canRoute} onClick={guidance.startGuidance}>Follow my location</button>}</div>
              {guidance.guiding && guidance.progress && <p>Next provider instruction: {guidance.route?.steps[Math.min(guidance.progress.stepIndex + 1, guidance.route.steps.length - 1)]?.instruction}</p>}
              {guidance.route && <details><summary>Route instructions</summary><ol>{guidance.route.steps.map((step, index) => <li key={index}>{step.instruction} · {navigationDistance(step.distanceMeters)}</li>)}</ol></details>}
            </section>}
            <p className={styles.credits}>Map and place search © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a> · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">Fix the map</a>. Routing sends start/stop coordinates to the provider; GPS history is not saved.</p>
          </div>
          <details className={styles.panel} open><summary>Day activities · show or hide details</summary>
            <SmartDayManager tripId={tripId} dayIndex={dayIndex} selectedActivityId={activity?.activityId} selectedIndex={selected} mode={mode} onSaved={managedTripSaved}/>
            <DayActivityTimeline activities={timeline} budget={budget} selected={selected} onSelect={chooseActivity} currency={manifest.currency} timezone={displayedWeather?.timezone} route={dayRoute?.key === routeKey ? dayRoute.value : undefined}/>
            {activity && <section aria-label="Selected activity details" className={styles.detail}>
              <div className={styles.photo}><SavedTripCoverPhoto src={activity.place?.photo?.src} alt={activity.place ? activity.place.name + ' · verified place photograph' : 'Place photograph'} placeholderLabel="Place photo unavailable"/></div>
              {activity.place?.photo && <p className={styles.credits}><a href={activity.place.photo.attribution.sourceUrl} target="_blank" rel="noreferrer">Photo: {activity.place.photo.attribution.creator}</a> · <a href={activity.place.photo.attribution.licenseUrl || activity.place.photo.attribution.sourceUrl} target="_blank" rel="noreferrer">{activity.place.photo.attribution.license}</a> · Cropped to fit</p>}
              <h3>{activity.place?.name || activity.title}</h3><p className={styles.scheduled}>{timelineSchedule(activity).label} · {day.date}</p><p>{activity.description || 'No description was saved for this activity.'}</p>
              <p><MapPin size={15}/>{activity.place?.address && activity.place.address !== 'Not available' ? activity.place.address : activity.place ? 'Street address unavailable' : 'Choose an exact place'}</p>
              {activity.place && <p className={styles.credits}><a href={activity.place.sourceUrl} target="_blank" rel="noreferrer">Place reference</a> · {activity.locationStatus}</p>}
              <section aria-label="Activity weather" className={styles.weather}>
                <div className={styles.inline}><button aria-pressed={!showCurrent} onClick={() => setShowCurrent(false)}>Forecast</button><button aria-pressed={showCurrent} onClick={() => setShowCurrent(true)}>Current weather</button></div>
                {!activity.place ? <p>Choose an exact place to check weather.</p> : !displayedWeather ? <p role="status">Loading weather for this place…</p> : displayedWeather.status !== 'available' ? <p role="status">{displayedWeather.message || 'Weather is unavailable.'}</p> : <>
                  <h4>{displayedWeather.kind === 'current' ? 'Current weather' : 'Forecast'} · {displayedWeather.temperature} °C</h4><p>{displayedWeather.condition}{displayedWeather.precipitationProbability !== undefined ? ' · Rain chance ' + displayedWeather.precipitationProbability + '%' : ''}</p>
                  <p>{displayedWeather.localTime?.replace('T', ' ')} · {displayedWeather.timezone}</p>
                  {showCurrent && <p>Current conditions at this place; this is not the scheduled trip forecast.</p>}
                  {displayedWeather.stale && <p role="status" className={styles.notice}>Stale weather · this reading or cached forecast is older than its refresh window.</p>}
                </>}
                {displayedWeather?.fetchedAt && <p className={styles.credits}>Retrieved {new Date(displayedWeather.fetchedAt).toLocaleString()}. {displayedWeather.providerUpdatedAt ? 'Provider updated ' + displayedWeather.providerUpdatedAt : 'Provider update time is not supplied.'}</p>}
                <p className={styles.credits}>Weather by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> · grid forecast; nearby stops may share conditions.</p>
              </section>
              <button className={styles.primary + ' ' + styles.navigate} disabled={!activity.place} onClick={() => { setNavActive(true); guidance.reset(); }}><Navigation size={16}/>Navigate here</button>
              <form onSubmit={event => void lookup(event)} className={styles.search}><label htmlFor="trip-map-place">Choose an exact place<input id="trip-map-place" value={query} onChange={event => { lookupController.current?.abort(); setLookupBusy(false); setCandidates([]); setQuery(event.target.value); }} placeholder={activity.title} maxLength={200}/></label><button disabled={lookupBusy || !manifest.anchor}><Search size={16}/>{lookupBusy ? 'Searching…' : 'Find place'}</button></form>
              <p role="status">{lookupMessage}</p>{candidates.map(candidate => <button key={candidate.id} className={styles.result} onClick={() => void lookup(undefined, candidate.id)}>{candidate.label}</button>)}
            </section>}
          </details>
        </div>
      </>}
    </div>
  </div>, document.body);
}
