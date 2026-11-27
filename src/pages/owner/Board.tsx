import { useSignal } from '@preact/signals';
import type { Order, Rider, Trip } from '../../data/types';
import { googleMapsRoute, planRoute, type Batch, type Route } from '../../lib/engine';
import { ago, clock, km1, rupees } from '../../lib/format';
import { docId } from '../../lib/ids';
import { errMsg, notify, now, settings, store } from '../../state/app';
import { navigate } from '../../state/router';
import { Btn, copyText, Empty, Sheet, Skeleton, Switch } from '../../ui/kit';
import { MapView } from '../../ui/MapView';
import { batches, cooking, kOrders, placed, readyAt, today, toggleWake, toPlan, wakeOn, type KPlan } from './kstate';
import { accept, markReady, OrderSheet, PREP } from './OrderSheet';

export function Board() {
  const tab = useSignal<'new' | 'kitchen' | 'send'>('new');
  const openId = useSignal<string | null>(null);
  const routeOf = useSignal<Batch<KPlan> | null>(null);
  const sendOf = useSignal<Batch<KPlan> | null>(null);

  if (kOrders.value === null) return <Skeleton lines={4} />;
  const s = settings.value;
  const t = today.value;
  const live = t.filter(o => o.status !== 'cancelled' && o.status !== 'rejected');
  const revenue = live.reduce((a, o) => a + o.total, 0);
  const saved = t.reduce((a, o) => a + (o.kmSaved ?? 0), 0);
  const bs = batches.value;
  const openOrder = (kOrders.value ?? []).find(o => o.id === openId.value) ?? null;
  const multi = bs.filter(b => b.orders.length > 1).length;

  return (
    <div class="stack lg">
      {'wakeLock' in navigator && (
        <div class="row between small">
          <span class="muted">Keep this screen on during service so new orders always ring.</span>
          <Switch id="wake" checked={wakeOn.value} onChange={() => { void toggleWake(); }} label="Keep screen on" />
        </div>
      )}
      <div class="kpis">
        <div class="kpi"><small>Orders today</small><b>{live.length}</b></div>
        <div class="kpi"><small>Sales today</small><b>{rupees(revenue)}</b></div>
        <div class="kpi"><small>Waiting to send</small><b>{cooking.value.length}<em>in {bs.length} trip{bs.length === 1 ? '' : 's'}</em></b></div>
        <div class="kpi good"><small>Saved by grouping today</small><b>{km1(saved)}<em>km</em></b></div>
      </div>

      <div class="segtabs board-tabs" role="group" aria-label="Board section">
        <button type="button" aria-pressed={tab.value === 'new'} onClick={() => { tab.value = 'new'; }}>New{placed.value.length ? <span class="count">{placed.value.length}</span> : null}</button>
        <button type="button" aria-pressed={tab.value === 'kitchen'} onClick={() => { tab.value = 'kitchen'; }}>Cooking ({cooking.value.length})</button>
        <button type="button" aria-pressed={tab.value === 'send'} onClick={() => { tab.value = 'send'; }}>Send out ({bs.length})</button>
      </div>

      <div class="board">
        <section class="stack" hidden={tab.value !== 'new'} aria-labelledby="h-new">
          <div class="col-h"><h2 id="h-new">New orders <span class="n">{placed.value.length}</span></h2></div>
          {placed.value.length === 0 ? <Empty title="No new orders">{s.paused ? 'Orders are paused. Switch on "Taking orders" at the top.' : 'New orders ring here.'}</Empty>
            : placed.value.map(o => <NewCard key={o.id} o={o} onOpen={() => { openId.value = o.id; }} />)}
        </section>

        <section class="stack" hidden={tab.value !== 'kitchen'} aria-labelledby="h-cook">
          <div class="col-h"><h2 id="h-cook">Cooking <span class="n">{cooking.value.length}</span></h2></div>
          {cooking.value.length === 0 ? <Empty title="Nothing cooking" /> : cooking.value.map(o => <CookCard key={o.id} o={o} onOpen={() => { openId.value = o.id; }} />)}
        </section>

        <section class="stack" hidden={tab.value !== 'send'} aria-labelledby="h-send">
          <div class="col-h"><h2 id="h-send">Send out <span class="n">{multi} grouped</span></h2><small class="muted">Window {s.batchWindowMin} min · max {s.maxPerTrip}/rider</small></div>
          {bs.length === 0 ? <Empty title="Nothing to send">Accepted orders are grouped into rider trips here.</Empty>
            : bs.map(b => <BatchCard key={b.key} b={b} onRoute={() => { routeOf.value = b; }} onSend={() => { sendOf.value = b; }} onOpen={id => { openId.value = id; }} />)}
        </section>
      </div>

      <OrderSheet order={openOrder} onClose={() => { openId.value = null; }} />
      <RouteSheet b={routeOf.value} onClose={() => { routeOf.value = null; }} onSend={() => { sendOf.value = routeOf.value; routeOf.value = null; }} />
      <DispatchSheet b={sendOf.value} onClose={() => { sendOf.value = null; }} />
    </div>
  );
}

