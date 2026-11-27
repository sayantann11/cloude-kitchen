import type { LatLng } from '../data/types';

/** Straight-line multiplier that approximates Sambalpur road distance. */
export const ROAD_FACTOR = 1.35;
/** Average two-wheeler speed in town, km/h. */
export const SPEED_KMH = 20;

const R = 6371;
const rad = Math.PI / 180;

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const roadKm = (a: LatLng, b: LatLng) => haversineKm(a, b) * ROAD_FACTOR;
export const travelMin = (km: number) => (km / SPEED_KMH) * 60;

/** Compass bearing from a to b in degrees, 0 = north. */
export function bearing(a: LatLng, b: LatLng): number {
  const y = Math.sin((b.lng - a.lng) * rad) * Math.cos(b.lat * rad);
  const x = Math.cos(a.lat * rad) * Math.sin(b.lat * rad) - Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos((b.lng - a.lng) * rad);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

export function angleDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Approximate locality centres in and around Sambalpur. */
export const PLACES: Record<string, LatLng> = {
  Ainthapali: { lat: 21.4895, lng: 83.994 },
  'Farm Road': { lat: 21.4815, lng: 83.987 },
  Bareipali: { lat: 21.501, lng: 83.985 },
  Khetrajpur: { lat: 21.456, lng: 83.969 },
  Budharaja: { lat: 21.4625, lng: 83.959 },
  Dhanupali: { lat: 21.46, lng: 83.993 },
  Golebazar: { lat: 21.469, lng: 83.972 },
  Sakhipara: { lat: 21.4745, lng: 83.9665 },
  Modipara: { lat: 21.472, lng: 83.98 },
  Gopalmal: { lat: 21.486, lng: 83.972 },
  Jharuapara: { lat: 21.4655, lng: 83.9785 },
  'Station Bazar': { lat: 21.4585, lng: 83.9785 },
  Burla: { lat: 21.505, lng: 83.873 },
  Hirakud: { lat: 21.519, lng: 83.888 },
};

export const SAMBALPUR_CENTER: LatLng = { lat: 21.4705, lng: 83.975 };

export function nearestPlace(p: LatLng): string {
  let best = 'Sambalpur';
  let bd = Infinity;
  for (const [name, c] of Object.entries(PLACES)) {
    const d = haversineKm(p, c);
    if (d < bd) { bd = d; best = name; }
  }
  return bd > 6 ? 'Sambalpur outskirts' : best;
}

export const isValidLatLng = (p: unknown): p is LatLng =>
  !!p && typeof (p as LatLng).lat === 'number' && typeof (p as LatLng).lng === 'number' &&
  Math.abs((p as LatLng).lat) <= 90 && Math.abs((p as LatLng).lng) <= 180;
