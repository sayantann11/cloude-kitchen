import { useSignal } from '@preact/signals';
import type { Trip, TripStop } from '../../data/types';
import { googleMapsRoute } from '../../lib/engine';
import { clock, km1, prettyPhone, rupees } from '../../lib/format';
import { now, settings, store } from '../../state/app';
import { IcPhone } from '../../ui/icons';
import { Btn, Empty, Sheet } from '../../ui/kit';
import { MapView } from '../../ui/MapView';
import { TripShare } from './Board';
import { kTrips } from './kstate';
import { act, defaultCollect } from './OrderSheet';

export function TripsPage() {
  const share = useSignal<Trip | null>(null);
  const trips = kTrips.value;
  return (
    <div class="stack lg">
      <div class="col-h"><h2 style={{ fontSize: '20px' }}>On the road</h2><small class="muted">{trips.length} active trip{trips.length === 1 ? '' : 's'}</small></div>
      {trips.length === 0 ? <Empty title="No riders out">Trips you send from Orders → Send out appear here.</Empty>
        : trips.map(t => <TripCard key={t.id} t={t} onShare={() => { share.value = t; }} />)}
      {share.value && <TripShare trip={share.value} onClose={() => { share.value = null; }} />}
    </div>
  );
}

function TripCard({ t, onShare }: { t: Trip; onShare: () => void }) {
  const s = settings.value;
  const showMap = useSignal(false);
  const confirmEnd = useSignal(false);
  const done = t.stops.filter(x => x.done).length;
  const cash = t.stops.filter(x => x.done && x.collected === 'cash').reduce((a, x) => a + x.total, 0);
  const left = t.stops.filter(x => !x.done);
  return (
    <article class="card">
      <div class="row between">
        <div><b>{t.riderName}</b> <span class="muted small">· left {clock(t.departAt)} · back ~{clock(t.returnAt)}</span></div>
        <span class="chip brand">{done}/{t.stops.length} delivered</span>
      </div>
      <div class="stack" style={{ gap: '10px' }}>
        {t.stops.map((x, i) => <StopRow key={x.orderId} t={t} x={x} i={i} />)}
      </div>
      <div class="save"><span>Route <b>{km1(t.km)} km</b></span><span>Saved <b class="ok">{km1(Math.max(0, t.soloKm - t.km))} km</b></span><span>Cash collected <b>{rupees(cash)}</b></span></div>
      <div class="acts">
        <Btn variant="ghost" small onClick={() => { showMap.value = !showMap.value; }}>{showMap.value ? 'Hide map' : 'Map'}</Btn>
        <a class="btn ghost small" href={googleMapsRoute(s.location, left.map(x => x.location))} target="_blank" rel="noopener">Google Maps</a>
        <Btn variant="ghost" small onClick={onShare}>Send to rider</Btn>
        <a class="btn ghost small" href={`tel:+91${t.riderPhone}`}><IcPhone /> Rider</a>
        {left.length > 0 && <Btn variant="danger" small onClick={() => { confirmEnd.value = true; }}>End trip</Btn>}
      </div>
      {showMap.value && <MapView kitchen={s.location} points={t.stops.map((x, i) => ({ ...x.location, label: String(i + 1), title: x.name, tone: x.done ? 'done' : 'brand' }))} route={[s.location, ...t.stops.map(x => x.location)]} height={260} ariaLabel="Trip map" />}
      <Sheet open={confirmEnd.value} onClose={() => { confirmEnd.value = false; }} title="End this trip?">
        <p class="muted" style={{ margin: 0 }}>{left.length} stop{left.length > 1 ? 's are' : ' is'} not marked delivered. Those orders go back to “Send out” so you can resend them.</p>
        <Btn variant="danger" block onClick={async () => {
          const db = store.value!;
          await act(async () => {
            for (const x of left) await db.updateOrder(x.orderId, { status: 'ready', tripId: '', riderName: '', riderPhone: '', tripSize: 0 });
            await db.updateTrip(t.id, { status: 'done' });
          }, 'Trip ended');
          confirmEnd.value = false;
        }}>End trip</Btn>
      </Sheet>
    </article>
  );
}

function StopRow({ t, x, i }: { t: Trip; x: TripStop; i: number }) {
  const late = !x.done && now.value > x.promiseAt;
  return (
    <div class="stop">
      <span class={`n ${x.done ? 'done' : ''}`}>{x.done ? '✓' : i + 1}</span>
      <span>
        <b>{x.name}</b> <span class="code">{x.code}</span>
        <div class="addr">{x.address} · {x.area}</div>
        <div class="addr">{prettyPhone(x.phone)} · {x.pay === 'cod' ? `cash ${rupees(x.total)}` : x.pay === 'upi_on_delivery' ? `UPI ${rupees(x.total)}` : 'prepaid'}</div>
      </span>
      <span class="t">
        {x.done ? <span class="ok">Delivered {x.doneAt ? clock(x.doneAt) : ''}</span> : (
          <>
            <span class={late ? 'late-t' : ''}>ETA {clock(x.eta)}</span>
            <Btn small variant="ghost" onClick={() => act(() => store.value!.completeStop(t, x.orderId, defaultCollect(x)), `${x.code} delivered`)}>Delivered</Btn>
          </>
        )}
      </span>
    </div>
  );
}
