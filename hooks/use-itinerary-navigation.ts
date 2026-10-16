'use client';

import { useEffect, useRef, useState } from 'react';
import { legacyNavigationRedirect, validMapDay, validMapTripId } from '@/lib/retired-navigation';

export type TravelerTab = 'overview' | 'planner' | 'budget' | 'bookings' | 'notifications' | 'profile' | 'visited' | 'feedback' | 'help' | 'plan';
export type ItineraryView = { tab: TravelerTab; tripId?: string; day?: number; fromSavedTrips?: boolean; returnToSavedItinerary?: boolean; mapTripId?: string; mapDay?: number; navigationMoved?: boolean };
type Stop = { view: ItineraryView; index: number };
type Entry = Stop & { ancestors: Stop[]; session: string; version: 2; position?: number };
const key = 'travelmateItineraryView';
const tabs: TravelerTab[] = ['overview', 'planner', 'budget', 'bookings', 'notifications', 'profile', 'visited', 'feedback', 'help', 'plan'];
const sameView = (a: ItineraryView, b: ItineraryView) => a.tab === b.tab && a.tripId === b.tripId && a.day === b.day && Boolean(a.returnToSavedItinerary) === Boolean(b.returnToSavedItinerary) && a.mapTripId === b.mapTripId && a.mapDay === b.mapDay && Boolean(a.navigationMoved) === Boolean(b.navigationMoved);
const overviewOf = (view: ItineraryView): ItineraryView => ({ ...view, day: undefined });
const isOverviewOf = (parent: ItineraryView, day: ItineraryView) => (day.tab === 'planner' || day.tab === 'bookings') && day.day !== undefined && sameView(parent, overviewOf(day));
const browserHistory = () => (window as unknown as { navigation?: { currentEntry?: { index: number }; entries: () => { index: number; url?: string }[] } }).navigation;
const browserPosition = () => browserHistory()?.currentEntry?.index;
const distance = (from: Entry, to: Entry) => from.position !== undefined && to.position !== undefined ? to.position - from.position : to.index - from.index;
function browserParentIsOverview(view: ItineraryView): boolean | undefined {
  const history = browserHistory();
  if (!history?.currentEntry) return undefined;
  const parent = history.entries().find(entry => entry.index === history.currentEntry!.index - 1);
  if (!parent?.url) return false;
  const url = new URL(parent.url);
  return url.origin === window.location.origin && url.pathname === window.location.pathname && isOverviewOf(viewFromUrl('overview', url.search), view);
}

function viewFromUrl(fallback: TravelerTab, search = window.location.search): ItineraryView {
  const raw = new URLSearchParams(search);
  const params = raw.get('tab') === 'gps' ? new URLSearchParams(legacyNavigationRedirect({ trip: raw.get('trip'), day: raw.get('day') }).split('?')[1]) : raw;
  const tab = params.get('tab') as TravelerTab;
  const tripId = params.get('trip') || undefined;
  const mapTripId = validMapTripId(params.get('map'));
  const day = Number(params.get('day'));
  return { tab: tabs.includes(tab) ? tab : fallback, ...((tab === 'planner' || tab === 'budget') && tripId ? {
    tripId, ...(tab === 'planner' && Number.isInteger(day) && day > 0 && day <= 31 ? { day } : {}), fromSavedTrips: params.get('from') === 'saved', returnToSavedItinerary: params.get('return') === 'saved-trip',
  } : {}), ...(tab === 'bookings' ? mapTripId
    ? { mapTripId, mapDay: validMapDay(params.get('day')), navigationMoved: params.get('navigation') === 'moved' }
    : tripId ? { tripId, ...(Number.isInteger(day) && day > 0 && day <= 31 ? { day } : {}), fromSavedTrips: true }
    : { navigationMoved: params.get('navigation') === 'moved' }
  : {}) };
}

