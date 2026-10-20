export type CityBoundary =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] };

type CityGeo = { latitude: number | null; longitude: number | null; boundary: unknown };

/** Normalize GeoJSON objects/features and the raw ring arrays used by the seed. */
export function normalizeCityBoundary(value: unknown): CityBoundary | null {
  let candidate = value;
  if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
    const object = candidate as { type?: unknown; geometry?: unknown; coordinates?: unknown };
    if (object.type === 'Feature') candidate = object.geometry;
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      const geometry = candidate as { type?: unknown; coordinates?: unknown };
      if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) return null;
      if (geometry.type === 'Polygon') {
        return { type: 'Polygon', coordinates: geometry.coordinates as number[][][] };
      }
      if (geometry.type === 'MultiPolygon') {
        return { type: 'MultiPolygon', coordinates: geometry.coordinates as number[][][][] };
      }
      candidate = geometry.coordinates;
    }
  }
  if (!Array.isArray(candidate) || candidate.length === 0) return null;
  const first = candidate[0] as unknown[] | undefined;
  const second = first?.[0] as unknown[] | undefined;
  const third = second?.[0];
  if (typeof third === 'number') return { type: 'Polygon', coordinates: candidate as number[][][] };
  const fourth = Array.isArray(third) ? third[0] : undefined;
  if (typeof fourth === 'number') return { type: 'MultiPolygon', coordinates: candidate as number[][][][] };
  return null;
}

function pointInRing(ring: number[][], lng: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[i];
    const b = ring[j];
    if (!a || !b || a.length < 2 || b.length < 2) continue;
    const [x1, y1] = a;
    const [x2, y2] = b;
    const cross = (lng - x1) * (y2 - y1) - (lat - y1) * (x2 - x1);
    if (
      Math.abs(cross) < 1e-10 &&
      lng >= Math.min(x1, x2) && lng <= Math.max(x1, x2) &&
      lat >= Math.min(y1, y2) && lat <= Math.max(y1, y2)
    ) return true;
    if ((y1 > lat) !== (y2 > lat) && lng < ((x2 - x1) * (lat - y1)) / (y2 - y1) + x1) inside = !inside;
  }
  return inside;
}

/** Same spatial policy as the API: exact configured boundary, else a town-scale centre window. */
export function isMapCoordinateInCity(city: CityGeo, lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  const boundary = normalizeCityBoundary(city.boundary);
  if (boundary) {
    const polygons = boundary.type === 'Polygon' ? [boundary.coordinates] : boundary.coordinates;
    const inside = polygons.some((rings) => {
      const [outer, ...holes] = rings;
      return Boolean(outer && pointInRing(outer, lng, lat) && !holes.some((hole) => pointInRing(hole, lng, lat)));
    });
    if (inside) return true;
    return city.latitude !== null && city.longitude !== null &&
      Math.abs(lat - city.latitude) <= 0.05 && Math.abs(lng - city.longitude) <= 0.05;
  }
  return city.latitude !== null && city.longitude !== null &&
    Math.abs(lat - city.latitude) <= 0.15 && Math.abs(lng - city.longitude) <= 0.15;
}
