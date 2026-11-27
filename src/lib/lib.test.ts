import { describe, expect, it } from 'vitest';
import { SEED_MENU, SEED_SETTINGS } from '../data/seed';
import { openState, istParts, fmtHHMM } from './hours';
import { applyStock, bulkPrice, cleanCart, maxQty, quote, sellable } from './pricing';
import { PLACES, nearestPlace } from './geo';
import { normalizePhone, validateCheckout, isUpiId, isUtr, cleanText } from './validate';
import { upiLink } from './upi';
import { rupees, prettyPhone, istDay } from './format';
import { docId, shortCode } from './ids';

const evening = { open: '18:00', close: '23:30' };
const S = { ...SEED_SETTINGS, hours: Array.from({ length: 7 }, () => evening) };
const items = SEED_MENU.items;
const ist = (y: number, mo: number, d: number, h: number, mi = 0) => Date.UTC(y, mo, d, h, mi) - 330 * 60_000;

describe('pricing', () => {
  it('adds delivery fee below the free threshold', () => {
    const q = quote({ 'paneer-masala': 1 }, items, S, PLACES['Farm Road']);
    expect(q.subtotal).toBe(185);
    expect(q.deliveryFee).toBe(25);
    expect(q.total).toBe(210);
    expect(q.freeDeliveryGap).toBe(214);
    expect(q.outerZone).toBe(false);
  });
  it('free delivery at or above the threshold', () => {
    const q = quote({ 'paneer-masala': 2, 'jeera-rice': 1 }, items, S, PLACES['Farm Road']);
    expect(q.subtotal).toBe(470);
    expect(q.deliveryFee).toBe(0);
  });
  it('outer zone adds a fee and a longer promise', () => {
    const q = quote({ 'paneer-masala': 3 }, items, S, PLACES.Burla);
    expect(q.outerZone).toBe(true);
    expect(q.deliveryFee).toBe(40);
    expect(q.promiseMin).toBe(75);
  });
  it('flags minimum order and sold-out items', () => {
    const sold = items.map(i => i.id === 'green-salad' ? { ...i, available: false } : i);
    const q = quote({ 'tawa-roti-each': 1, 'green-salad': 2, ghost: 1 }, sold, S, null);
    expect(q.belowMin).toBe(true);
    expect(q.shortBy).toBe(87);
    expect(q.missing).toEqual(['Green Salad', 'ghost']);
    expect(q.lines).toHaveLength(1);
  });
  it('clamps quantities and drops junk', () => {
    expect(cleanCart({ 'veg-roll': 99, ghost: 2, 'veg-wrap': 0, 'dal-fry': 1.7 }, items)).toEqual({ 'veg-roll': 20, 'dal-fry': 1 });
    expect(quote({ 'veg-roll': -3 }, items, S, null).count).toBe(0);
  });
  it('rejects addresses beyond max delivery distance', () => {
    expect(quote({ 'veg-roll': 1 }, items, S, { lat: 21.7, lng: 84.2 }).tooFar).toBe(true);
  });
});

describe('menu card + stock', () => {
  it('loads the full Night Kitchen menu, all veg, unique ids', () => {
    expect(items.length).toBe(103);
    expect(new Set(items.map(i => i.id)).size).toBe(items.length);
    expect(items.every(i => i.veg && i.price > 0 && SEED_MENU.categories.includes(i.category))).toBe(true);
    expect(items.find(i => i.name === 'Nizami Deewani Handi')?.price).toBe(225);
    expect(items.find(i => i.name === 'Tawa Roti (each)')?.price).toBe(12);
  });
  it('hidden, switched off and zero stock are not sellable', () => {
    const base = items[0];
    expect(sellable(base)).toBe(true);
    expect(sellable({ ...base, hidden: true })).toBe(false);
    expect(sellable({ ...base, available: false })).toBe(false);
    expect(sellable({ ...base, stock: 0 })).toBe(false);
    expect(sellable({ ...base, stock: null })).toBe(true);
    expect(maxQty({ ...base, stock: 3 })).toBe(3);
    expect(maxQty({ ...base, stock: null })).toBe(20);
  });
  it('caps cart quantity at the stock left', () => {
    const its = items.map(i => i.id === 'veg-roll' ? { ...i, stock: 2 } : i);
    const q = quote({ 'veg-roll': 5 }, its, S, null);
    expect(q.lines[0].qty).toBe(2);
    expect(q.capped).toEqual(['Veg Roll']);
  });
  it('accepting an order takes stock and reports dishes that sold out', () => {
    const m = { ...SEED_MENU, items: items.map(i => i.id === 'veg-roll' ? { ...i, stock: 2 } : i.id === 'dal-fry' ? { ...i, stock: 10 } : i) };
    const r = applyStock(m, [{ id: 'veg-roll', qty: 2 }, { id: 'dal-fry', qty: 1 }, { id: 'jeera-rice', qty: 4 }]);
    expect(r.soldOut).toEqual(['Veg Roll']);
    expect(r.menu.items.find(i => i.id === 'veg-roll')?.stock).toBe(0);
    expect(r.menu.items.find(i => i.id === 'dal-fry')?.stock).toBe(9);
    expect(r.menu.items.find(i => i.id === 'jeera-rice')?.stock).toBeUndefined(); // not counted
    expect(applyStock(SEED_MENU, [{ id: 'jeera-rice', qty: 1 }]).changed).toBe(false);
  });
  it('bulk price change rounds and never goes below ₹1', () => {
    expect(bulkPrice(185, 'pct', 10, 5)).toBe(205);
    expect(bulkPrice(100, 'pct', 10, 1)).toBe(110);
    expect(bulkPrice(149, 'rs', 10)).toBe(159);
    expect(bulkPrice(12, 'rs', -20)).toBe(1);
    expect(bulkPrice(99, 'pct', -10, 10)).toBe(90);
  });
});

