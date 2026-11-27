import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import type { Order } from '../../data/types';
import { clock, dateLabel, prettyPhone, rupees } from '../../lib/format';
import { upiLink } from '../../lib/upi';
import { isUtr } from '../../lib/validate';
import { cart, errMsg, menu, notify, now, settings, store } from '../../state/app';
import { t } from '../../state/i18n';
import { navigate, path } from '../../state/router';
import { IcChat, IcPhone } from '../../ui/icons';
import { Btn, Empty, Sheet, Skeleton, VegMark } from '../../ui/kit';
import { CustomerShell } from './Shell';

const STEPS: { key: Order['status'][]; label: string; sub: (o: Order) => string }[] = [
  { key: ['placed'], label: 'Order placed', sub: () => 'Waiting for the kitchen to accept' },
  { key: ['accepted'], label: 'Being cooked', sub: o => (o.prepMin ? `Ready in about ${o.prepMin} min` : 'Fresh, packed in a sealed bag') },
  { key: ['ready', 'out'], label: 'Out for delivery', sub: o => (o.status === 'out' ? 'Your rider is on the way' : 'Packed and waiting for the rider') },
  { key: ['delivered'], label: 'Delivered', sub: o => (o.deliveredAt ? `at ${clock(o.deliveredAt)}` : 'Enjoy your meal') },
];

