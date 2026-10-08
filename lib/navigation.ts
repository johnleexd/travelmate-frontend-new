import type { NavigationCoordinate, NavigationRoute } from './contracts';
import { longitudeNear, mapCoordinates, straightLineDistanceKm } from './trip-map.ts';

export function parseNavigationRoute(value: unknown): NavigationRoute | null {
  if (!value || typeof value !== 'object') return null;
  const route = value as NavigationRoute;
  const validAmount = (amount: unknown) => typeof amount === 'number' && Number.isFinite(amount) && amount >= 0;
  return ['walking', 'cycling', 'driving'].includes(route.mode) && route.provider === 'osrm'
    && mapCoordinates(route.origin) && mapCoordinates(route.destination)
    && Array.isArray(route.geometry) && route.geometry.length >= 2 && route.geometry.length <= 60000 && route.geometry.every(point => mapCoordinates(point))
    && Array.isArray(route.steps) && route.steps.length > 0 && route.steps.length <= 1000 && route.steps.every(step => step && typeof step.instruction === 'string' && typeof step.maneuver === 'string' && mapCoordinates(step.location) && validAmount(step.distanceMeters) && validAmount(step.durationSeconds))
    && validAmount(route.distanceMeters) && validAmount(route.durationSeconds) && validAmount(route.originOffsetMeters) && validAmount(route.destinationOffsetMeters)
    && typeof route.fetchedAt === 'string' && Number.isFinite(Date.parse(route.fetchedAt)) ? route : null;
}

export function buildRouteGuide(route: NavigationRoute) {
  const cumulative = [0];
  for (let index = 1; index < route.geometry.length; index++) cumulative.push(cumulative[index - 1] + straightLineDistanceKm(route.geometry[index - 1], route.geometry[index]) * 1000);
  let previousIndex = 0;
  const starts = route.steps.map(step => {
    let bestIndex = previousIndex, best = Infinity;
    for (let index = previousIndex; index < route.geometry.length; index++) {
      const point = route.geometry[index];
      const distance = (point.latitude - step.location.latitude) ** 2 + (longitudeNear(point.longitude, step.location.longitude) - step.location.longitude) ** 2;
      if (distance < best) { best = distance; bestIndex = index; }
      if (best < 1e-12) break;
    }
    previousIndex = bestIndex; return cumulative[bestIndex];
  });
  return { route, cumulative, starts, length: cumulative.at(-1)! };
}

export function navigationProgress(guide: ReturnType<typeof buildRouteGuide>, position: NavigationCoordinate, accuracy: number) {
  let offRouteMeters = Infinity, traveled = 0;
  const scaleY = 111195, scaleX = scaleY * Math.cos(position.latitude * Math.PI / 180);
  for (let index = 1; index < guide.route.geometry.length; index++) {
    const from = guide.route.geometry[index - 1], to = guide.route.geometry[index];
    const ax = (longitudeNear(from.longitude, position.longitude) - position.longitude) * scaleX, ay = (from.latitude - position.latitude) * scaleY;
    const bx = (longitudeNear(to.longitude, from.longitude) - longitudeNear(from.longitude, position.longitude)) * scaleX + ax, by = (to.latitude - position.latitude) * scaleY;
    const dx = bx - ax, dy = by - ay;
    const ratio = dx * dx + dy * dy ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy))) : 0;
    const distance = Math.hypot(ax + ratio * dx, ay + ratio * dy);
    if (distance < offRouteMeters) { offRouteMeters = distance; traveled = guide.cumulative[index - 1] + ratio * (guide.cumulative[index] - guide.cumulative[index - 1]); }
  }
  let stepIndex = 0;
  guide.starts.forEach((start, index) => { if (start <= traveled + 2) stepIndex = index; });
  const remainingRatio = guide.length > 0 ? Math.max(0, 1 - traveled / guide.length) : 0;
  const remainingMeters = guide.route.distanceMeters * remainingRatio;
  const destinationDistance = straightLineDistanceKm(position, guide.route.destination) * 1000;
  const arrived = accuracy <= 50 && destinationDistance <= Math.max(15, accuracy) && remainingMeters <= 60;
  return { stepIndex, offRouteMeters, nextTurnMeters: Math.max(0, (guide.starts[stepIndex + 1] ?? guide.length) - traveled), remainingMeters, remainingSeconds: guide.route.durationSeconds * remainingRatio, arrived, offRoute: offRouteMeters > Math.max(40, accuracy * 1.5) };
}

export function navigationDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} km`;
}

export function navigationDuration(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} hr${minutes % 60 ? ` ${minutes % 60} min` : ''}`;
}
