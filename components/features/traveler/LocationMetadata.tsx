import type { LocationCandidate } from '@/lib/contracts';
export function LocationMetadata({ location }: { location: LocationCandidate }) {
  return <span className="block break-words text-[10px] text-slate-500">{location.provider === 'psgc' ? 'PSGC' : location.provider === 'openstreetmap' ? 'OSM' : 'GeoNames'} ID: {location.providerId || location.id} · {Number.isFinite(location.latitude) && Number.isFinite(location.longitude) ? `${location.latitude!.toFixed(5)}, ${location.longitude!.toFixed(5)}` : 'Coordinates need verification'}{location.locationPath?.length ? <span className="block">{location.locationPath.map(part => part.name).join(' → ')}</span> : null}</span>;
}
