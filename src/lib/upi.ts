/**
 * UPI deep link (NPCI "upi://pay" spec). Opens GPay/PhonePe/Paytm on phones; zero gateway fee.
 * The kitchen confirms receipt manually against the UTR, because a link alone can't prove payment.
 */
export function upiLink(p: { upiId: string; name: string; amount: number; note: string; ref: string }): string {
  const q = new URLSearchParams({
    pa: p.upiId.trim(),
    pn: p.name.slice(0, 40),
    am: p.amount.toFixed(2),
    cu: 'INR',
    tn: p.note.slice(0, 50),
    tr: p.ref.slice(0, 35),
  });
  return `upi://pay?${q.toString()}`;
}
