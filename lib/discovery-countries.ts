export type Country = {
  id: string; name: string; code: string; center: [number, number]; wikidataId?: string;
  polygons: [number, number][][][];
};
type Polygon = { country: Country; rings: [number, number][][]; west: number; east: number; south: number; north: number };
export type CountryIndex = { countries: readonly Country[]; cells: Map<string, Polygon[]>; smallTargets: { country: Country; latitude: number; longitude: number }[]; smallCodes: Set<string> };
const cell = (longitude: number, latitude: number) => Math.floor((longitude + 180) / 10) + ':' + Math.floor((latitude + 90) / 10);

// Natural Earth's GeoJSON splits polygons at the antimeridian. Retain those splits and holes.
export function indexCountries(countries: readonly Country[]): CountryIndex {
  const cells = new Map<string, Polygon[]>();
  const smallTargets: CountryIndex['smallTargets'] = [];
  for (const country of countries) for (const rings of country.polygons) {
    const outer = rings[0];
    if (!outer?.length) continue;
    let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
    for (const [x, y] of outer) { west = Math.min(west, x); east = Math.max(east, x); south = Math.min(south, y); north = Math.max(north, y); }
    const polygon = { country, rings, west, east, south, north };
    for (let x = Math.floor((west + 180) / 10); x <= Math.floor((east + 180) / 10); x++) {
      for (let y = Math.floor((south + 90) / 10); y <= Math.floor((north + 90) / 10); y++) {
        const key = x + ':' + y;
        const bucket = cells.get(key);
        if (bucket) bucket.push(polygon); else cells.set(key, [polygon]);
      }
    }
  }
  for (const country of countries) {
    const area = country.polygons.reduce((total, polygon) => {
      const ring = polygon[0];
      let sum = 0;
      for (let i = 1; i < ring.length; i++) sum += ring[i - 1][0] * ring[i][1] - ring[i][0] * ring[i - 1][1];
      return total + Math.abs(sum / 2) * Math.cos(country.center[1] * Math.PI / 180);
    }, 0);
    // Invisible hit targets make microstates and tiny islands usable at globe scale.
    if (area > 2) continue;
    for (const polygon of country.polygons) {
      const ring = polygon[0];
      const longitude = ring.reduce((sum, point) => sum + point[0], 0) / ring.length;
      const latitude = ring.reduce((sum, point) => sum + point[1], 0) / ring.length;
      const point = inRing(longitude, latitude, ring) ? [longitude, latitude] : ring[0];
      smallTargets.push({ country, longitude: point[0], latitude: point[1] });
    }
  }
  return { countries, cells, smallTargets, smallCodes: new Set(smallTargets.map(target => target.country.code)) };
}
function inRing(x: number, y: number, ring: [number, number][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [a, b] = ring[i], [c, d] = ring[j];
    if ((b > y) !== (d > y) && x < (c - a) * (y - b) / (d - b) + a) inside = !inside;
  }
  return inside;
}
export function countryAt(index: CountryIndex, latitude: number, longitude: number): Country | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90) return null;
  const x = ((longitude + 180) % 360 + 360) % 360 - 180;
  for (const polygon of index.cells.get(cell(x, latitude)) || []) {
    if (x < polygon.west || x > polygon.east || latitude < polygon.south || latitude > polygon.north) continue;
    if (inRing(x, latitude, polygon.rings[0]) && !polygon.rings.slice(1).some(ring => inRing(x, latitude, ring))) return polygon.country;
  }
  return null;
}

export function smallCountryAt(index: CountryIndex, latitude: number, longitude: number, tolerance: number): Country | null {
  if (!Number.isFinite(latitude + longitude + tolerance) || tolerance <= 0) return null;
  let nearest: Country | null = null, closest = Math.min(tolerance, .8);
  for (const target of index.smallTargets) {
    const dy = target.latitude - latitude;
    if (Math.abs(dy) > closest) continue;
    const dx = (((target.longitude - longitude + 540) % 360) - 180) * Math.cos(latitude * Math.PI / 180);
    const distance = Math.hypot(dx, dy);
    if (distance < closest) { nearest = target.country; closest = distance; }
  }
  return nearest;
}
