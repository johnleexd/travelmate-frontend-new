'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ItineraryResponse } from '@/lib/contracts';
import { mapStoredPlanPhotos, storedPhoto } from '@/lib/stored-trip-photos';
import { missingDayPhotoKey, retrieveDayDisplayPhotos, type ActivityPhotoPatch, type FailedActivityPhoto } from '@/services/activity-photo.service';
import type { GooglePlacePhoto } from '@/lib/google-place-photos';

/** Reuse stored assets. Enrich only missing photos or an observed load failure. */
export function useActivityPhotoFallback(stored: ItineraryResponse, dayNumbers?: number[], tripId?: string | null, draft = false) {
  const plan = useMemo(() => mapStoredPlanPhotos(stored), [stored]);
  const [photos, setPhotos] = useState<Record<string, ActivityPhotoPatch[]>>({});
  const [failed, setFailed] = useState<Record<string, FailedActivityPhoto[]>>({});
  const [google, setGoogle] = useState<Record<string, Record<string, GooglePlacePhoto>>>({});
  const [googleFailed, setGoogleFailed] = useState<Record<string, number[]>>({});
  const [attempted, setAttempted] = useState<Record<string, boolean>>({});
  const scope = JSON.stringify([tripId, plan.destination, plan.days.map(day => day.date)]);
  const photoKey = useCallback((day: number) => JSON.stringify([scope, plan.days.find(item => item.day === day)?.activities.map(item => [item.id, item.title, item.location, item.place, item.category, /^daily\s+(allowance|budget)$/i.test(item.time), item.imageUrl, item.imageAttribution])]), [scope, plan]);
  const onPhotoFailure = useCallback((day: number, index: number, imageUrl: string) => {
    const key = JSON.stringify([scope, day]);
    setFailed(current => current[key]?.some(photo => photo.index === index && photo.imageUrl === imageUrl) ? current : { ...current, [key]: [...(current[key] || []).filter(photo => photo.index !== index), { index, imageUrl }] });
  }, [scope]);
  const onGooglePhotoFailure = useCallback((day: number, index: number) => {
    const key = JSON.stringify([scope, day]);
    setGoogleFailed(current => current[key]?.includes(index) ? current : { ...current, [key]: [...(current[key] || []), index] });
  }, [scope]);
  const googlePhotos = useMemo(() => Object.fromEntries(plan.days.flatMap(day => Object.entries(google[photoKey(day.day)] || {}).filter(([index]) => !googleFailed[JSON.stringify([scope, day.day])]?.includes(Number(index))).map(([index, photo]) => [`${day.day}:${index}`, photo]))), [plan, google, googleFailed, scope, photoKey]);
  const itinerary = useMemo(() => ({ ...plan, days: plan.days.map(day => {
    const key = photoKey(day.day);
    // Reuse each unchanged activity's selection when a different activity is
    // added/edited. Whole-day request identities still guard delayed responses.
    const identities = JSON.parse(key)[1] as unknown[];
    const retained = new Map<string, ActivityPhotoPatch>();
    for (const [sourceKey, selections] of Object.entries(photos)) {
      const [owner, sourceIdentities] = JSON.parse(sourceKey) as [string, unknown[]];
      if (owner !== scope) continue;
      for (const selection of selections) retained.set(JSON.stringify(sourceIdentities[selection.index]), selection);
    }
    const patches = identities.flatMap((identity, index) => {
      const selected = retained.get(JSON.stringify(identity));
      return selected ? [{ ...selected, index }] : [];
    });
    if (!patches?.length) return day;
    const activities = day.activities.map((activity, index) => {
      const patch = patches.find(item => item.index === index);
      return patch ? { ...activity, imageUrl: patch.imageUrl, imageAttribution: patch.imageAttribution } : activity;
    });
    const dayPhoto = storedPhoto(day);
    const mirror = patches.find(patch => !dayPhoto || storedPhoto(day.activities[patch.index])?.imageUrl === dayPhoto.imageUrl);
    return { ...day, activities, ...(mirror ? { imageUrl: mirror.imageUrl, imageAttribution: mirror.imageAttribution } : {}) };
  }) }), [plan, photos, photoKey, scope]);
  const requests = useMemo(() => itinerary.days.flatMap(day => {
    if (dayNumbers && !dayNumbers.includes(day.day)) return [];
    const key = photoKey(day.day);
    const failures = (failed[JSON.stringify([scope, day.day])] || []).filter(photo => photo.imageUrl === storedPhoto(day.activities[photo.index])?.imageUrl);
    const googleFailures = googleFailed[JSON.stringify([scope, day.day])] || [];
    const requestKey = JSON.stringify([key, failures, googleFailures]);
    return !attempted[requestKey] && missingDayPhotoKey(plan.destination, day, failures) ? [{ key, requestKey, day, failures, googleFailures }] : [];
  }), [itinerary, dayNumbers, failed, googleFailed, attempted, scope, plan.destination, photoKey]);
  useEffect(() => {
    let active = true;
    for (const { key, requestKey, day, failures, googleFailures } of requests) void retrieveDayDisplayPhotos(plan.destination, day, draft ? undefined : tripId, failures, googleFailures).then(({ patches, googlePhotos: additions }) => {
      if (active) { setAttempted(current => ({ ...current, [requestKey]: true })); if (Object.keys(additions).length) setGoogle(current => ({ ...current, [key]: { ...current[key], ...additions } })); }
      if (active && patches.length) setPhotos(current => {
        const merged = [...(current[key] || [])]; let changed = false;
        for (const patch of patches) {
          const index = merged.findIndex(item => item.index === patch.index);
          if (index < 0) { merged.push(patch); changed = true; }
          else if (JSON.stringify(merged[index]) !== JSON.stringify(patch)) { merged[index] = patch; changed = true; }
        }
        if (!changed) return current;
        const updated = { ...current }; delete updated[key];
        return { ...updated, [key]: merged };
      });
    });
    return () => { active = false; };
  }, [requests, plan.destination, tripId, draft]);
  return { itinerary, onPhotoFailure, googlePhotos, onGooglePhotoFailure };
}