function Lines({ o }: { o: Order }) {
  return <div class="olines">{o.lines.map(l => <span key={l.id}><b>{l.qty}×</b> {l.name}</span>)}{o.note && <span style={{ color: 'var(--warn)' }}>Note: {o.note}</span>}</div>;
}

function NewCard({ o, onOpen }: { o: Order; onOpen: () => void }) {
  const prep = useSignal(nearestPrep(settings.value.prepMin));
  return (
    <article class="ocard new">
      <div class="ocard-h">
        <div><b>{o.name}</b> <span class="code">{o.code}</span><div class="meta"><span>{o.area} · {km1(o.roadKm)} km</span><span>{ago(o.placedAt, now.value)}</span></div></div>
        <b class="num">{rupees(o.total)}</b>
      </div>
      <Lines o={o} />
      <div class="segtabs" role="group" aria-label={`Ready in, order ${o.code}`}>
        {PREP.slice(0, 4).map(m => <button key={m} type="button" aria-pressed={prep.value === m} onClick={() => { prep.value = m; }}>{m}m</button>)}
      </div>
      <div class="acts">
        <Btn variant="ghost" small onClick={onOpen}>Details</Btn>
        <Btn small onClick={() => accept(o, prep.value)} id={`accept-${o.code}`}>Accept · ready in {prep.value} min</Btn>
      </div>
    </article>
  );
}

const nearestPrep = (m: number) => PREP.slice(0, 4).reduce((a, b) => (Math.abs(b - m) < Math.abs(a - m) ? b : a));

function CookCard({ o, onOpen }: { o: Order; onOpen: () => void }) {
  const ready = o.status === 'ready';
  const dueIn = Math.round((readyAt(o) - now.value) / 60_000);
  const late = now.value > o.promiseAt;
  return (
    <article class={`ocard ${late ? 'late' : ready ? 'ready' : 'cooking'}`}>
      <div class="ocard-h">
        <div><b>{o.name}</b> <span class="code">{o.code}</span>
          <div class="meta"><span>{o.area}</span><span class={late ? 'late-t' : ''}>Promise {clock(o.promiseAt)}</span></div>
        </div>
        {ready ? <span class="chip good">Packed</span> : <span class={`chip ${dueIn < 0 ? 'crit' : ''}`}>{dueIn >= 0 ? `Ready in ${dueIn} min` : `${-dueIn} min over`}</span>}
      </div>
      <Lines o={o} />
      <div class="acts">
        <Btn variant="ghost" small onClick={onOpen}>Details</Btn>
        {!ready && <Btn small onClick={() => markReady(o)} id={`ready-${o.code}`}>Mark packed</Btn>}
      </div>
    </article>
  );
}

