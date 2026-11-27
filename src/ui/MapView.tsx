/**
 * Leaflet + OpenStreetMap (free, no API key). Loaded on demand so the menu stays light.
 * Modes: pick a location (draggable pin + tap to move), or show a route with numbered stops.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { LatLng } from '../data/types';

type L = typeof import('leaflet');
let leafletP: Promise<L> | null = null;
function loadLeaflet(): Promise<L> {
  if (!leafletP) leafletP = Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([m]) => (m as unknown as { default: L }).default ?? (m as unknown as L));
  return leafletP;
}
export const preloadMap = () => { void loadLeaflet(); };

export interface MapPoint extends LatLng { label: string; title?: string; tone?: 'brand' | 'done' | 'accent' }

interface Props {
  kitchen: LatLng;
  pick?: LatLng | null;
  onPick?: (p: LatLng) => void;
  points?: MapPoint[];
  route?: LatLng[];
  height?: number;
  ariaLabel: string;
}

const TILE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

export function MapView({ kitchen, pick, onPick, points = [], route, height = 260, ariaLabel }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const st = useRef<{ L?: L; map?: import('leaflet').Map; pin?: import('leaflet').Marker; layer?: import('leaflet').LayerGroup }>({});
  const [failed, setFailed] = useState(false);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    let dead = false;
    loadLeaflet().then(L => {
      if (dead || !el.current) return;
      const map = L.map(el.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false, tap: true } as import('leaflet').MapOptions)
        .setView([kitchen.lat, kitchen.lng], 14);
      L.tileLayer(TILE, { maxZoom: 19, attribution: ATTR }).addTo(map);
      L.marker([kitchen.lat, kitchen.lng], { icon: L.divIcon({ className: 'mk-pin', html: '<span class="mk-k">K</span>', iconSize: [30, 30], iconAnchor: [15, 15] }), title: 'Kitchen', keyboard: false }).addTo(map);
      st.current = { L, map, layer: L.layerGroup().addTo(map) };
      if (onPickRef.current) {
        map.on('click', (e: import('leaflet').LeafletMouseEvent) => onPickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
      }
      draw();
      setTimeout(() => map.invalidateSize(), 50);
    }).catch(() => setFailed(true));
    return () => { dead = true; st.current.map?.remove(); st.current = {}; };
  }, []);

  useEffect(() => { draw(); }, [pick?.lat, pick?.lng, JSON.stringify(points), JSON.stringify(route)]);

  function draw() {
    const { L, map, layer } = st.current;
    if (!L || !map || !layer) return;
    if (onPick) {
      if (pick) {
        if (!st.current.pin) {
          const pin = L.marker([pick.lat, pick.lng], { draggable: true, autoPan: true, icon: L.divIcon({ className: 'mk-pin', html: '<span class="mk-drop"></span>', iconSize: [34, 44], iconAnchor: [17, 42] }), title: 'Delivery location' }).addTo(map);
          pin.on('dragend', () => { const ll = pin.getLatLng(); onPickRef.current?.({ lat: ll.lat, lng: ll.lng }); });
          st.current.pin = pin;
        } else st.current.pin.setLatLng([pick.lat, pick.lng]);
        const b = L.latLngBounds([[pick.lat, pick.lng]]);
        if (!map.getBounds().pad(-0.15).contains(b)) map.setView([pick.lat, pick.lng], Math.max(map.getZoom(), 15));
      }
      return;
    }
    layer.clearLayers();
    const all: [number, number][] = [[kitchen.lat, kitchen.lng]];
    if (route && route.length > 1) {
      L.polyline(route.map(p => [p.lat, p.lng] as [number, number]), { color: '#0d5c50', weight: 4, opacity: 0.75, dashArray: '10 8', lineCap: 'round' }).addTo(layer);
    }
    for (const p of points) {
      all.push([p.lat, p.lng]);
      L.marker([p.lat, p.lng], { icon: L.divIcon({ className: 'mk-pin', html: `<span class="mk-n ${p.tone ?? 'brand'}">${p.label}</span>`, iconSize: [28, 28], iconAnchor: [14, 14] }), title: p.title ?? p.label })
        .bindTooltip(p.title ?? p.label, { direction: 'top', offset: [0, -12] }).addTo(layer);
    }
    if (all.length > 1) map.fitBounds(L.latLngBounds(all), { padding: [36, 36], maxZoom: 16 });
  }

  if (failed) return <div class="map-fail" style={{ height }}>Map could not load. Check your internet. You can still type your address below.</div>;
  return <div class="map" ref={el} style={{ height }} role="application" aria-label={ariaLabel} />;
}