export function TrackPage({ id }: { id: string }) {
  const order = useSignal<Order | null | undefined>(undefined);
  const cancelOpen = useSignal(false);
  const busy = useSignal(false);
  const utr = useSignal('');
  const isNew = path.value.includes('new=1');

  useEffect(() => {
    const db = store.value;
    if (!db) return;
    return db.watchOrder(id, o => { order.value = o; });
  }, [store.value, id]);

  const o = order.value;
  const s = settings.value;
  if (o === undefined) return <CustomerShell back={{ href: '/orders', label: 'My orders' }}><Skeleton lines={4} /></CustomerShell>;
  if (o === null) return <CustomerShell back={{ href: '/', label: 'Menu' }}><Empty title="Order not found">It may have been placed from another phone. <a href="/">Go to menu</a></Empty></CustomerShell>;

  const idx = STEPS.findIndex(st => st.key.includes(o.status));
  const ended = o.status === 'cancelled' || o.status === 'rejected';
  const eta = o.status === 'delivered' ? null : o.promiseAt;
  const late = eta != null && now.value > eta && !ended;

  const cancel = async (reason: string) => {
    busy.value = true;
    try { await store.value!.cancelOrder(o.id, reason); cancelOpen.value = false; notify('Order cancelled'); } catch (e) { notify(errMsg(e), 'err'); } finally { busy.value = false; }
  };
  const claim = async () => {
    const v = utr.value.replace(/\s/g, '');
    if (v && !isUtr(v)) { notify('UPI reference is the 12-digit number in your payment app', 'err'); return; }
    busy.value = true;
    try { await store.value!.claimPaid(o.id, v); notify('Thanks! The kitchen will confirm your payment.'); } catch (e) { notify(errMsg(e), 'err'); } finally { busy.value = false; }
  };
  const reorder = () => {
    const avail = new Set(menu.value.items.filter(i => i.available).map(i => i.id));
    const next = { ...cart.value };
    for (const l of o.lines) if (avail.has(l.id)) next[l.id] = (next[l.id] ?? 0) + l.qty;
    cart.value = next;
    navigate('/checkout');
  };

  return (
    <CustomerShell back={{ href: '/orders', label: 'My orders' }}>
      <div class="stack lg">
        {isNew && o.status === 'placed' && <div class="banner info" role="status"><div><b>Order sent to the kitchen</b>Keep this page open. It updates by itself.</div></div>}

        <section class="card">
          <div class="row between">
            <span class="chip">Order <span class="code">{o.code}</span></span>
            <span class="muted small">{dateLabel(o.placedAt)} · {clock(o.placedAt)}</span>
          </div>
          {ended ? (
            <div>
              <div class="eta" style={{ color: 'var(--crit)' }}>{o.status === 'rejected' ? 'Kitchen could not take this order' : t('Cancelled')}</div>
              {o.reason && <p class="muted" style={{ margin: '6px 0 0' }}>{o.reason}</p>}
            </div>
          ) : o.status === 'delivered' ? (
            <div class="eta" style={{ color: 'var(--good)' }}>{t('Delivered')}. Enjoy your meal!</div>
          ) : (
            <div>
              <div class="muted small">{t('Arriving by')}</div>
              <div class="eta">{clock(eta!)}</div>
              {late && <p class="small" style={{ margin: '4px 0 0', color: 'var(--warn)' }}>Running a little late. Sorry! Call the kitchen for an update.</p>}
            </div>
          )}

          {!ended && (
            <ol class="steps" aria-label="Order progress">
              {STEPS.map((st, i) => (
                <li key={st.label} class={i < idx || o.status === 'delivered' ? 'done' : i === idx ? 'now' : ''} aria-current={i === idx ? 'step' : undefined}>
                  <div><b>{t(st.label)}</b><small>{i <= idx ? st.sub(o) : ''}</small></div>
                </li>
              ))}
            </ol>
          )}

          {o.status === 'out' && o.tripId && <RiderNote order={o} />}
        </section>

        {o.pay === 'upi_now' && o.payState !== 'paid' && !ended && s.upiId && (
          <section class="card">
            <h2>Pay {rupees(o.total)} by UPI</h2>
            {o.payState === 'claimed' ? (
              <p class="muted" style={{ margin: 0 }}>Payment marked as done{o.utr ? ` (ref ${o.utr})` : ''}. The kitchen will confirm it.</p>
            ) : (
              <>
                <a class="btn primary block" href={upiLink({ upiId: s.upiId, name: s.upiName || s.kitchenName, amount: o.total, note: `Order ${o.code}`, ref: o.code })}>Open UPI app</a>
                <p class="muted small" style={{ margin: 0 }}>Or pay to UPI ID <b style={{ userSelect: 'all' }}>{s.upiId}</b>. Then tell us below.</p>
                <div class="row">
                  <input type="text" inputMode="numeric" aria-label="UPI reference number (optional)" placeholder="12-digit UPI ref (optional)" value={utr.value} onInput={e => { utr.value = (e.target as HTMLInputElement).value; }} class="grow" style={{ flex: '1 1 180px' }} />
                  <Btn variant="ghost" onClick={claim} busy={busy.value}>I have paid</Btn>
                </div>
              </>
            )}
          </section>
        )}
        {o.payState === 'paid' && <div class="banner info"><div><b>Payment received</b>Thank you!</div></div>}

        <section class="card">
          <h2>Items</h2>
          <div class="lines">
            {o.lines.map(l => <div class="line" key={l.id}><span class="row" style={{ gap: '8px' }}><VegMark veg={l.veg} />{l.qty}× {l.name}</span><span class="num">{rupees(l.price * l.qty)}</span></div>)}
            <div class="line muted"><span>{t('Delivery fee')}</span><span class="num">{o.deliveryFee ? rupees(o.deliveryFee) : 'Free'}</span></div>
            <div class="line total"><span>Total · {o.pay === 'cod' ? 'Cash on delivery' : o.pay === 'upi_on_delivery' ? 'UPI on delivery' : 'UPI'}</span><span class="num">{rupees(o.total)}</span></div>
          </div>
          {o.note && <p class="small" style={{ margin: 0 }}><b>Note:</b> {o.note}</p>}
          <p class="small muted" style={{ margin: 0 }}>Deliver to: {o.address} (near {o.area})</p>
        </section>

        <div class="grid2">
          <a class="btn ghost" href={`tel:+91${s.phone}`}><IcPhone /> {t('Call kitchen')}</a>
          <a class="btn ghost" href={`https://wa.me/${s.whatsapp}?text=${encodeURIComponent(`Hi, about my order ${o.code}`)}`} target="_blank" rel="noopener"><IcChat /> WhatsApp</a>
        </div>
        <p class="muted small" style={{ margin: '-6px 0 0', textAlign: 'center' }}>Kitchen: {prettyPhone(s.phone)}</p>

        {o.status === 'placed' && <Btn variant="danger" onClick={() => { cancelOpen.value = true; }}>Cancel order</Btn>}
        {(o.status === 'delivered' || ended) && <Btn onClick={reorder}>{t('Order again')}</Btn>}
      </div>

      <Sheet open={cancelOpen.value} onClose={() => { cancelOpen.value = false; }} title="Cancel this order?">
        <p class="muted" style={{ margin: 0 }}>You can cancel until the kitchen accepts it. Why are you cancelling?</p>
        {['Ordered by mistake', 'Want to change items', 'Delivery time too long', 'Other reason'].map(r => (
          <Btn key={r} variant="ghost" block busy={busy.value} onClick={() => cancel(r)}>{r}</Btn>
        ))}
        <Btn variant="quiet" block onClick={() => { cancelOpen.value = false; }}>Keep my order</Btn>
      </Sheet>
    </CustomerShell>
  );
}

function RiderNote({ order: o }: { order: Order }) {
  const others = (o.tripSize ?? 1) - 1;
  return (
    <div class="banner info">
      <div class="grow">
        <b>Your rider is on the way{o.riderName ? `: ${o.riderName}` : ''}</b>
        {others > 0 ? `They are also delivering ${others} other order${others > 1 ? 's' : ''} nearby. We only group orders when everyone still gets their food on time.` : 'Coming straight to you.'}
        {o.riderPhone && <div style={{ marginTop: '8px' }}><a class="btn small ghost" href={`tel:+91${o.riderPhone}`}><IcPhone /> Call rider · {prettyPhone(o.riderPhone)}</a></div>}
      </div>
    </div>
  );
}