describe('opening hours (IST)', () => {
  it('reads IST correctly', () => {
    expect(istParts(ist(2026, 10, 27, 19, 30))).toEqual({ day: 5, minutes: 19 * 60 + 30 });
  });
  it('open in the evening window, closed before', () => {
    expect(openState(S, ist(2026, 10, 27, 19, 0)).open).toBe(true);
    const st = openState(S, ist(2026, 10, 27, 15, 0));
    expect(st.open).toBe(false);
    expect(st.label).toBe('Closed now · opens today 6 pm');
  });
  it('after closing points to tomorrow', () => {
    expect(openState(S, ist(2026, 10, 27, 23, 45)).label).toBe('Closed now · opens tomorrow 6 pm');
  });
  it('handles windows past midnight', () => {
    const late = { ...S, hours: S.hours.map(() => ({ open: '18:00', close: '01:00' })) };
    expect(openState(late, ist(2026, 10, 28, 0, 30)).open).toBe(true);
    expect(openState(late, ist(2026, 10, 28, 1, 30)).open).toBe(false);
  });
  it('same open and close time means open 24 hours', () => {
    expect(openState(SEED_SETTINGS, ist(2026, 10, 27, 15, 0)).label).toBe('Open 24 hours');
  });
  it('closed days and pause', () => {
    const shut = { ...S, hours: S.hours.map((h, i) => (i === 5 ? { ...h, closed: true } : h)) };
    expect(openState(shut, ist(2026, 10, 27, 19, 0)).open).toBe(false); // Friday closed
    expect(openState({ ...S, paused: true }, ist(2026, 10, 27, 19, 0)).reason).toBe('paused');
  });
  it('formats times', () => {
    expect(fmtHHMM('18:00')).toBe('6 pm');
    expect(fmtHHMM('23:30')).toBe('11:30 pm');
    expect(fmtHHMM('00:15')).toBe('12:15 am');
  });
});

describe('validation', () => {
  it('normalises Indian mobiles', () => {
    expect(normalizePhone('98610 41221')).toBe('9861041221');
    expect(normalizePhone('+91 98610-41221')).toBe('9861041221');
    expect(normalizePhone('09861041221')).toBe('9861041221');
    expect(normalizePhone('919861041221')).toBe('9861041221');
    expect(normalizePhone('5861041221')).toBeNull();
    expect(normalizePhone('98610')).toBeNull();
  });
  it('checkout errors', () => {
    expect(validateCheckout({ name: 'A', phone: '1', address: 'x' })).toEqual({
      name: expect.any(String), phone: expect.any(String), address: expect.any(String),
    });
    expect(validateCheckout({ name: 'Priya', phone: '9861041221', address: 'Near Ainthapali Chowk' })).toEqual({});
  });
  it('UPI id and UTR', () => {
    expect(isUpiId('kitchen@okaxis')).toBe(true);
    expect(isUpiId('kitchen')).toBe(false);
    expect(isUtr('123456789012')).toBe(true);
    expect(isUtr('12345')).toBe(false);
  });
  it('cleans text', () => {
    expect(cleanText('  a\n\tb  ', 10)).toBe('a b');
    expect(cleanText('x'.repeat(50), 5)).toBe('xxxxx');
  });
});

describe('misc', () => {
  it('UPI link', () => {
    const u = upiLink({ upiId: 'k@okaxis', name: 'The Night Kitchen', amount: 205, note: 'Order K7Q2', ref: 'K7Q2' });
    expect(u.startsWith('upi://pay?')).toBe(true);
    expect(u).toContain('pa=k%40okaxis');
    expect(u).toContain('am=205.00');
    expect(u).toContain('cu=INR');
  });
  it('nearest place', () => {
    expect(nearestPlace({ lat: 21.4896, lng: 83.9941 })).toBe('Ainthapali');
    expect(nearestPlace({ lat: 22.5, lng: 85 })).toBe('Sambalpur outskirts');
  });
  it('formats', () => {
    expect(rupees(12345)).toBe('₹12,345');
    expect(prettyPhone('9861041221')).toBe('98610 41221');
    expect(istDay(ist(2026, 10, 27, 23, 59))).toBe('2026-11-27');
    expect(istDay(ist(2026, 10, 28, 0, 1))).toBe('2026-11-28');
  });
  it('ids', () => {
    expect(docId()).toMatch(/^[A-Za-z0-9]{20}$/);
    expect(shortCode()).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
    expect(new Set(Array.from({ length: 500 }, docId)).size).toBe(500);
  });
});
