import { computed, effect, signal } from '@preact/signals';
import { SEED_MENU, SEED_SETTINGS } from '../data/seed';
import type { DataStore, OwnerSession } from '../data/store';
import type { LatLng, Menu, Settings } from '../data/types';
import { openState } from '../lib/hours';
import type { Cart } from '../lib/pricing';

function load<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? { ...fallback, ...JSON.parse(v) } as T : fallback; } catch { return fallback; }
}
function loadRaw<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : fallback; } catch { return fallback; }
}
function persist<T>(key: string, s: { value: T }) {
  effect(() => { try { localStorage.setItem(key, JSON.stringify(s.value)); } catch { /* ignore */ } });
}

export const store = signal<DataStore | null>(null);

// Settings + menu paint instantly from cache, then live data replaces them.
export const settings = signal<Settings>(load('mk:c:settings', SEED_SETTINGS));
export const menu = signal<Menu>(loadRaw('mk:c:menu', SEED_MENU));
export const liveLoaded = signal(false);
persist('mk:c:settings', settings);
persist('mk:c:menu', menu);

export const cart = signal<Cart>(loadRaw('mk:cart', {}));
persist('mk:cart', cart);
export const cookingNote = signal<string>(loadRaw('mk:note', ''));
persist('mk:note', cookingNote);

export interface Profile { name: string; phone: string; address: string; location: LatLng | null }
export const profile = signal<Profile>(load('mk:profile', { name: '', phone: '', address: '', location: null }));
persist('mk:profile', profile);

export const lang = signal<'en' | 'or'>(loadRaw('mk:lang', 'en'));
persist('mk:lang', lang);
export const vegOnly = signal<boolean>(loadRaw('mk:veg', false));
persist('mk:veg', vegOnly);

export const owner = signal<OwnerSession | null | undefined>(undefined); // undefined = still checking

/** Ticks every 15 s so "x min ago" and ETAs stay fresh without re-fetching. */
export const now = signal(Date.now());
setInterval(() => { now.value = Date.now(); }, 15_000);

export const open = computed(() => openState(settings.value, now.value));
export const cartCount = computed(() => Object.values(cart.value).reduce((a, b) => a + b, 0));

export function setQty(id: string, qty: number) {
  const next = { ...cart.value };
  if (qty <= 0) delete next[id]; else next[id] = Math.min(20, qty);
  cart.value = next;
}

// Toasts
export const toast = signal<{ msg: string; kind: 'ok' | 'err'; id: number } | null>(null);
let tt: ReturnType<typeof setTimeout> | undefined;
export function notify(msg: string, kind: 'ok' | 'err' = 'ok') {
  toast.value = { msg, kind, id: Date.now() };
  clearTimeout(tt);
  tt = setTimeout(() => { toast.value = null; }, kind === 'err' ? 5000 : 2800);
}
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Check your internet and try again.');

export async function boot(createStore: () => Promise<DataStore>) {
  const s = await createStore();
  store.value = s;
  s.watchSettings(v => { settings.value = v; liveLoaded.value = true; });
  s.watchMenu(v => { menu.value = v; });
  s.onOwner(v => { owner.value = v; });
}