function BatchCard({ b, onRoute, onSend, onOpen }: { b: Batch<KPlan>; onRoute: () => void; onSend: () => void; onOpen: (id: string) => void }) {
  const r = b.route;
  const many = b.orders.length > 1;
  const waiting = b.orders.filter(p => p.order.status !== 'ready');
  return (
    <article class={`batch ${many ? '' : 'solo'}`} data-testid="batch">
      <div class="row between">
        <b>{many ? `${b.orders.length} orders, one trip` : 'Single order'}</b>
        {many ? <span class="chip good">Saves {km1(r.savedKm)} km · ~{Math.round(r.savedMin)} min</span> : <span class="chip">{b.why}</span>}
      </div>
      <div class="stack" style={{ gap: '6px' }}>
        {r.stops.map((p, i) => (
          <button type="button" key={p.id} class="stop" style={{ border: 0, background: 'none', padding: 0, textAlign: 'left' }} onClick={() => onOpen(p.id)}>
            <span class="n">{i + 1}</span>
            <span><b>{p.order.name}</b> <span class="code">{p.order.code}</span><div class="addr">{p.order.area} · {p.order.lines.reduce((a, l) => a + l.qty, 0)} items · {rupees(p.order.total)}</div></span>
            <span class="t">{clock(r.legs[i].eta)}<small class={r.legs[i].late > 0 ? 'late-t' : 'ok'}>{r.legs[i].late > 0 ? `${Math.ceil(r.legs[i].late)} min late` : 'on time'}</small></span>
          </button>
        ))}
      </div>
      <div class="save">
        <span>Leaves <b>{clock(r.departAt)}</b></span><span>Route <b>{km1(r.totalKm)} km</b></span>
        {many && <span>Alone <b>{km1(r.soloKm)} km</b></span>}
        <span class={r.onTime ? 'ok' : 'late-t'}>{r.onTime ? 'Everyone on time' : `Late by ${Math.ceil(r.lateMin)} min`}</span>
      </div>
      {waiting.length > 0 && <div class="small muted">Waiting for {waiting.map(w => w.order.code).join(', ')} to be packed</div>}
      <div class="acts">
        <Btn variant="ghost" small onClick={onRoute}>View route</Btn>
        <Btn small onClick={onSend}>{many ? 'Send together' : 'Send now'}</Btn>
      </div>
    </article>
  );
}

function RouteSheet({ b, onClose, onSend }: { b: Batch<KPlan> | null; onClose: () => void; onSend: () => void }) {
  if (!b) return null;
  const s = settings.value;
  const r = b.route;
  return (
    <Sheet open onClose={onClose} title={`Best route · ${r.stops.length} stop${r.stops.length > 1 ? 's' : ''}`} wide>
      <MapView kitchen={s.location} points={r.stops.map((p, i) => ({ ...p.location, label: String(i + 1), title: `${i + 1}. ${p.order.name}` }))} route={[s.location, ...r.stops.map(p => p.location), s.location]} height={280} ariaLabel="Route map" />
      <RouteLegs r={r} />
      <div class="grid2">
        <a class="btn ghost" href={googleMapsRoute(s.location, r.stops.map(p => p.location))} target="_blank" rel="noopener">Open in Google Maps</a>
        <Btn onClick={onSend}>Send this trip</Btn>
      </div>
    </Sheet>
  );
}

export function RouteLegs({ r }: { r: Route<KPlan> }) {
  return (
    <div class="stack" style={{ gap: '10px' }}>
      <div class="stop"><span class="n k">K</span><span><b>Leave kitchen</b></span><span class="t">{clock(r.departAt)}</span></div>
      {r.legs.map((l, i) => (
        <div class="stop" key={l.order.id}>
          <span class="n">{i + 1}</span>
          <span><b>{l.order.order.name}</b> <span class="code">{l.order.order.code}</span><div class="addr">{l.order.order.address}</div></span>
          <span class="t">{clock(l.eta)}<small>{km1(l.km)} km</small><small class={l.late > 0 ? 'late-t' : 'ok'}>by {clock(l.order.promiseAt)}</small></span>
        </div>
      ))}
      <div class="stop"><span class="n ret">↩</span><span><b>Back to kitchen</b><div class="addr">{km1(r.backKm)} km</div></span><span class="t">{clock(r.returnAt)}</span></div>
    </div>
  );
}

