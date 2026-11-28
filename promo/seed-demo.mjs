// Realistic demo data for the promo recordings (demo mode only: it lives in the browser's
// localStorage, nothing touches Firebase). One busy evening at a Sambalpur cloud kitchen.
//   buildSeed(nowMs) -> { 'mk:settings': ..., 'mk:menu2': ..., 'mk:orders': ..., ... } (JSON strings)
//   newOrder(nowMs, i) -> a fresh "placed" order to drop in while recording.
import { SEED_MENU } from '../src/data/seed.ts';

const KITCHEN = { lat: 21.4712, lng: 83.9795 };
const PLACES = {
  Ainthapali: { lat: 21.4895, lng: 83.994 }, 'Farm Road': { lat: 21.4815, lng: 83.987 }, Bareipali: { lat: 21.501, lng: 83.985 },
  Khetrajpur: { lat: 21.456, lng: 83.969 }, Budharaja: { lat: 21.4625, lng: 83.959 }, Dhanupali: { lat: 21.46, lng: 83.993 },
  Golebazar: { lat: 21.469, lng: 83.972 }, Sakhipara: { lat: 21.4745, lng: 83.9665 }, Modipara: { lat: 21.472, lng: 83.98 },
  Gopalmal: { lat: 21.486, lng: 83.972 }, Jharuapara: { lat: 21.4655, lng: 83.9785 }, 'Station Bazar': { lat: 21.4585, lng: 83.9785 },
};
const NAMES = ['Rohan Patel', 'Ananya Mishra', 'Sourav Panda', 'Priyanka Sahu', 'Arjun Nayak', 'Sneha Behera', 'Rahul Das', 'Pooja Mohanty',
  'Aditya Pradhan', 'Ishita Rath', 'Karan Agarwal', 'Megha Tripathy', 'Vikram Singh', 'Riya Dash', 'Abhishek Meher', 'Nisha Bhoi',
  'Siddharth Jena', 'Tanvi Panigrahi', 'Manish Sahoo', 'Kavya Padhi', 'Deepak Barik', 'Shreya Hota', 'Amit Kar', 'Swati Nanda'];
const POPULAR = ['paneer-biryani', 'veg-biryani', 'paneer-masala', 'veg-hakka-noodles', 'chinese-combo', 'paneer-meal', 'veg-fried-momos',
  'paneer-roll', 'dal-makhani', 'butter-roti-each', 'jeera-rice', 'paneer-chilli-dry', 'honey-chilli-potato', 'french-fries', 'kaju-curry',
  'budget-dinner', 'biryani-combo', 'veg-manchurian-dry', 'schezwan-noodles', 'boondi-raita', 'lachha-paratha', 'malai-kofta'];

function rng(seed) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); }
const byId = new Map(SEED_MENU.items.map(i => [i.id, i]));
const pick = (r, a) => a[Math.floor(r() * a.length)];
const roadKm = p => Math.round(Math.hypot((p.lat - KITCHEN.lat) * 111, (p.lng - KITCHEN.lng) * 103.6) * 1.35 * 10) / 10;
const code = r => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(r() * 32)]).join('');

function makeOrder(r, n, placedAt, status) {
  const area = pick(r, Object.keys(PLACES));
  const base = PLACES[area];
  const location = { lat: base.lat + (r() - 0.5) * 0.004, lng: base.lng + (r() - 0.5) * 0.004 };
  const lines = [];
  const count = 1 + Math.floor(r() * 3);
  for (let k = 0; k < count; k++) {
    const it = byId.get(pick(r, POPULAR));
    if (!it || lines.some(l => l.id === it.id)) continue;
    const qty = it.price < 30 ? 2 + Math.floor(r() * 3) : 1 + (r() < 0.25 ? 1 : 0);
    lines.push({ id: it.id, name: it.name, price: it.price, qty, veg: true });
  }
  const subtotal = lines.reduce((a, l) => a + l.price * l.qty, 0);
  const deliveryFee = subtotal >= 399 ? 0 : 25;
  const pay = r() < 0.55 ? 'cod' : r() < 0.6 ? 'upi_now' : 'upi_on_delivery';
  const km = roadKm(location);
  const o = {
    id: `demo${n.toString().padStart(4, '0')}${code(r)}`, code: code(r), customerUid: `anon_demo_${n}`,
    name: NAMES[n % NAMES.length], phone: `9${Math.floor(r() * 9) + 1}${String(Math.floor(r() * 1e8)).padStart(8, '0')}`,
    address: `House ${10 + Math.floor(r() * 180)}, near ${pick(r, ['Hanuman temple', 'SBI ATM', 'Jagannath mandir', 'big banyan tree', 'water tank', 'school gate'])}`,
    area, location, note: r() < 0.25 ? pick(r, ['less spicy please', 'extra onion', 'no onion no garlic', 'ring the bell twice']) : '',
    lines, subtotal, deliveryFee, total: subtotal + deliveryFee, pay, payState: 'pending', status,
    placedAt, promiseAt: placedAt + 50 * 60_000, roadKm: km,
  };
  if (status !== 'placed' && status !== 'cancelled') { o.acceptedAt = placedAt + (1 + r() * 2) * 60_000; o.prepMin = 20; }
  if (['ready', 'out', 'delivered'].includes(status)) o.readyAt = o.acceptedAt + (14 + r() * 8) * 60_000;
  if (['out', 'delivered'].includes(status)) { o.outAt = o.readyAt + (2 + r() * 6) * 60_000; o.riderName = pick(r, ['Bikash', 'Sanjay', 'Ravi']); o.riderPhone = '9876500001'; }
  if (status === 'delivered') {
    o.deliveredAt = o.outAt + (8 + r() * 14) * 60_000;
    o.payState = 'paid';
    o.kmSaved = r() < 0.45 ? Math.round((0.6 + r() * 1.8) * 10) / 10 : 0;
  }
  if (status === 'cancelled') { o.cancelledAt = placedAt + 3 * 60_000; o.reason = 'Ordered by mistake'; }
  return o;
}

