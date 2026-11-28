import { computed, signal } from '@preact/signals';
import type { Order, Trip } from '../../data/types';
import { batchKey, suggestBatches, type PlanOrder } from '../../lib/engine';
import { istDay } from '../../lib/format';
import { now, settings, store } from '../../state/app';

export const kOrders = signal<Order[] | null>(null);
export const kTrips = signal<Trip[]>([]);
export const soundOn = signal(sessionStorage.getItem('mk:sound') === '1');
export const wakeOn = signal(false);

const seen = new Set<string>();
let primed = false;
let audio: AudioContext | null = null;

export const placed = computed(() => (kOrders.value ?? []).filter(o => o.status === 'placed').sort((a, b) => a.placedAt - b.placedAt));
export const cooking = computed(() => (kOrders.value ?? []).filter(o => o.status === 'accepted' || o.status === 'ready').sort((a, b) => a.placedAt - b.placedAt));
export const today = computed(() => (kOrders.value ?? []).filter(o => istDay(o.placedAt) === istDay(now.value)));

export type KPlan = PlanOrder & { order: Order };
export const readyAt = (o: Order) => (o.status === 'ready' ? o.readyAt ?? now.value : (o.acceptedAt ?? o.placedAt) + (o.prepMin ?? settings.value.prepMin) * 60_000);
export const toPlan = (o: Order): KPlan => ({ id: o.id, location: o.location, placedAt: o.placedAt, promiseAt: o.promiseAt, readyAt: readyAt(o), name: o.name, area: o.area, order: o });

export const batches = computed(() => {
  const s = settings.value;
  return suggestBatches(cooking.value.map(toPlan), { kitchen: s.location, windowMin: s.batchWindowMin, maxPerTrip: s.maxPerTrip, nearKm: s.nearKm, now: now.value });
});

/** Subscribe to kitchen data while the dashboard is mounted. */
export function startKitchenSync(): () => void {
  const db = store.value!;
  const since = Date.now() - 36 * 3600_000;
  const offs = [
    db.watchOrdersSince(since, os => {
      const fresh = os.filter(o => o.status === 'placed' && !seen.has(o.id));
      os.forEach(o => seen.add(o.id));
      kOrders.value = os;
      if (primed && fresh.length) alertNew(fresh);
      primed = true;
      updateTitle();
    }),
    db.watchActiveTrips(ts => { kTrips.value = ts; }),
  ];
  const nag = setInterval(() => { if (placed.value.length) beep(); }, 20_000);
  const tick = setInterval(() => { now.value = Date.now(); }, 15_000);
  return () => { offs.forEach(f => f()); clearInterval(nag); clearInterval(tick); document.title = settings.value.kitchenName; primed = false; };
}

function updateTitle() {
  const n = placed.value.length;
  document.title = n ? `(${n}) New order${n > 1 ? 's' : ''} · Admin` : `Admin · ${settings.value.kitchenName}`;
}

function alertNew(fresh: Order[]) {
  beep();
  try { navigator.vibrate?.([250, 120, 250, 120, 400]); } catch { /* not supported */ }
  if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
    const o = fresh[0];
    try { new Notification(`New order ${o.code} · ₹${o.total}`, { body: `${o.name}, ${o.area}: ${o.lines.map(l => `${l.qty}× ${l.name}`).join(', ')}`, tag: o.id }); } catch { /* ignore */ }
  }
}

export async function enableAlerts() {
  try {
    audio = audio ?? new AudioContext();
    await audio.resume();
    soundOn.value = true;
    sessionStorage.setItem('mk:sound', '1');
    beep(true);
  } catch { /* no audio */ }
  if ('Notification' in window && Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch { /* ignore */ }
  }
}

/** Two-tone chime made with WebAudio. No sound file to download. */
export function beep(force = false) {
  if (!soundOn.value && !force) return;
  try {
    audio = audio ?? new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
    const t0 = audio.currentTime;
    [[880, 0], [1320, 0.18], [880, 0.5], [1320, 0.68]].forEach(([f, dt]) => {
      const o = audio!.createOscillator();
      const g = audio!.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + dt);
      g.gain.exponentialRampToValueAtTime(0.35, t0 + dt + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.16);
      o.connect(g).connect(audio!.destination);
      o.start(t0 + dt); o.stop(t0 + dt + 0.18);
    });
  } catch { /* ignore */ }
}

let lock: WakeLockSentinel | null = null;
export async function toggleWake() {
  if (lock) { await lock.release().catch(() => {}); lock = null; wakeOn.value = false; return; }
  try {
    lock = await navigator.wakeLock.request('screen');
    wakeOn.value = true;
    lock.addEventListener('release', () => { if (wakeOn.value && document.visibilityState === 'visible') void reacquire(); });
  } catch { wakeOn.value = false; }
}
async function reacquire() { try { lock = await navigator.wakeLock.request('screen'); } catch { wakeOn.value = false; } }
document.addEventListener('visibilitychange', () => { if (wakeOn.value && document.visibilityState === 'visible') void reacquire(); });

export { batchKey };
