export type LatLng = { lat: number; lng: number };

/** Melbourne CBD, where the map starts. */
export const MELBOURNE_CENTRE: LatLng = { lat: -37.8136, lng: 144.9631 };

const EARTH_RADIUS_M = 6_371_000;

/** Great-circle distance in metres. */
export function distanceMetres(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** A link that opens directions in the phone's maps app (or Google Maps on desktop). */
export function directionsUrl(venue: { lat: number; lng: number; google_place_id: string | null }): string {
  const params = new URLSearchParams({ api: '1', destination: `${venue.lat},${venue.lng}` });
  if (venue.google_place_id) params.set('destination_place_id', venue.google_place_id);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
