import { describe, expect, it } from 'vitest';
import { batchKey, googleMapsRoute, planRoute, suggestBatches, type PlanOrder } from './engine';
import { PLACES, roadKm } from './geo';

const KITCHEN = { lat: 21.4712, lng: 83.9795 };
const MIN = 60_000;
const NOW = Date.UTC(2026, 10, 27, 14, 0); // 7:30 pm IST

function order(id: string, place: keyof typeof PLACES, agoMin: number, opts: Partial<PlanOrder> = {}): PlanOrder {
  const placedAt = NOW - agoMin * MIN;
  const outer = roadKm(KITCHEN, PLACES[place]) > 8;
  return { id, name: id, area: String(place), location: PLACES[place], placedAt, readyAt: placedAt + 18 * MIN, promiseAt: placedAt + (outer ? 75 : 50) * MIN, ...opts };
}
const opts = { kitchen: KITCHEN, windowMin: 40, maxPerTrip: 3, nearKm: 3.2, now: NOW };

describe('planRoute', () => {
  it('finds the shortest on-time order for 3 stops', () => {
    const a = order('Priya', 'Ainthapali', 12), b = order('Rakesh', 'Farm Road', 7), c = order('Anjali', 'Bareipali', 2);
    const r = planRoute([a, b, c], KITCHEN, NOW);
    expect(r.onTime).toBe(true);
    // Farm Road is on the way to Ainthapali and Bareipali.
    expect(r.stops[0].id).toBe('Rakesh');
    expect(r.savedKm).toBeGreaterThan(5);
    expect(r.totalKm).toBeLessThan(r.soloKm);
  });

  it('departs when the last order is packed, not before', () => {
    const a = order('A', 'Farm Road', 2);
    const r = planRoute([a], KITCHEN, NOW);
    expect(r.departAt).toBe(a.readyAt);
    expect(r.legs[0].eta).toBeGreaterThan(r.departAt);
  });

  it('prefers an on-time plan over a shorter late plan', () => {
    // A is about to miss its promise, so it must be visited first even if that is longer.
    const urgent = order('Urgent', 'Ainthapali', 30, { promiseAt: NOW + 30 * MIN });
    const near = order('Near', 'Golebazar', 1);
    const r = planRoute([near, urgent], KITCHEN, NOW);
    expect(r.stops[0].id).toBe('Urgent');
  });

  it('handles many stops with nearest neighbour', () => {
    const places = Object.keys(PLACES).slice(0, 8) as (keyof typeof PLACES)[];
    const r = planRoute(places.map((p, i) => order('o' + i, p, i)), KITCHEN, NOW);
    expect(r.stops).toHaveLength(8);
    expect(new Set(r.stops.map(s => s.id)).size).toBe(8);
  });

  it('throws on an empty trip', () => {
    expect(() => planRoute([], KITCHEN, NOW)).toThrow();
  });
});

describe('suggestBatches', () => {
  it('groups same-side orders and keeps opposite sides apart', () => {
    const orders = [
      order('Priya', 'Ainthapali', 12), order('Rakesh', 'Farm Road', 7), order('Anjali', 'Bareipali', 2),
      order('Sourav', 'Khetrajpur', 18), order('Manas', 'Budharaja', 9),
    ];
    const b = suggestBatches(orders, opts);
    const keys = b.map(x => x.orders.map(o => o.id).sort().join(','));
    expect(keys).toContain('Anjali,Priya,Rakesh');
    expect(keys).toContain('Manas,Sourav');
    expect(b.every(x => x.route.onTime)).toBe(true);
  });

  it('never groups more than maxPerTrip', () => {
    const orders = ['a', 'b', 'c', 'd', 'e'].map((id, i) => order(id, 'Farm Road', i, { location: { lat: 21.4815 + i * 0.001, lng: 83.987 } }));
    const b = suggestBatches(orders, { ...opts, maxPerTrip: 2 });
    expect(Math.max(...b.map(x => x.orders.length))).toBe(2);
    expect(b.reduce((s, x) => s + x.orders.length, 0)).toBe(5);
  });

  it('respects the time window', () => {
    const a = order('Early', 'Ainthapali', 45), b = order('Late', 'Ainthapali', 0, { location: { lat: 21.4897, lng: 83.9942 } });
    // 45 min apart: a 40-min window must not group them…
    expect(suggestBatches([a, b], { ...opts, windowMin: 40 }).every(x => x.orders.length === 1)).toBe(true);
  });

  it('refuses a group that would make an on-time order late, and says why', () => {
    // Priya's food is promised soon; waiting for a brand-new order's 18-min prep would make her late.
    const priya = order('Priya', 'Ainthapali', 40);
    const fresh = order('Fresh', 'Farm Road', 0);
    const b = suggestBatches([priya, fresh], opts);
    expect(b).toHaveLength(2);
    const single = b.find(x => x.orders[0].id === 'Fresh')!;
    expect(single.why).toMatch(/late/);
  });

  it('labels outer-zone or lonely orders', () => {
    const b = suggestBatches([order('Debasis', 'Burla', 5), order('Priya', 'Ainthapali', 3)], opts);
    expect(b.find(x => x.orders[0].id === 'Debasis')!.why).toMatch(/No other order nearby/);
  });

  it('every pending order appears in exactly one batch', () => {
    const places = Object.keys(PLACES) as (keyof typeof PLACES)[];
    const orders = places.map((p, i) => order('o' + i, p, (i * 7) % 45));
    const b = suggestBatches(orders, opts);
    const ids = b.flatMap(x => x.orders.map(o => o.id));
    expect(ids.sort()).toEqual(orders.map(o => o.id).sort());
  });

  it('puts multi-stop trips first', () => {
    const b = suggestBatches([order('Solo', 'Burla', 30), order('A', 'Farm Road', 5), order('B', 'Ainthapali', 3)], opts);
    expect(b[0].orders.length).toBe(2);
  });

  it('batch key is order independent', () => {
    expect(batchKey([{ id: 'b' }, { id: 'a' }])).toBe(batchKey([{ id: 'a' }, { id: 'b' }]));
  });
});

describe('googleMapsRoute', () => {
  it('builds a multi-stop directions link', () => {
    const u = googleMapsRoute(KITCHEN, [PLACES['Farm Road'], PLACES.Ainthapali, PLACES.Bareipali]);
    expect(u).toContain('origin=21.471200,83.979500');
    expect(u).toContain('destination=21.501000,83.985000');
    expect(decodeURIComponent(u)).toContain('waypoints=21.481500,83.987000|21.489500,83.994000');
  });
  it('omits waypoints for a single stop', () => {
    expect(googleMapsRoute(KITCHEN, [PLACES.Burla])).not.toContain('waypoints');
  });
});
