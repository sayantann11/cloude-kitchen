import { useSignal } from '@preact/signals';
import type { Order } from '../../data/types';
import { googleMapsPin } from '../../lib/engine';
import { ago, clock, km1, prettyPhone, rupees } from '../../lib/format';
import { errMsg, notify, now, settings, store } from '../../state/app';
import { IcNav, IcPhone } from '../../ui/icons';
import { Btn, Sheet, VegMark } from '../../ui/kit';
import { STATUS_LABEL } from '../customer/Orders';
import { kTrips } from './kstate';

export const PAY_LABEL: Record<Order['pay'], string> = { cod: 'Cash on delivery', upi_on_delivery: 'UPI on delivery', upi_now: 'UPI (pay now)' };
const REJECT = ['Item finished', 'Kitchen too busy', 'Too far to deliver', 'Fake / test order', 'Customer not reachable'];
export const PREP = [10, 15, 20, 30, 40];

export const defaultCollect = (o: Pick<Order, 'pay' | 'payState'>): 'cash' | 'upi' | 'prepaid' =>
  o.pay === 'upi_now' && o.payState !== 'pending' ? 'prepaid' : o.pay === 'cod' ? 'cash' : 'upi';

export async function act(fn: () => Promise<void>, ok?: string) {
  try { await fn(); if (ok) notify(ok); } catch (e) { notify(errMsg(e), 'err'); }
}

export function accept(o: Order, prepMin: number) {
  const t = Date.now();
  // Promise can't be earlier than prep + travel; keep the customer's promise unless prep pushes it later.
  return act(() => store.value!.updateOrder(o.id, { status: 'accepted', acceptedAt: t, prepMin }), `Accepted ${o.code}`);
}
export const markReady = (o: Order) => act(() => store.value!.updateOrder(o.id, { status: 'ready', readyAt: Date.now() }), `${o.code} packed`);

export function printKot(o: Order) {
  const root = document.getElementById('print-root');
  if (!root) return;
  const esc = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
  root.innerHTML = `<h1>${esc(settings.value.kitchenName)}</h1><div>KOT ${o.code} · ${clock(o.placedAt)}</div><hr>` +
    o.lines.map(l => `<div><b>${l.qty} ×</b> ${esc(l.name)}</div>`).join('') +
    (o.note ? `<hr><div><b>Note:</b> ${esc(o.note)}</div>` : '') +
    `<hr><div>${esc(o.name)} · ${prettyPhone(o.phone)}</div><div>${esc(o.address)}</div><div>${esc(o.area)}</div><hr><div><b>${rupees(o.total)}</b> · ${PAY_LABEL[o.pay]}</div>`;
  window.print();
}

