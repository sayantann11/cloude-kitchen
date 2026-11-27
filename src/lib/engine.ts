/**
 * Order batching + route planning.
 *
 * Pure functions: no I/O, no clock reads. Pass `now` (epoch ms) in.
 * An order joins a trip only if:
 *   1. it was placed within `windowMin` of the trip's first order,
 *   2. it is within `nearKm` road-km of a stop already in the trip and in the same direction from the kitchen,
 *   3. the trip has room (`maxPerTrip`),
 *   4. the best stop order still delivers EVERY order before its promise time.
 */
import type { LatLng } from '../data/types';
import { angleDiff, bearing, roadKm, travelMin } from './geo';

export const HANDOVER_MIN = 3;
export const BEARING_MAX = 55;
const MIN = 60_000;

export interface PlanOrder {
  id: string;
  location: LatLng;
  placedAt: number;   // epoch ms
  promiseAt: number;  // epoch ms
  readyAt: number;    // epoch ms the food is expected packed
  name?: string;
  area?: string;
}

export interface Leg<T extends PlanOrder = PlanOrder> { order: T; km: number; eta: number; late: number }

export interface Route<T extends PlanOrder = PlanOrder> {
  stops: T[];
  legs: Leg<T>[];
  km: number;          // kitchen → last stop
  backKm: number;      // last stop → kitchen
  totalKm: number;
  soloKm: number;      // sum of separate round trips
  savedKm: number;
  savedMin: number;
  departAt: number;
  returnAt: number;
  lateMin: number;     // worst lateness in minutes (0 = all on time)
  onTime: boolean;
}

export interface Batch<T extends PlanOrder = PlanOrder> {
  key: string;
  orders: T[];
  route: Route<T>;
  why: string;         // for single orders: why it rides alone
}

export interface BatchOptions {
  kitchen: LatLng;
  windowMin: number;
  maxPerTrip: number;
  nearKm: number;
  now: number;
  bearingMax?: number;
}

function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr.slice()];
  const out: T[][] = [];
  arr.forEach((x, i) => {
    for (const p of permutations([...arr.slice(0, i), ...arr.slice(i + 1)])) out.push([x, ...p]);
  });
  return out;
}

/** Best stop order. Exhaustive for ≤ 6 stops (720 orders), nearest-neighbour beyond that. */
export function planRoute<T extends PlanOrder>(orders: T[], kitchen: LatLng, now: number): Route<T> {
  if (!orders.length) throw new Error('planRoute needs at least one order');
  const departAt = Math.max(now, ...orders.map(o => o.readyAt));
  const candidates = orders.length <= 6 ? permutations(orders) : [nearestNeighbour(orders, kitchen)];
  let best: (Route<T> & { score: number }) | null = null;
  for (const p of candidates) {
    let t = departAt;
    let km = 0;
    let prev = kitchen;
    let late = 0;
    const legs: Leg<T>[] = [];
    for (const o of p) {
      const d = roadKm(prev, o.location);
      km += d;
      t += travelMin(d) * MIN;
      const l = Math.max(0, (t - o.promiseAt) / MIN);
      late = Math.max(late, l);
      legs.push({ order: o, km: d, eta: t, late: l });
      t += HANDOVER_MIN * MIN;
      prev = o.location;
    }
    const backKm = roadKm(prev, kitchen);
    // Being on time beats being short. Among late plans, least-late wins.
    const score = (late > 0 ? 10_000 + late * 100 : 0) + km;
    if (!best || score < best.score) {
      best = { stops: p, legs, km, backKm, totalKm: km + backKm, soloKm: 0, savedKm: 0, savedMin: 0, departAt, returnAt: t + travelMin(backKm) * MIN, lateMin: late, onTime: late <= 0.0001, score };
    }
  }
  const r = best!;
  r.soloKm = orders.reduce((s, o) => s + 2 * roadKm(kitchen, o.location), 0);
  r.savedKm = Math.max(0, r.soloKm - r.totalKm);
  r.savedMin = travelMin(r.savedKm);
  const { score: _score, ...route } = r;
  return route;
}

function nearestNeighbour<T extends PlanOrder>(orders: T[], kitchen: LatLng): T[] {
  const left = orders.slice();
  const out: T[] = [];
  let at = kitchen;
  while (left.length) {
    let bi = 0;
    for (let i = 1; i < left.length; i++) if (roadKm(at, left[i].location) < roadKm(at, left[bi].location)) bi = i;
    const [n] = left.splice(bi, 1);
    out.push(n);
    at = n.location;
  }
  return out;
}

export const batchKey = (orders: { id: string }[]) => orders.map(o => o.id).sort().join('+');

