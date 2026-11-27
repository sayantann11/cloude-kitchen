/**
 * LocalStore: the whole backend in the browser (localStorage + BroadcastChannel).
 * Used for the demo and for automated tests. Customer, kitchen and rider tabs in the
 * same browser stay in sync in real time, which makes the full flow testable offline.
 */
import { docId } from '../lib/ids';
import { SEED_MENU, SEED_SETTINGS } from './seed';
import type { DataStore, OwnerSession, Unsub } from './store';
import { payAfter } from './store';
import type { Menu, Order, OrderLine, Settings, Trip, TripStop } from './types';
import { applyStock } from '../lib/pricing';

const K = { settings: 'mk:settings', menu: 'mk:menu2', orders: 'mk:orders', trips: 'mk:trips', uid: 'mk:uid', owner: 'mk:owner' };
export const DEMO_OWNER = { email: 'owner@demo.local', password: 'kitchen123' };

type Key = 'settings' | 'menu' | 'orders' | 'trips' | 'owner';

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch { return fallback; }
}
function write(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage full or blocked: keep in memory */ }
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export class LocalStore implements DataStore {
  readonly mode = 'local' as const;
  private subs = new Map<Key, Set<() => void>>();
  private bc: BroadcastChannel | null = null;

  constructor() {
    try {
      this.bc = new BroadcastChannel('mk-sync');
      this.bc.onmessage = (e: MessageEvent<Key>) => this.emit(e.data, false);
    } catch { /* old browser */ }
    window.addEventListener('storage', e => {
      const hit = (Object.entries(K) as [Key | 'uid', string][]).find(([, v]) => v === e.key);
      if (hit && hit[0] !== 'uid') this.emit(hit[0], false);
    });
  }

  private on(key: Key, fn: () => void): Unsub {
    if (!this.subs.has(key)) this.subs.set(key, new Set());
    this.subs.get(key)!.add(fn);
    queueMicrotask(fn);
    return () => this.subs.get(key)?.delete(fn);
  }
  private emit(key: Key, broadcast = true) {
    this.subs.get(key)?.forEach(fn => fn());
    if (broadcast) this.bc?.postMessage(key);
  }

  private orders = () => read<Record<string, Order>>(K.orders, {});
  private trips = () => read<Record<string, Trip>>(K.trips, {});
  private setOrders(o: Record<string, Order>) { write(K.orders, o); this.emit('orders'); }
  private setTrips(t: Record<string, Trip>) { write(K.trips, t); this.emit('trips'); }

  async customerUid() {
    let uid = read<string>(K.uid, '');
    if (!uid) { uid = 'anon_' + docId(); write(K.uid, uid); }
    return uid;
  }

  watchSettings(cb: (s: Settings) => void) {
    return this.on('settings', () => cb({ ...SEED_SETTINGS, ...read<Partial<Settings>>(K.settings, {}) }));
  }
  watchMenu(cb: (m: Menu) => void) {
    return this.on('menu', () => cb(read<Menu>(K.menu, SEED_MENU)));
  }

  async placeOrder(o: Order) {
    await sleep(150); // feel like a network
    const s = { ...SEED_SETTINGS, ...read<Partial<Settings>>(K.settings, {}) };
    if (s.paused) throw new Error('The kitchen just paused orders. Please try again shortly.');
    const all = this.orders();
    all[o.id] = o;
    this.setOrders(all);
  }
  async orderExists(id: string) { return !!this.orders()[id]; }
  watchOrder(id: string, cb: (o: Order | null) => void) {
    return this.on('orders', () => cb(this.orders()[id] ?? null));
  }
  watchMyOrders(uid: string, cb: (o: Order[]) => void) {
    return this.on('orders', () => cb(Object.values(this.orders()).filter(o => o.customerUid === uid).sort((a, b) => b.placedAt - a.placedAt).slice(0, 30)));
  }
  async cancelOrder(id: string, reason: string) {
    const all = this.orders();
    const o = all[id];
    if (!o) throw new Error('Order not found');
    if (o.status !== 'placed') throw new Error('The kitchen has already accepted this order. Please call them to cancel.');
    all[id] = { ...o, status: 'cancelled', cancelledAt: Date.now(), reason };
    this.setOrders(all);
  }
  async claimPaid(id: string, utr: string) {
    const all = this.orders();
    if (!all[id]) throw new Error('Order not found');
    all[id] = { ...all[id], payState: 'claimed', utr };
    this.setOrders(all);
  }

  onOwner(cb: (s: OwnerSession | null) => void) {
    return this.on('owner', () => cb(read<OwnerSession | null>(K.owner, null)));
  }
  async ownerSignIn(email: string, password: string) {
    await sleep(200);
    if (email.trim().toLowerCase() !== DEMO_OWNER.email || password !== DEMO_OWNER.password) throw new Error('Wrong email or password');
    write(K.owner, { uid: 'owner_demo', email: DEMO_OWNER.email });
    this.emit('owner');
  }
  async ownerResetPassword(email: string) { if (!email.trim()) throw new Error('Enter the owner email first'); await sleep(200); }
  async ownerSignOut() { localStorage.removeItem(K.owner); this.emit('owner'); }

  async saveSettings(patch: Partial<Settings>) {
    write(K.settings, { ...read<Partial<Settings>>(K.settings, {}), ...patch, updatedAt: Date.now() });
    this.emit('settings');
  }
  async saveMenu(m: Menu) { write(K.menu, { ...m, updatedAt: Date.now() }); this.emit('menu'); }
  async takeStock(lines: Pick<OrderLine, 'id' | 'qty'>[]) {
    const r = applyStock(read<Menu>(K.menu, SEED_MENU), lines);
    if (r.changed) await this.saveMenu(r.menu);
    return r.soldOut;
  }

  watchOrdersSince(since: number, cb: (o: Order[]) => void) {
    return this.on('orders', () => cb(Object.values(this.orders()).filter(o => o.placedAt >= since).sort((a, b) => b.placedAt - a.placedAt)));
  }
  async updateOrder(id: string, patch: Partial<Order>) {
    const all = this.orders();
    if (!all[id]) throw new Error('Order not found');
    all[id] = { ...all[id], ...patch };
    this.setOrders(all);
  }
  async dispatchTrip(t: Trip) {
    const all = this.orders();
    for (const s of t.stops) {
      const o = all[s.orderId];
      if (!o || (o.status !== 'accepted' && o.status !== 'ready')) throw new Error(`Order ${s.code} is no longer waiting to be sent`);
    }
    const share = Math.max(0, t.soloKm - t.km) / t.stops.length;
    for (const s of t.stops) all[s.orderId] = { ...all[s.orderId], status: 'out', outAt: t.departAt, tripId: t.id, kmSaved: share, riderName: t.riderName, riderPhone: t.riderPhone, tripSize: t.stops.length };
    const trips = this.trips();
    trips[t.id] = t;
    write(K.orders, all);
    this.setTrips(trips);
    this.emit('orders');
  }
  watchActiveTrips(cb: (t: Trip[]) => void) {
    return this.on('trips', () => cb(Object.values(this.trips()).filter(t => t.status === 'active').sort((a, b) => a.createdAt - b.createdAt)));
  }
  async updateTrip(id: string, patch: Partial<Trip>) {
    const trips = this.trips();
    if (!trips[id]) throw new Error('Trip not found');
    trips[id] = { ...trips[id], ...patch, updatedAt: Date.now() };
    this.setTrips(trips);
  }
  watchTrip(id: string, cb: (t: Trip | null) => void) {
    return this.on('trips', () => cb(this.trips()[id] ?? null));
  }
  async completeStop(trip: Trip, orderId: string, collected: TripStop['collected']) {
    const now = Date.now();
    const trips = this.trips();
    const t = trips[trip.id];
    if (!t) throw new Error('Trip not found');
    const stops = t.stops.map(s => (s.orderId === orderId ? { ...s, done: true, doneAt: now, collected, payState: payAfter(collected) } : s));
    trips[trip.id] = { ...t, stops, status: stops.every(s => s.done) ? 'done' : 'active', updatedAt: now };
    const all = this.orders();
    if (all[orderId]) all[orderId] = { ...all[orderId], status: 'delivered', deliveredAt: now, payState: payAfter(collected) };
    write(K.orders, all);
    this.setTrips(trips);
    this.emit('orders');
  }
}