/** A busy evening up to `now` (IST): ~38 delivered, a few cancelled, some still cooking. */
export function buildSeed(now) {
  const r = rng(2026);
  const orders = {};
  const start = now - (3 * 60 + 20) * 60_000; // from ~18:50
  let n = 1;
  // evening curve: slow start, rush 20:00-21:30
  const slots = [3, 4, 6, 8, 9, 7, 4, 3];
  slots.forEach((k, s) => {
    for (let j = 0; j < k; j++) {
      const placedAt = start + s * 25 * 60_000 + r() * 25 * 60_000;
      if (placedAt > now - 75 * 60_000) continue;
      const o = makeOrder(r, n++, placedAt, r() < 0.06 ? 'cancelled' : 'delivered');
      orders[o.id] = o;
    }
  });
  // in progress right now: two cooking, one packed
  for (const [mins, st] of [[34, 'ready'], [22, 'accepted'], [16, 'accepted']]) { const o = makeOrder(r, n++, now - mins * 60_000, st); orders[o.id] = o; }

  const stock = { 'paneer-biryani': 3, 'veg-fried-momos': 2, 'dal-makhani': 4, 'veg-biryani': 18, 'paneer-masala': 14, 'kaju-curry': 9, 'chinese-combo': 12 };
  const menu = { ...SEED_MENU, updatedAt: now, items: SEED_MENU.items.map(i => ({ ...i, ...(i.id in stock ? { stock: stock[i.id] } : {}), ...(i.id === 'mushroom-do-pyaza' ? { available: false } : {}), ...(i.id === 'paneer-biryani' || i.id === 'chinese-combo' ? { tag: 'Bestseller' } : {}) })) };
  const allDay = Array.from({ length: 7 }, () => ({ open: '00:00', close: '00:00' }));
  const settings = {
    kitchenName: 'Midnight Tadka', tagline: 'Late-night pure veg, hot in 40 minutes', hours: allDay, paused: false,
    phone: '9437012345', whatsapp: '919437012345', upiId: 'midnighttadka@okaxis', upiName: 'Midnight Tadka',
    riders: [{ id: 'r1', name: 'Bikash', phone: '9876500001' }, { id: 'r2', name: 'Sanjay', phone: '9876500002' }, { id: 'r3', name: 'Ravi', phone: '9876500003' }],
  };
  return {
    'mk:settings': JSON.stringify(settings),
    'mk:menu2': JSON.stringify(menu),
    'mk:orders': JSON.stringify(orders),
    'mk:trips': '{}',
    'mk:owner': JSON.stringify({ uid: 'owner_demo', email: 'owner@demo.local' }),
    'mk:lang': '"en"',
  };
}

/** Orders that "come in" live during the first clip (close together so they group into one trip). */
export function newOrder(now, i) {
  const r = rng(500 + i);
  const fixed = [
    { name: 'Aarav Mehta', area: 'Farm Road', lines: [['paneer-biryani', 1], ['boondi-raita', 1]] },
    { name: 'Diya Sharma', area: 'Ainthapali', lines: [['chinese-combo', 1], ['veg-fried-momos', 1]] },
    { name: 'Kabir Rao', area: 'Bareipali', lines: [['paneer-meal', 2]] },
  ][i];
  const o = makeOrder(r, 900 + i, now, 'placed');
  o.name = fixed.name; o.area = fixed.area;
  o.location = { ...PLACES[fixed.area] };
  o.roadKm = roadKm(o.location);
  o.lines = fixed.lines.map(([id, qty]) => { const it = byId.get(id); return { id, name: it.name, price: it.price, qty, veg: true }; });
  o.subtotal = o.lines.reduce((a, l) => a + l.price * l.qty, 0);
  o.deliveryFee = o.subtotal >= 399 ? 0 : 25;
  o.total = o.subtotal + o.deliveryFee;
  o.pay = 'cod'; o.note = i === 0 ? 'less spicy please' : '';
  o.promiseAt = now + 50 * 60_000;
  return o;
}