export function suggestBatches<T extends PlanOrder>(pendingIn: T[], opt: BatchOptions): Batch<T>[] {
  const { kitchen, windowMin, maxPerTrip, nearKm, now } = opt;
  const bmax = opt.bearingMax ?? BEARING_MAX;
  const W = windowMin * MIN;
  const pending = pendingIn.slice().sort((a, b) => a.placedAt - b.placedAt);
  const used = new Set<string>();
  const groups: Batch<T>[] = [];
  const dirOf = (o: T) => bearing(kitchen, o.location);
  const sameWay = (a: T, b: T) => roadKm(kitchen, a.location) < 0.8 || roadKm(kitchen, b.location) < 0.8 || angleDiff(dirOf(a), dirOf(b)) <= bmax;

  for (const seed of pending) {
    if (used.has(seed.id)) continue;
    const group: T[] = [seed];
    used.add(seed.id);
    const cands = pending
      .filter(c => !used.has(c.id) && c.placedAt - seed.placedAt <= W)
      .sort((a, b) => roadKm(seed.location, a.location) - roadKm(seed.location, b.location));
    for (const c of cands) {
      if (group.length >= maxPerTrip) break;
      const near = Math.min(...group.map(g => roadKm(g.location, c.location)));
      if (near > nearKm || !group.every(g => sameWay(g, c))) continue;
      const trial = planRoute([...group, c], kitchen, now);
      if (makesAnyoneLater(trial, [planRoute(group, kitchen, now), planRoute([c], kitchen, now)])) continue;
      if (trial.savedKm <= 0.3) continue;
      group.push(c);
      used.add(c.id);
    }
    groups.push({ key: batchKey(group), orders: group, route: planRoute(group, kitchen, now), why: '' });
  }

  // Explain singles.
  for (const g of groups) {
    if (g.orders.length > 1) { g.why = ''; continue; }
    g.why = explainSingle(g.orders[0], groups, pending, opt, sameWay);
  }
  // Multi-stop trips first, then oldest first.
  return groups.sort((a, b) => (b.orders.length > 1 ? 1 : 0) - (a.orders.length > 1 ? 1 : 0) || a.orders[0].placedAt - b.orders[0].placedAt);
}

/** True if any order arrives later (past its promise) in `trial` than in the plans it would replace. */
function makesAnyoneLater<T extends PlanOrder>(trial: Route<T>, before: Route<T>[]): boolean {
  const was = new Map<string, number>();
  for (const r of before) for (const l of r.legs) was.set(l.order.id, l.late);
  return trial.legs.some(l => l.late > (was.get(l.order.id) ?? 0) + 0.01);
}

function explainSingle<T extends PlanOrder>(s: T, groups: Batch<T>[], pending: T[], opt: BatchOptions, sameWay: (a: T, b: T) => boolean): string {
  const near = pending
    .filter(c => c.id !== s.id && roadKm(s.location, c.location) <= opt.nearKm && sameWay(s, c))
    .sort((a, b) => roadKm(s.location, a.location) - roadKm(s.location, b.location));
  if (!near.length) return 'No other order nearby right now';
  const c = near[0];
  const area = c.area || 'nearby';
  if (Math.abs(c.placedAt - s.placedAt) > opt.windowMin * MIN) return `Nearest order (${area}) is more than ${opt.windowMin} min apart`;
  const cg = groups.find(g => g.orders.includes(c))!;
  if (cg.orders.length >= opt.maxPerTrip) return `The ${area} trip is already full`;
  const trial = planRoute([...cg.orders, s], opt.kitchen, opt.now);
  const was = new Map<string, number>();
  for (const r of [planRoute(cg.orders, opt.kitchen, opt.now), planRoute([s], opt.kitchen, opt.now)]) for (const l of r.legs) was.set(l.order.id, l.late);
  const bad = trial.legs.find(l => l.late > (was.get(l.order.id) ?? 0) + 0.01);
  if (bad) return `Joining the ${area} trip would make ${(bad.order.name || 'a customer').split(' ')[0]}'s food late`;
  return 'Grouping saves almost no distance';
}

/** Google Maps directions URL: kitchen → stops in order. Opens turn-by-turn on phones. */
export function googleMapsRoute(kitchen: LatLng, stops: LatLng[]): string {
  const ll = (p: LatLng) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
  if (!stops.length) return `https://www.google.com/maps/search/?api=1&query=${ll(kitchen)}`;
  const dest = stops[stops.length - 1];
  let u = `https://www.google.com/maps/dir/?api=1&origin=${ll(kitchen)}&destination=${ll(dest)}&travelmode=driving`;
  const mid = stops.slice(0, -1);
  if (mid.length) u += `&waypoints=${encodeURIComponent(mid.map(ll).join('|'))}`;
  return u;
}

export const googleMapsPin = (p: LatLng) => `https://www.google.com/maps/search/?api=1&query=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
