import { logoLetter } from '../../lib/format';
import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import type { Trip, TripStop } from '../../data/types';
import { googleMapsPin, googleMapsRoute } from '../../lib/engine';
import { clock, prettyPhone, rupees } from '../../lib/format';
import { errMsg, notify, settings, store } from '../../state/app';
import { IcNav, IcPhone } from '../../ui/icons';
import { Btn, Empty, Sheet, Skeleton } from '../../ui/kit';

/** The rider opens this from the WhatsApp link. No login: the long trip id is the key. */
export function RiderTrip({ id }: { id: string }) {
  const trip = useSignal<Trip | null | undefined>(undefined);
  const confirm = useSignal<TripStop | null>(null);
  const busy = useSignal(false);
  useEffect(() => {
    const db = store.value;
    if (!db) return;
    return db.watchTrip(id, t => { trip.value = t; });
  }, [store.value, id]);

  const s = settings.value;
  const t = trip.value;
  if (t === undefined) return <main class="wrap"><Skeleton lines={4} /></main>;
  if (t === null) return <main class="wrap"><Empty title="Trip not found">Ask the kitchen to send the link again.</Empty></main>;

  const next = t.stops.find(x => !x.done);
  const left = t.stops.filter(x => !x.done);
  const cash = t.stops.filter(x => x.done && x.collected === 'cash').reduce((a, x) => a + x.total, 0);
  const toCollect = left.filter(x => x.pay !== 'upi_now' || x.payState === 'pending').reduce((a, x) => a + x.total, 0);

  const complete = async (x: TripStop, how: TripStop['collected']) => {
    busy.value = true;
    try { await store.value!.completeStop(t, x.orderId, how); confirm.value = null; notify(`${x.name} delivered`); } catch (e) { notify(errMsg(e), 'err'); } finally { busy.value = false; }
  };

  return (
    <>
      <header class="appbar"><div class="bandha" /><div class="wrap appbar-in"><span class="logo">{logoLetter(s.kitchenName)}</span><div class="grow"><b style={{ fontFamily: 'var(--f-display)' }}>Rider · {t.riderName}</b><div class="muted small">{s.kitchenName} · left {clock(t.departAt)}</div></div><a class="iconbtn" href={`tel:+91${s.phone}`} aria-label="Call kitchen"><IcPhone /></a></div></header>
      <main class="wrap">
        <div class="stack lg">
          <div class="kpis">
            <div class="kpi"><small>Stops left</small><b>{left.length}<em>of {t.stops.length}</em></b></div>
            <div class="kpi"><small>Still to collect</small><b>{rupees(toCollect)}</b></div>
            <div class="kpi"><small>Cash in hand</small><b>{rupees(cash)}</b></div>
            <div class="kpi"><small>Back by</small><b style={{ fontSize: '20px' }}>{clock(t.returnAt)}</b></div>
          </div>
          {left.length > 0 && <a class="btn primary block" href={googleMapsRoute(s.location, left.map(x => x.location))} target="_blank" rel="noopener"><IcNav /> Navigate all {left.length} stops in Google Maps</a>}
          {left.length === 0 && <div class="banner info"><div><b>All delivered. Great work!</b>Head back to the kitchen with {rupees(cash)} cash.</div></div>}
          {t.stops.map((x, i) => (
            <article key={x.orderId} class={`card ${x === next ? '' : ''}`} style={x === next ? { borderColor: 'var(--brand)', boxShadow: '0 0 0 1px var(--brand)' } : x.done ? { opacity: 0.6 } : undefined}>
              <div class="row between">
                <span class="row"><span class="mk-n" style={{ position: 'static' }}>{x.done ? '✓' : i + 1}</span><b>{x.name}</b><span class="code">{x.code}</span></span>
                {x.done ? <span class="chip good">Delivered {x.doneAt ? clock(x.doneAt) : ''}</span> : <span class="chip">by {clock(x.promiseAt)}</span>}
              </div>
              <div>{x.address}</div>
              <div class="muted small">Near {x.area}</div>
              <div class="row">
                <span class={`chip ${x.pay === 'upi_now' && x.payState !== 'pending' ? 'good' : 'warn'}`}>
                  {x.pay === 'cod' ? `Collect cash ${rupees(x.total)}` : x.pay === 'upi_on_delivery' ? `Collect UPI ${rupees(x.total)}` : x.payState === 'pending' ? `UPI not confirmed · collect ${rupees(x.total)}` : 'Already paid'}
                </span>
              </div>
              {!x.done && (
                <div class="acts">
                  <a class="btn ghost small" href={`tel:+91${x.phone}`}><IcPhone /> {prettyPhone(x.phone)}</a>
                  <a class="btn ghost small" href={googleMapsPin(x.location)} target="_blank" rel="noopener"><IcNav /> Navigate</a>
                  <Btn small onClick={() => { confirm.value = x; }} id={`deliver-${x.code}`}>Delivered</Btn>
                </div>
              )}
            </article>
          ))}
        </div>
      </main>
      <Sheet open={!!confirm.value} onClose={() => { confirm.value = null; }} title={`Delivered to ${confirm.value?.name ?? ''}?`}>
        {confirm.value && (
          <>
            <p class="muted" style={{ margin: 0 }}>How was it paid? Amount {rupees(confirm.value.total)}.</p>
            <Btn block busy={busy.value} onClick={() => complete(confirm.value!, 'cash')} id="collect-cash">Cash collected</Btn>
            <Btn block variant="ghost" busy={busy.value} onClick={() => complete(confirm.value!, 'upi')}>UPI received</Btn>
            {confirm.value.pay === 'upi_now' && <Btn block variant="ghost" busy={busy.value} onClick={() => complete(confirm.value!, 'prepaid')}>Already paid online</Btn>}
          </>
        )}
      </Sheet>
    </>
  );
}
