import type { LatLng, MenuItem, OrderLine, Settings } from '../data/types';
import { roadKm } from './geo';

export type Cart = Record<string, number>; // itemId -> qty

export const MAX_QTY_PER_ITEM = 20;

export interface Quote {
  lines: OrderLine[];
  missing: string[];      // items in cart that are gone or sold out
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
  for (const [id, rawQty] of Object.entries(cart)) {
    const qty = Math.max(0, Math.min(MAX_QTY_PER_ITEM, Math.floor(rawQty)));
    if (!qty) continue;
    const it = byId.get(id);
    if (!it || !it.available) { missing.push(it?.name ?? id); continue; }
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
    lines, missing, count, subtotal, deliveryFee, total: subtotal + deliveryFee,
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