function DispatchSheet({ b, onClose }: { b: Batch<KPlan> | null; onClose: () => void }) {
  const s = settings.value;
  const riderId = useSignal<string>('');
  const busy = useSignal(false);
  const sent = useSignal<Trip | null>(null);
  if (!b && !sent.value) return null;
  const riders: Rider[] = s.riders.length ? s.riders : [{ id: 'self', name: 'Owner', phone: s.phone }];
  const rider = riders.find(r => r.id === riderId.value) ?? riders[0];
  const close = () => { sent.value = null; onClose(); };

  const send = async () => {
    if (!b) return;
    busy.value = true;
    try {
      const t0 = Date.now();
      // Re-plan from *now*: the rider is leaving now with food in hand.
      const r = planRoute(b.orders.map(p => toPlan(p.order)).map(p => ({ ...p, readyAt: t0 })), s.location, t0);
      const trip: Trip = {
        id: docId() + docId().slice(0, 4), riderId: rider.id, riderName: rider.name, riderPhone: rider.phone,
        stops: r.legs.map(l => ({
          orderId: l.order.id, code: l.order.order.code, name: l.order.order.name, phone: l.order.order.phone,
          address: l.order.order.address, area: l.order.order.area, location: l.order.location, total: l.order.order.total,
          pay: l.order.order.pay, payState: l.order.order.payState, eta: Math.round(l.eta), promiseAt: l.order.promiseAt, done: false,
        })),
        km: Math.round(r.totalKm * 10) / 10, soloKm: Math.round(r.soloKm * 10) / 10, departAt: t0, returnAt: Math.round(r.returnAt),
        status: 'active', createdAt: t0, updatedAt: t0,
      };
      await store.value!.dispatchTrip(trip);
      sent.value = trip;
    } catch (e) { notify(errMsg(e), 'err'); } finally { busy.value = false; }
  };

  if (sent.value) return <TripShare trip={sent.value} onClose={close} />;
  return (
    <Sheet open onClose={close} title="Send with which rider?">
      <div class="choice">
        {riders.map(r => (
          <label key={r.id} for={`rider-${r.id}`}><input id={`rider-${r.id}`} type="radio" name="rider" checked={rider.id === r.id} onChange={() => { riderId.value = r.id; }} /><span>{r.name}<small>{r.phone}</small></span></label>
        ))}
      </div>
      <a href="/admin/settings" class="linkbtn small" onClick={() => onClose()}>Add or edit riders</a>
      <Btn block busy={busy.value} onClick={send} id="confirm-send">Send {b!.orders.length} order{b!.orders.length > 1 ? 's' : ''} now</Btn>
    </Sheet>
  );
}

export function riderLink(t: Trip) { return `${location.origin}/rider/${t.id}`; }
export function riderMessage(t: Trip, kitchen: string) {
  return `${kitchen}: new trip (${t.stops.length} stop${t.stops.length > 1 ? 's' : ''}).\nOpen your stop list: ${riderLink(t)}\n` +
    t.stops.map((s, i) => `${i + 1}. ${s.name} · ${s.area} · ${s.pay === 'cod' ? `collect cash ₹${s.total}` : s.pay === 'upi_on_delivery' ? `collect UPI ₹${s.total}` : 'prepaid'}`).join('\n');
}

export function TripShare({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const s = settings.value;
  const msg = riderMessage(trip, s.kitchenName);
  return (
    <Sheet open onClose={onClose} title="Trip sent">
      <div class="banner info"><div><b>{trip.stops.length} order{trip.stops.length > 1 ? 's' : ''} out with {trip.riderName}</b>Customers can now see their rider. Send the stop list to the rider:</div></div>
      <a class="btn primary block" href={`https://wa.me/91${trip.riderPhone}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener">Send on WhatsApp</a>
      <div class="grid2">
        <Btn variant="ghost" onClick={async () => { notify((await copyText(riderLink(trip))) ? 'Rider link copied' : 'Could not copy'); }}>Copy rider link</Btn>
        <a class="btn ghost" href={`/rider/${trip.id}`} target="_blank" rel="noopener">Open rider page</a>
      </div>
      <Btn variant="quiet" onClick={() => { onClose(); navigate('/admin/trips'); }}>See trips on the road</Btn>
    </Sheet>
  );
}
