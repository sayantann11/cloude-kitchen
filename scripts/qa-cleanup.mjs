// Live admin QA, last step (always runs). Removes everything the tests created and restores the snapshot.
import fs from 'node:fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const QA_UID = 'qa-bot-owner';
const QA_NAME = 'QA Bot'; // every test order's customer name starts with this
initializeApp({ credential: cert(JSON.parse(process.env.SA_JSON)) });
const db = getFirestore();

// 1. Test orders and the trips that carried them
const since = Date.now() - 6 * 3600_000;
// QA Bot orders always; earlier manual "Test Customer" orders only once they're finished (an open one is left for the owner to try).
const isTest = d => {
  const n = String(d.get('name') ?? '');
  return n.startsWith(QA_NAME) || (n.startsWith('Test Customer') && ['cancelled', 'rejected', 'delivered'].includes(d.get('status')));
};
const orders = (await db.collection('orders').where('placedAt', '>=', Date.now() - 48 * 3600_000).get()).docs.filter(isTest);
const ids = new Set(orders.map(d => d.id));
console.log(`::notice::Final server status of test orders: ${orders.map(d => `${d.get('code')}=${d.get('status')}${d.get('reason') ? '(' + d.get('reason') + ')' : ''}`).join(', ')}`);
let trips = 0;
for (const t of (await db.collection('trips').where('createdAt', '>=', since).get()).docs) {
  const stops = t.get('stops') ?? [];
  if (stops.length && stops.every(s => ids.has(s.orderId))) { await t.ref.delete(); trips++; }
}
for (const o of orders) await o.ref.delete();

// 2. Menu + settings back exactly as they were
let restored = 'no snapshot';
if (fs.existsSync(process.env.SNAPSHOT_FILE)) {
  const snap = JSON.parse(fs.readFileSync(process.env.SNAPSHOT_FILE, 'utf8'));
  for (const id of ['menu', 'settings']) {
    if (snap[id]) await db.doc(`public/${id}`).set(snap[id]);
    else await db.doc(`public/${id}`).delete();
  }
  restored = 'menu + settings restored';
}

// 3. Temporary admin gone
await db.doc(`owners/${QA_UID}`).delete();
await getAuth().deleteUser(QA_UID).catch(() => {});
console.log(`::notice::Cleanup: deleted ${orders.length} test orders and ${trips} test trips, ${restored}, temporary QA admin removed.`);