function viewUrl(view: ItineraryView) {
  const url = new URL(window.location.href);
  ['tab', 'trip', 'day', 'from', 'return', 'map', 'navigation'].forEach(name => url.searchParams.delete(name));
  if (view.tab !== 'overview') url.searchParams.set('tab', view.tab);
  if ((view.tab === 'planner' || view.tab === 'budget') && view.tripId) {
    url.searchParams.set('trip', view.tripId);
    if (view.tab === 'planner' && view.day !== undefined) url.searchParams.set('day', String(view.day));
    if (view.fromSavedTrips) url.searchParams.set('from', 'saved');
    if (view.tab === 'budget' && view.returnToSavedItinerary) url.searchParams.set('return', 'saved-trip');
  }
  if (view.tab === 'bookings') {
    if (view.tripId) { url.searchParams.set('trip', view.tripId); if (view.day !== undefined) url.searchParams.set('day', String(view.day)); }
    else if (view.mapTripId) { url.searchParams.set('map', view.mapTripId); if (view.mapDay) url.searchParams.set('day', String(view.mapDay)); }
    if (view.navigationMoved) url.searchParams.set('navigation', 'moved');
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Same-document history keeps the loaded plan and draft intact across day views. */
export function useItineraryNavigation(initialTab: TravelerTab, shouldBlock: (target: ItineraryView, current: ItineraryView) => boolean, onBlocked: () => void) {
  const [view, setView] = useState<ItineraryView>({ tab: initialTab });
  const current = useRef<Entry | null>(null);
  const pending = useRef<Entry | null>(null);
  const repairing = useRef(false);
  const approved = useRef(false);
  const callbacks = useRef({ shouldBlock, onBlocked });
  useEffect(() => { callbacks.current = { shouldBlock, onBlocked }; });

  useEffect(() => {
    const route = viewFromUrl(initialTab);
    const prior = window.history.state?.[key] as Entry | undefined;
    const parentOverview = route.day !== undefined ? browserParentIsOverview(route) : undefined;
    // Old tabs can retain history written before the overview/day flow existed.
    // The URL is authoritative. Upgrade a compatible old entry without adding
    // a second overview; rebuild stale indexes or mismatched route state.
    const compatible = prior && sameView(prior.view, route) && (prior.version === 2 || parentOverview === true || prior.ancestors.at(-1)?.index === prior.index - 1);
    let entry: Entry = compatible
      ? { ...prior, view: route, version: 2 }
      : { view: route, index: 0, ancestors: [], session: crypto.randomUUID(), version: 2 };
    if ((route.tab === 'planner' || route.tab === 'bookings') && route.day !== undefined && !(parentOverview ?? isOverviewOf(entry.ancestors.at(-1)?.view || { tab: 'overview' }, route))) {
      // A refreshed/legacy deep day link still needs its own trip overview as
      // the immediate browser Back destination, independently of from=saved.
      const parent = { ...entry, view: overviewOf(route) };
      window.history.replaceState({ [key]: parent }, '', viewUrl(parent.view));
      entry = { ...entry, index: parent.index + 1, ancestors: [...parent.ancestors, { view: parent.view, index: parent.index }] };
      window.history.pushState({ [key]: entry }, '', viewUrl(entry.view));
    }
    entry.position = browserPosition();
    current.current = entry;
    window.history.replaceState({ [key]: entry }, '', viewUrl(entry.view));
    // History's automatic scroll restoration races with the overview's own restoration.
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    const timer = window.setTimeout(() => setView(entry.view), 0);
    const onPop = (event: PopStateEvent) => {
      const storedTarget = event.state?.[key] as Entry | undefined;
      const from = current.current;
      if (!from) return;
      const route = viewFromUrl(initialTab);
      const target: Entry = storedTarget?.version === 2 && sameView(storedTarget.view, route)
        ? { ...storedTarget, view: route, position: browserPosition() }
        : { view: route, index: from.index - 1, ancestors: [], session: from.session, version: 2, position: browserPosition() };
      if (repairing.current) {
        repairing.current = false;
        callbacks.current.onBlocked();
        return;
      }
      if (!approved.current && callbacks.current.shouldBlock(target.view, from.view)) {
        pending.current = target;
        repairing.current = true;
        window.history.go(-distance(from, target));
        return;
      }
      approved.current = false;
      pending.current = null;
      current.current = target;
      if (new URLSearchParams(window.location.search).get('tab') === 'gps') window.history.replaceState({ [key]: target }, '', viewUrl(target.view));
      setView(target.view);
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.clearTimeout(timer);
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, [initialTab]);

  const navigate = (target: ItineraryView) => {
    const from = current.current;
    if (!from || sameView(from.view, target)) return;
    const entry: Entry = { view: target, index: from.index + 1, session: from.session, version: 2, ancestors: [...from.ancestors, { view: from.view, index: from.index }].slice(-64) };
    window.history.pushState({ [key]: entry }, '', viewUrl(target));
    entry.position = browserPosition();
    current.current = entry;
    setView(target);
  };
  const returnTo = (target: ItineraryView) => {
    const from = current.current;
    const parent = from?.ancestors.at(-1);
    if (from && parent && sameView(parent.view, target) && parent.index === from.index - 1) window.history.back();
    else navigate(target); // Explicit destination also works without a prior list entry.
  };
  const replace = (target: ItineraryView, url = viewUrl(target)) => {
    const from = current.current;
    if (!from) return;
    const entry = { ...from, view: target };
    // Let Next copy its own router markers. Passing __NA/_N here bypasses its
    // native-history synchronization and leaves a stale canonical URL behind.
    window.history.replaceState({ [key]: entry }, '', url);
    current.current = entry;
    setView(target);
  };
  const backToOverview = () => {
    const from = current.current;
    if (!from) return;
    const route = viewFromUrl(initialTab);
    const dayView = (route.tab === 'planner' || route.tab === 'bookings') && route.tripId ? route : from.view;
    if ((dayView.tab !== 'planner' && dayView.tab !== 'bookings') || dayView.day === undefined) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('day');
    // In-app Day Back is an explicit same-trip route change. The browser's
    // previous entry can be Saved Trips, so never traverse history here.
    replace(overviewOf(dayView), `${url.pathname}${url.search}${url.hash}`);
  };
  const confirmPending = () => {
    const target = pending.current;
    const from = current.current;
    if (!target || !from) return false;
    approved.current = true;
    window.history.go(distance(from, target));
    return true;
  };
  return { view, navigate, replace, returnTo, backToOverview, confirmPending, cancelPending: () => { pending.current = null; } };
}