export function OrderSheet({ order: o, onClose }: { order: Order | null; onClose: () => void }) {
  const prep = useSignal(PREP.reduce((a, b) => (Math.abs(b - settings.value.prepMin) < Math.abs(a - settings.value.prepMin) ? b : a)));
  const rejecting = useSignal(false);
  if (!o) return null;
  const db = store.value!;
  const lateBy = Math.round((now.value - o.promiseAt) / 60_000);
  return (
    <Sheet open={!!o} onClose={() => { rejecting.value = false; onClose(); }} title={`Order ${o.code}`} wide>
      <div class="row">
        <span class={`chip ${o.status === 'placed' ? 'warn' : o.status === 'delivered' ? 'good' : o.status === 'cancelled' || o.status === 'rejected' ? 'crit' : 'brand'}`}>{STATUS_LABEL[o.status]}</span>
        <span class="chip">Placed {clock(o.placedAt)} · {ago(o.placedAt, now.value)}</span>
        <span class={`chip ${lateBy > 0 && !['delivered', 'cancelled', 'rejected'].includes(o.status) ? 'crit' : ''}`}>Promise {clock(o.promiseAt)}</span>
      </div>

      <div class="card tight">
        <div class="lines">
          {o.lines.map(l => <div class="line" key={l.id}><span class="row" style={{ gap: '8px' }}><VegMark veg={l.veg} /><b>{l.qty}×</b> {l.name}</span><span class="num">{rupees(l.qty * l.price)}</span></div>)}
          <div class="line muted"><span>Delivery</span><span class="num">{rupees(o.deliveryFee)}</span></div>
          <div class="line total"><span>{PAY_LABEL[o.pay]}{o.payState === 'paid' ? ' · paid' : o.payState === 'claimed' ? ' · customer says paid' : ''}</span><span class="num">{rupees(o.total)}</span></div>
        </div>
        {o.note && <div class="banner warn"><div><b>Cooking note</b>{o.note}</div></div>}
        {o.utr && <div class="small">UPI ref: <b style={{ userSelect: 'all' }}>{o.utr}</b></div>}
      </div>

      <div class="card tight">
        <b>{o.name}</b>
        <div class="small">{o.address}</div>
        <div class="small muted">Near {o.area} · {km1(o.roadKm)} km by road</div>
        <div class="row">
          <a class="btn ghost small" href={`tel:+91${o.phone}`}><IcPhone /> {prettyPhone(o.phone)}</a>
          <a class="btn ghost small" href={googleMapsPin(o.location)} target="_blank" rel="noopener"><IcNav /> Open pin</a>
          <a class="btn ghost small" href={`https://wa.me/91${o.phone}`} target="_blank" rel="noopener">WhatsApp</a>
        </div>
      </div>

      {o.status === 'placed' && !rejecting.value && (
        <div class="stack">
          <div class="small"><b>Ready in</b></div>
          <div class="segtabs" role="group" aria-label="Preparation time">
            {PREP.map(m => <button key={m} type="button" aria-pressed={prep.value === m} onClick={() => { prep.value = m; }}>{m} min</button>)}
          </div>
          <div class="grid2">
            <Btn variant="danger" onClick={() => { rejecting.value = true; }}>Reject</Btn>
            <Btn onClick={async () => { await accept(o, prep.value); onClose(); }}>Accept order</Btn>
          </div>
        </div>
      )}
      {rejecting.value && (
        <div class="stack">
          <b>Why can't you take it? The customer sees this.</b>
          {REJECT.map(r => <Btn key={r} variant="ghost" block onClick={async () => { await act(() => db.updateOrder(o.id, { status: 'rejected', reason: r, cancelledAt: Date.now() }), 'Order rejected'); rejecting.value = false; onClose(); }}>{r}</Btn>)}
          <Btn variant="quiet" onClick={() => { rejecting.value = false; }}>Back</Btn>
        </div>
      )}
      {o.status === 'accepted' && <Btn onClick={async () => { await markReady(o); onClose(); }}>Mark packed</Btn>}
      {o.status === 'out' && <div class="banner info"><div><b>On the way{o.riderName ? ` with ${o.riderName}` : ''}</b>Left {o.outAt ? clock(o.outAt) : ''}. Mark delivered from Trips.</div></div>}

      <div class="row">
        <Btn variant="ghost" small onClick={() => printKot(o)}>Print KOT</Btn>
        {o.payState !== 'paid' && o.status !== 'cancelled' && o.status !== 'rejected' && (
          <Btn variant="ghost" small onClick={() => act(() => db.updateOrder(o.id, { payState: 'paid' }), 'Marked paid')}>Mark paid</Btn>
        )}
        {(o.status === 'accepted' || o.status === 'ready') && (
          <Btn variant="danger" small onClick={async () => { await act(() => db.updateOrder(o.id, { status: 'cancelled', reason: 'Cancelled by kitchen', cancelledAt: Date.now() }), 'Order cancelled'); onClose(); }}>Cancel order</Btn>
        )}
        {o.status === 'out' && (
          <Btn variant="ghost" small onClick={async () => {
            const trip = kTrips.value.find(t => t.id === o.tripId);
            await act(() => (trip ? db.completeStop(trip, o.id, defaultCollect(o)) : db.updateOrder(o.id, { status: 'delivered', deliveredAt: Date.now() })), 'Marked delivered');
            onClose();
          }}>Mark delivered</Btn>
        )}
      </div>
    </Sheet>
  );
}
