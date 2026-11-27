export const rupees = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

export function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).replace(/\s?(am|pm)/i, (_, ap) => ' ' + ap.toLowerCase());
}

export function dateLabel(ms: number, now = Date.now()): string {
  const day = (t: number) => new Date(t + 330 * 60_000).toISOString().slice(0, 10);
  if (day(ms) === day(now)) return 'Today';
  if (day(ms) === day(now - 86_400_000)) return 'Yesterday';
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
}

export function ago(ms: number, now = Date.now()): string {
  const m = Math.floor((now - ms) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min ago`;
}

export const minsLeft = (ms: number, now = Date.now()) => Math.round((ms - now) / 60_000);
export const km1 = (k: number) => k.toFixed(1);

/** "9876543210" -> "98765 43210" */
export const prettyPhone = (p: string) => {
  const d = p.replace(/\D/g, '').slice(-10);
  return d.length === 10 ? `${d.slice(0, 5)} ${d.slice(5)}` : p;
};

/** IST calendar day key, e.g. "2026-11-27". */
export const istDay = (ms: number) => new Date(ms + 330 * 60_000).toISOString().slice(0, 10);
