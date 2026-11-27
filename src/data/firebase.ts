/**
 * FirebaseStore: production backend on Firebase's free Spark plan.
 *   Firestore  public/settings, public/menu  (2 reads per visitor, cached offline)
 *              orders/{id}, trips/{id}, owners/{uid}
 *   Auth       anonymous sign-in for customers and riders (free, no SMS);
 *              email + password for the kitchen owner.
 * Security is enforced by firestore.rules, not by this file.
 */
import { initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signOut, type User,
} from 'firebase/auth';
import {
  collection, doc, getDoc, initializeFirestore, limit, onSnapshot, orderBy, persistentLocalCache,
  persistentMultipleTabManager, query, runTransaction, setDoc, updateDoc, where, writeBatch,
  type DocumentData, type Firestore, type UpdateData,
} from 'firebase/firestore';
import { SEED_MENU, SEED_SETTINGS } from './seed';
import type { DataStore, OwnerSession, Unsub } from './store';
import { payAfter } from './store';
import type { Menu, Order, OrderLine, Settings, Trip, TripStop } from './types';
import { applyStock } from '../lib/pricing';

/** Firestore rejects `undefined`; strip it recursively. */
function clean<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export class FirebaseStore implements DataStore {
  readonly mode = 'firebase' as const;
  private db: Firestore;
  private auth;
  private ready: Promise<User | null>;

  constructor(config: FirebaseOptions) {
    const app = initializeApp(config);
    this.auth = getAuth(app);
    let db: Firestore;
    try {
      db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
    } catch {
      db = initializeFirestore(app, {}); // private mode / no IndexedDB
    }
    this.db = db;
    this.ready = new Promise(res => {
      const off = onAuthStateChanged(this.auth, u => { off(); res(u); });
    });
  }

  /** Make sure *someone* is signed in (anonymous if nobody). */
  private async user(): Promise<User> {
    const u = (await this.ready) ?? this.auth.currentUser;
    if (u) return u;
    const cred = await signInAnonymously(this.auth);
    return cred.user;
  }

  async customerUid() { return (await this.user()).uid; }

  watchSettings(cb: (s: Settings) => void): Unsub {
    return onSnapshot(doc(this.db, 'public', 'settings'),
      snap => cb({ ...SEED_SETTINGS, ...(snap.data() as Partial<Settings> | undefined) }),
      () => cb(SEED_SETTINGS));
  }
  watchMenu(cb: (m: Menu) => void): Unsub {
    return onSnapshot(doc(this.db, 'public', 'menu'),
      snap => cb((snap.data() as Menu | undefined) ?? SEED_MENU),
      () => cb(SEED_MENU));
  }

  async placeOrder(o: Order) {
    const u = await this.user();
    if (u.uid !== o.customerUid) o = { ...o, customerUid: u.uid };
    await setDoc(doc(this.db, 'orders', o.id), clean(o));
  }
  watchOrder(id: string, cb: (o: Order | null) => void): Unsub {
    let off: Unsub = () => {};
    let dead = false;
    this.user().then(() => {
      if (dead) return;
      off = onSnapshot(doc(this.db, 'orders', id), s => cb(s.exists() ? (s.data() as Order) : null), () => cb(null));
    });
    return () => { dead = true; off(); };
  }
  watchMyOrders(uid: string, cb: (o: Order[]) => void): Unsub {
    let off: Unsub = () => {};
    let dead = false;
    this.user().then(u => {
      if (dead) return;
      const q = query(collection(this.db, 'orders'), where('customerUid', '==', u.uid || uid), orderBy('placedAt', 'desc'), limit(30));
      off = onSnapshot(q, s => cb(s.docs.map(d => d.data() as Order)), () => cb([]));
    });
    return () => { dead = true; off(); };
  }
  async cancelOrder(id: string, reason: string) {
    await this.user();
    await runTransaction(this.db, async tx => {
      const ref = doc(this.db, 'orders', id);
      const s = await tx.get(ref);
      if (!s.exists()) throw new Error('Order not found');
      if ((s.data() as Order).status !== 'placed') throw new Error('The kitchen has already accepted this order. Please call them to cancel.');
      tx.update(ref, { status: 'cancelled', cancelledAt: Date.now(), reason });
    });
  }
  async claimPaid(id: string, utr: string) {
    await this.user();
    await updateDoc(doc(this.db, 'orders', id), { payState: 'claimed', utr });
  }

  onOwner(cb: (s: OwnerSession | null) => void): Unsub {
    return onAuthStateChanged(this.auth, async u => {
      if (!u || u.isAnonymous) return cb(null);
      try {
        const own = await getDoc(doc(this.db, 'owners', u.uid));
        cb(own.exists() ? { uid: u.uid, email: u.email ?? '' } : null);
      } catch { cb(null); }
    });
  }
  async ownerSignIn(email: string, password: string) {
    try {
      const cred = await signInWithEmailAndPassword(this.auth, email.trim(), password);
      const own = await getDoc(doc(this.db, 'owners', cred.user.uid));
      if (!own.exists()) { await signOut(this.auth); throw new Error('This account is not set up as the kitchen owner.'); }
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) throw new Error('Wrong email or password');
      if (code.includes('too-many-requests')) throw new Error('Too many attempts. Wait a minute and try again.');
      throw e;
    }
  }
  async ownerSignOut() { await signOut(this.auth); }

  async saveSettings(patch: Partial<Settings>) {
    await setDoc(doc(this.db, 'public', 'settings'), clean({ ...patch, updatedAt: Date.now() }), { merge: true });
  }
  async saveMenu(m: Menu) {
    await setDoc(doc(this.db, 'public', 'menu'), clean({ ...m, updatedAt: Date.now() }));
  }
  async takeStock(lines: Pick<OrderLine, 'id' | 'qty'>[]) {
    const ref = doc(this.db, 'public', 'menu');
    return runTransaction(this.db, async tx => {
      const snap = await tx.get(ref);
      const r = applyStock((snap.data() as Menu | undefined) ?? SEED_MENU, lines);
      if (r.changed) tx.set(ref, clean({ ...r.menu, updatedAt: Date.now() }));
      return r.soldOut;
    });
  }
  watchOrdersSince(since: number, cb: (o: Order[]) => void): Unsub {
    const q = query(collection(this.db, 'orders'), where('placedAt', '>=', since), orderBy('placedAt', 'desc'));
    return onSnapshot(q, s => cb(s.docs.map(d => d.data() as Order)), err => console.error('orders listener', err));
  }
  async updateOrder(id: string, patch: Partial<Order>) {
    await updateDoc(doc(this.db, 'orders', id), clean(patch) as UpdateData<DocumentData>);
  }
  async dispatchTrip(t: Trip) {
    await runTransaction(this.db, async tx => {
      const refs = t.stops.map(s => doc(this.db, 'orders', s.orderId));
      const snaps = await Promise.all(refs.map(r => tx.get(r)));
      snaps.forEach((s, i) => {
        const st = s.data()?.status;
        if (st !== 'accepted' && st !== 'ready') throw new Error(`Order ${t.stops[i].code} is no longer waiting to be sent`);
      });
      tx.set(doc(this.db, 'trips', t.id), clean(t));
      const share = Math.max(0, t.soloKm - t.km) / t.stops.length;
      refs.forEach(r => tx.update(r, { status: 'out', outAt: t.departAt, tripId: t.id, kmSaved: share, riderName: t.riderName, riderPhone: t.riderPhone, tripSize: t.stops.length }));
    });
  }
  watchActiveTrips(cb: (t: Trip[]) => void): Unsub {
    const q = query(collection(this.db, 'trips'), where('status', '==', 'active'));
    return onSnapshot(q, s => cb(s.docs.map(d => d.data() as Trip).sort((a, b) => a.createdAt - b.createdAt)), err => console.error('trips listener', err));
  }
  async updateTrip(id: string, patch: Partial<Trip>) {
    await updateDoc(doc(this.db, 'trips', id), clean({ ...patch, updatedAt: Date.now() }) as UpdateData<DocumentData>);
  }
  watchTrip(id: string, cb: (t: Trip | null) => void): Unsub {
    let off: Unsub = () => {};
    let dead = false;
    this.user().then(() => {
      if (dead) return;
      off = onSnapshot(doc(this.db, 'trips', id), s => cb(s.exists() ? (s.data() as Trip) : null), () => cb(null));
    });
    return () => { dead = true; off(); };
  }
  async completeStop(trip: Trip, orderId: string, collected: TripStop['collected']) {
    await this.user();
    const now = Date.now();
    const stops = trip.stops.map(s => (s.orderId === orderId ? { ...s, done: true, doneAt: now, collected, payState: payAfter(collected) } : s));
    const b = writeBatch(this.db);
    b.update(doc(this.db, 'trips', trip.id), clean({ stops, status: stops.every(s => s.done) ? 'done' : 'active', updatedAt: now }));
    b.update(doc(this.db, 'orders', orderId), { status: 'delivered', deliveredAt: now, payState: payAfter(collected) });
    await b.commit();
  }
}
