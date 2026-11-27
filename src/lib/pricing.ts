import type { LatLng, Menu, MenuItem, OrderLine, Settings } from '../data/types';
import { roadKm } from './geo';

export type Cart = Record<string, number>; // itemId -> qty

export const MAX_QTY_PER_ITEM = 20;
export const LOW_STOCK = 5;

/** Portions left, or null when the kitchen isn't counting this dish. */
export const stockLeft = (i: MenuItem): number | null => (typeof i.stock === 'number' ? Math.max(0, Math.floor(i.stock)) : null);
/** Can a customer order it right now? */
export const sellable = (i: MenuItem) => i.available && !i.hidden && stockLeft(i) !== 0;
/** Most a customer can put in the cart. */
export const maxQty = (i: MenuItem) => Math.min(MAX_QTY_PER_ITEM, stockLeft(i) ?? MAX_QTY_PER_ITEM);

export interface Quote {
  lines: OrderLine[];
  missing: string[];      // items in cart that are gone or sold out
  capped: string[];       // items whose quantity was cut to the stock left
  count: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
  roadKm: number | null;
  outerZone: boolean;
  tooFar: boolean;
  belowMin: boolean;
  shortBy: number;        // ₹ to reach min order
  freeDeliveryGap: number;// ₹ more for free delivery (0 = already free / n/a)
  promiseMin: number;
}

export function quote(cart: Cart, items: MenuItem[], s: Settings, at: LatLng | null): Quote {
  const byId = new Map(items.map(i => [i.id, i]));
  const lines: OrderLine[] = [];
  const missing: string[] = [];
  const capped: string[] = [];
  for (const [id, rawQty] of Object.entries(cart)) {
    let qty = Math.max(0, Math.min(MAX_QTY_PER_ITEM, Math.floor(rawQty)));
    if (!qty) continue;
    const it = byId.get(id);
    if (!it || !sellable(it)) { missing.push(it?.name ?? id); continue; }
    if (qty > maxQty(it)) { qty = maxQty(it); capped.push(it.name); }
    lines.push({ id, name: it.name, price: it.price, qty, veg: it.veg });
  }
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const km = at ? roadKm(s.location, at) : null;
  const outerZone = km != null && km > s.outerZoneKm;
  const tooFar = km != null && km > s.maxDeliveryKm;
  const free = s.freeDeliveryAbove > 0 && subtotal >= s.freeDeliveryAbove;
  let deliveryFee = subtotal === 0 ? 0 : free ? 0 : s.deliveryFee;
  if (outerZone && subtotal > 0) deliveryFee += s.outerZoneFee;
  const belowMin = subtotal < s.minOrder;
  return {
    lines, missing, capped, count, subtotal, deliveryFee, total: subtotal + deliveryFee,
    roadKm: km, outerZone, tooFar, belowMin,
    shortBy: Math.max(0, s.minOrder - subtotal),
    freeDeliveryGap: !free && s.freeDeliveryAbove > 0 && subtotal > 0 ? s.freeDeliveryAbove - subtotal : 0,
    promiseMin: outerZone ? s.outerPromiseMin : s.promiseMin,
  };
}

export function cleanCart(cart: Cart, items: MenuItem[]): Cart {
  const ids = new Set(items.map(i => i.id));
  const out: Cart = {};
  for (const [id, q] of Object.entries(cart)) if (ids.has(id) && q > 0) out[id] = Math.min(MAX_QTY_PER_ITEM, Math.floor(q));
  return out;
}

/** Take accepted portions out of stock. Dishes that reach 0 are reported (they show as sold out by themselves). */
export function applyStock(m: Menu, lines: Pick<OrderLine, 'id' | 'qty'>[]): { menu: Menu; soldOut: string[]; changed: boolean } {
  const need = new Map<string, number>();
  for (const l of lines) need.set(l.id, (need.get(l.id) ?? 0) + l.qty);
  const soldOut: string[] = [];
  let changed = false;
  const items = m.items.map(i => {
    const left = stockLeft(i);
    const q = need.get(i.id);
    if (left === null || !q) return i;
    changed = true;
    const next = Math.max(0, left - q);
    if (next === 0 && left > 0) soldOut.push(i.name);
    return { ...i, stock: next };
  });
  return { menu: { ...m, items }, soldOut, changed };
}

/** Bulk price change: +/- percent or rupees, rounded to the nearest `round` rupees, never below ₹1. */
export function bulkPrice(price: number, mode: 'pct' | 'rs', amount: number, round = 1): number {
  const raw = mode === 'pct' ? price * (1 + amount / 100) : price + amount;
  const r = Math.max(1, round);
  return Math.max(1, Math.round(raw / r) * r);
}
