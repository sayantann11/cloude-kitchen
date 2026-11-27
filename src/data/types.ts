export interface LatLng { lat: number; lng: number }

export interface MenuItem {
  id: string;
  name: string;
  nameOr?: string;          // Odia name (optional)
  desc: string;
  price: number;            // ₹, integer
  veg: boolean;
  category: string;
  tag?: string;             // e.g. "Bestseller"
  available: boolean;       // false = sold out today
  imageUrl?: string;
}

export interface Menu {
  categories: string[];
  items: MenuItem[];
  updatedAt: number;
}

export interface DayHours { open: string; close: string; closed?: boolean } // "18:00", "23:30" (IST)

export interface Rider { id: string; name: string; phone: string }

export interface Settings {
  kitchenName: string;
  tagline: string;
  phone: string;            // shown to customers, e.g. "9876543210"
  whatsapp: string;         // digits only, with country code e.g. "919876543210"
  address: string;
  location: LatLng;
  hours: DayHours[];        // index 0 = Sunday … 6 = Saturday
  paused: boolean;          // owner hit "Pause orders"
  pauseMessage: string;
  minOrder: number;
  deliveryFee: number;
  freeDeliveryAbove: number;
  outerZoneKm: number;      // beyond this road-km the outer-zone rules apply
  outerZoneFee: number;
  maxDeliveryKm: number;    // beyond this we refuse the order
  promiseMin: number;       // in-town promise
  outerPromiseMin: number;
  prepMin: number;          // default kitchen prep time
  batchWindowMin: number;   // 30..50
  maxPerTrip: number;       // 2..4
  nearKm: number;           // max road-km between stops in one trip
  upiId: string;            // e.g. "kitchen@okaxis"; empty = no pay-now
  upiName: string;
  riders: Rider[];
  updatedAt: number;
}

export type OrderStatus = 'placed' | 'accepted' | 'ready' | 'out' | 'delivered' | 'cancelled' | 'rejected';
export type PayMethod = 'cod' | 'upi_on_delivery' | 'upi_now';
export type PayState = 'pending' | 'claimed' | 'paid';

export interface OrderLine { id: string; name: string; price: number; qty: number; veg: boolean }

export interface Order {
  id: string;
  code: string;             // short code shown to humans, e.g. "K7Q2"
  customerUid: string;
  name: string;
  phone: string;
  address: string;          // house no. + landmark
  area: string;             // nearest locality
  location: LatLng;
  note: string;             // cooking note
  lines: OrderLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  pay: PayMethod;
  payState: PayState;
  utr?: string;             // UPI reference the customer typed
  status: OrderStatus;
  prepMin?: number;
  placedAt: number;         // epoch ms
  acceptedAt?: number;
  readyAt?: number;
  outAt?: number;
  deliveredAt?: number;
  cancelledAt?: number;
  reason?: string;          // reject / cancel reason
  tripId?: string;
  kmSaved?: number;         // this order's share of km saved by batching
  riderName?: string;       // copied at dispatch so the customer can see/call the rider
  riderPhone?: string;
  tripSize?: number;        // orders in the same trip
  promiseAt: number;        // epoch ms
  roadKm: number;
}

export interface TripStop {
  orderId: string;
  code: string;
  name: string;
  phone: string;
  address: string;
  area: string;
  location: LatLng;
  total: number;
  pay: PayMethod;
  payState: PayState;
  eta: number;              // epoch ms
  promiseAt: number;
  done: boolean;
  doneAt?: number;
  collected?: 'cash' | 'upi' | 'prepaid';
}

export interface Trip {
  id: string;               // long random id; doubles as the rider's link secret
  riderId: string;
  riderName: string;
  riderPhone: string;
  stops: TripStop[];
  km: number;
  soloKm: number;
  departAt: number;
  returnAt: number;
  status: 'active' | 'done';
  createdAt: number;
  updatedAt: number;
}
