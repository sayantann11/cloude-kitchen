const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I confusion
const URLSAFE = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function rand(n: number, chars: string): string {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += chars[b % chars.length];
  return s;
}

/** Firestore-style document id (20 chars, ~119 bits). Unguessable: safe to use as a capability link. */
export const docId = () => rand(20, URLSAFE);
/** Short human code for an order, e.g. "K7Q2". */
export const shortCode = () => rand(4, ALPHA);
