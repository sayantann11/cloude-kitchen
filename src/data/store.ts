import type { Menu, Order, OrderLine, PayState, Settings, Trip, TripStop } from './types';

export type Unsub = () => void;

export interface OwnerSession { uid: string; email: string }

/**
 * Everything the app reads or writes goes through this interface.
 * Two implementations: LocalStore (browser storage, demo + tests) and FirebaseStore (production).
 */
export interface DataStore {
  readonly mode: 'local' | 'firebase';

  /** Anonymous id for this customer device (no OTP / no SMS cost). */
  customerUid(): Promise<string>;

  watchSettings(cb: (s: Settings) => void): Unsub;
  watchMenu(cb: (m: Menu) => void): Unsub;

  // customer
  placeOrder(o: Order): Promise<void>;
  watchOrder(id: string, cb: (o: Order | null) => void): Unsub;
  watchMyOrders(uid: string, cb: (o: Order[]) => void): Unsub;
  cancelOrder(id: string, reason: string): Promise<void>;
  claimPaid(id: string, utr: string): Promise<void>;

  // owner
  onOwner(cb: (s: OwnerSession | null) => void): Unsub;
  ownerSignIn(email: string, password: string): Promise<void>;
  ownerSignOut(): Promise<void>;
  saveSettings(patch: Partial<Settings>): Promise<void>;
  saveMenu(m: Menu): Promise<void>;
  /** Reduce counted stock for accepted lines; returns dishes that just sold out. */
  takeStock(lines: Pick<OrderLine, 'id' | 'qty'>[]): Promise<string[]>;
  watchOrdersSince(sinceMs: number, cb: (o: Order[]) => void): Unsub;
  updateOrder(id: string, patch: Partial<Order>): Promise<void>;
  /** Atomically create the trip and mark its orders "out". */
  dispatchTrip(t: Trip): Promise<void>;
  watchActiveTrips(cb: (t: Trip[]) => void): Unsub;
  updateTrip(id: string, patch: Partial<Trip>): Promise<void>;

  // rider (holds only the trip link)
  watchTrip(id: string, cb: (t: Trip | null) => void): Unsub;
  completeStop(trip: Trip, orderId: string, collected: TripStop['collected']): Promise<void>;
}

export const ACTIVE: Order['status'][] = ['placed', 'accepted', 'ready', 'out'];
export const isActive = (o: Order) => ACTIVE.includes(o.status);

/** Payment state after a stop is completed. */
export const payAfter = (collected: TripStop['collected']): PayState => (collected ? 'paid' : 'pending');
