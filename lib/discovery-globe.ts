// Longitude aligns with Three.js SphereGeometry UVs and NASA's equirectangular texture.
export function globePoint(latitude: number, longitude: number): [number, number, number] {
  const lat = latitude * Math.PI / 180, lon = longitude * Math.PI / 180;
  return [Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon)];
}
export function shortestLongitude(from: number, to: number): number {
  return from + ((to - from + 540) % 360 + 360) % 360 - 180;
}
export function globeQuality(constrained: boolean) {
  return constrained
    ? { texture: 1024, segments: 48, maxDpr: 1.25, fps: 30 }
    : { texture: 2048, segments: 64, maxDpr: 1.75, fps: 60 };
}
// At 42° vertical FOV, keep the entire sphere and its atmosphere inside the frame.
export function globeZoom(distance: number): number { return Math.max(2.9, Math.min(4.1, distance)); }

/** Actual polygon rings, including enclaves; no joins across islands or clipping seams. */
export function countryBoundaryPositions(country: { polygons: [number, number][][][] }): Float32Array {
  const positions: number[] = [];
  const radius = 1.005;
  for (const polygon of country.polygons) for (const ring of polygon) {
    for (let i = 1; i < ring.length; i++) {
      const [fromLon, fromLat] = ring[i - 1], [toLon, toLat] = ring[i];
      // GeoJSON's vertical antimeridian clipping edges are not national borders.
      if (Math.abs(fromLon) === 180 && Math.abs(toLon) === 180) continue;
      const delta = shortestLongitude(fromLon, toLon) - fromLon;
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(delta), Math.abs(toLat - fromLat))));
      let start = globePoint(fromLat, fromLon);
      for (let step = 1; step <= steps; step++) {
        const end = globePoint(fromLat + (toLat - fromLat) * step / steps, fromLon + delta * step / steps);
        positions.push(...start.map(n => n * radius), ...end.map(n => n * radius));
        start = end;
      }
    }
  }
  return new Float32Array(positions);
}
