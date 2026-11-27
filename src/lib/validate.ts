/** Indian mobile: 10 digits starting 6-9, optional +91 / 0 prefix and spaces. Returns the 10 digits or null. */
export function normalizePhone(input: string): string | null {
  let d = input.replace(/[\s\-()]/g, '');
  if (d.startsWith('+91')) d = d.slice(3);
  else if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

export const cleanText = (s: string, max: number) => s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

export function validateCheckout(f: { name: string; phone: string; address: string }): Record<string, string> {
  const e: Record<string, string> = {};
  if (cleanText(f.name, 60).length < 2) e.name = 'Enter your name';
  if (!normalizePhone(f.phone)) e.phone = 'Enter a 10-digit mobile number';
  if (cleanText(f.address, 200).length < 8) e.address = 'Add house number and a landmark so the rider can find you';
  return e;
}

/** UPI ID like name@bank */
export const isUpiId = (s: string) => /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(s.trim());

/** 12-digit UPI transaction reference (UTR). */
export const isUtr = (s: string) => /^\d{12}$/.test(s.replace(/\s/g, ''));
