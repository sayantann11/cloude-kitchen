import type { DayHours, Settings } from '../data/types';

/** Minutes since midnight and weekday in India Standard Time for an epoch ms. IST has no DST. */
export function istParts(ms: number): { day: number; minutes: number } {
  const d = new Date(ms + 330 * 60_000); // UTC+5:30
  return { day: d.getUTCDay(), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

export const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export function fmtHHMM(hhmm: string): string {
  const m = toMin(hhmm);
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  const ap = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return mm ? `${h12}:${String(mm).padStart(2, '0')} ${ap}` : `${h12} ${ap}`;
}

export interface OpenState { open: boolean; reason: 'open' | 'paused' | 'closed'; label: string; closesAt?: string; opensAt?: string }

/** Handles windows that cross midnight (e.g. 18:00–01:00). */
export function openState(s: Pick<Settings, 'hours' | 'paused' | 'pauseMessage'>, now: number): OpenState {
  if (s.paused) return { open: false, reason: 'paused', label: s.pauseMessage || 'Not taking orders right now' };
  const { day, minutes } = istParts(now);
  const prev = (day + 6) % 7;
  const inWindow = (h: DayHours | undefined, t: number, yesterday: boolean) => {
    if (!h || h.closed) return false;
    const o = toMin(h.open), c = toMin(h.close);
    if (c > o) return !yesterday && t >= o && t < c;
    // crosses midnight
    return yesterday ? t < c : t >= o;
  };
  const today = s.hours[day];
  const yday = s.hours[prev];
  if (inWindow(today, minutes, false)) return { open: true, reason: 'open', label: `Open till ${fmtHHMM(today.close)}`, closesAt: today.close };
  if (inWindow(yday, minutes, true)) return { open: true, reason: 'open', label: `Open till ${fmtHHMM(yday.close)}`, closesAt: yday.close };
  // find next opening
  for (let i = 0; i < 8; i++) {
    const h = s.hours[(day + i) % 7];
    if (!h || h.closed) continue;
    if (i === 0 && toMin(h.open) <= minutes) continue;
    const when = i === 0 ? `today ${fmtHHMM(h.open)}` : i === 1 ? `tomorrow ${fmtHHMM(h.open)}` : `${DAYS[(day + i) % 7]} ${fmtHHMM(h.open)}`;
    return { open: false, reason: 'closed', label: `Closed now · opens ${when}`, opensAt: h.open };
  }
  return { open: false, reason: 'closed', label: 'Closed' };
}

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
