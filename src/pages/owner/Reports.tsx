import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import type { Order } from '../../data/types';
import { clock, dateLabel, istDay, km1, rupees } from '../../lib/format';
import { istParts } from '../../lib/hours';
import { store } from '../../state/app';
import { Btn, Empty, Skeleton } from '../../ui/kit';
import { STATUS_LABEL } from '../customer/Orders';

const RANGES = [{ k: 1, label: 'Today' }, { k: 7, label: '7 days' }, { k: 30, label: '30 days' }];

export function Reports() {
  const days = useSignal(1);
  const orders = useSignal<Order[] | null>(null);
  useEffect(() => {
    const db = store.value!;
    const start = startOfIstDay(Date.now()) - (days.value - 1) * 86_400_000;
    orders.value = null;
    return db.watchOrdersSince(start, os => { orders.value = os; });
  }, [days.value]);

  const os = orders.value;
  return (
    <div class="stack lg">
      <div class="row between">
        <h2 style={{ fontSize: '20px' }}>Reports</h2>
        <div class="segtabs" role="group" aria-label="Date range" style={{ minWidth: '260px' }}>
          {RANGES.map(r => <button key={r.k} type="button" aria-pressed={days.value === r.k} onClick={() => { days.value = r.k; }}>{r.label}</button>)}
        </div>
      </div>
      {os === null ? <Skeleton /> : os.length === 0 ? <Empty title="No orders in this period" /> : <ReportBody os={os} />}
    </div>
  );
}

function ReportBody({ os }: { os: Order[] }) {
  const done = os.filter(o => o.status === 'delivered');
  const lost = os.filter(o => o.status === 'cancelled' || o.status === 'rejected');
  const sales = done.reduce((a, o) => a + o.total, 0);
  const cash = done.filter(o => o.pay === 'cod').reduce((a, o) => a + o.total, 0);
  const upi = sales - cash;
  const saved = os.reduce((a, o) => a + (o.kmSaved ?? 0), 0);
  const onTime = done.filter(o => o.deliveredAt && o.deliveredAt <= o.promiseAt).length;
  const items = new Map<string, { name: string; qty: number; amt: number }>();
  for (const o of done) for (const l of o.lines) {
    const x = items.get(l.id) ?? { name: l.name, qty: 0, amt: 0 };
    x.qty += l.qty; x.amt += l.qty * l.price; items.set(l.id, x);
  }
  const top = [...items.values()].sort((a, b) => b.qty - a.qty).slice(0, 10);
  const byHour = Array.from({ length: 24 }, () => 0);
  for (const o of os) byHour[istParts(o.placedAt).minutes / 60 | 0]++;
  const maxH = Math.max(1, ...byHour);
  const areas = new Map<string, number>();
  for (const o of done) areas.set(o.area, (areas.get(o.area) ?? 0) + 1);

  return (
    <>
      <div class="kpis">
        <div class="kpi"><small>Delivered orders</small><b>{done.length}<em>of {os.length}</em></b></div>
        <div class="kpi"><small>Sales (delivered)</small><b>{rupees(sales)}</b></div>
        <div class="kpi"><small>Average order</small><b>{rupees(done.length ? sales / done.length : 0)}</b></div>
        <div class="kpi good"><small>Km saved by grouping</small><b>{km1(saved)}<em>km</em></b></div>
        <div class="kpi"><small>Cash</small><b>{rupees(cash)}</b></div>
        <div class="kpi"><small>UPI</small><b>{rupees(upi)}</b></div>
        <div class="kpi"><small>On time</small><b>{done.length ? Math.round((onTime / done.length) * 100) : 0}<em>%</em></b></div>
        <div class="kpi"><small>Cancelled / rejected</small><b>{lost.length}</b></div>
      </div>

      <section class="card">
        <h2>Orders by hour</h2>
        <div class="bars" role="img" aria-label="Orders placed per hour of day">
          {byHour.map((n, h) => <div key={h} class={n ? '' : 'zero'} style={{ height: `${(n / maxH) * 100}%` }} title={`${h}:00 · ${n} orders`} />)}
        </div>
        <div class="bars-x" aria-hidden="true">{byHour.map((_, h) => <span key={h}>{h % 3 === 0 ? (h % 12 || 12) + (h < 12 ? 'a' : 'p') : ''}</span>)}</div>
      </section>

      <div class="grid2">
        <section class="card">
          <h2>Top dishes</h2>
          <div class="scroll-x"><table class="table"><thead><tr><th>Dish</th><th class="r">Qty</th><th class="r">Sales</th></tr></thead>
            <tbody>{top.length === 0 && <tr><td colSpan={3} class="muted">Shows after the first delivered order</td></tr>}{top.map(t => <tr key={t.name}><td>{t.name}</td><td class="r">{t.qty}</td><td class="r">{rupees(t.amt)}</td></tr>)}</tbody></table></div>
        </section>
        <section class="card">
          <h2>Top areas</h2>
          <div class="scroll-x"><table class="table"><thead><tr><th>Area</th><th class="r">Orders</th></tr></thead>
            <tbody>{[...areas.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([a, n]) => <tr key={a}><td>{a}</td><td class="r">{n}</td></tr>)}</tbody></table></div>
        </section>
      </div>

      <section class="card">
        <div class="row between"><h2>All orders</h2><Btn variant="ghost" small onClick={() => downloadCsv(os)}>Download CSV</Btn></div>
        <div class="scroll-x"><table class="table">
          <thead><tr><th>When</th><th>Code</th><th>Customer</th><th>Area</th><th>Status</th><th>Pay</th><th class="r">Total</th></tr></thead>
          <tbody>{os.slice(0, 200).map(o => (
            <tr key={o.id}><td>{dateLabel(o.placedAt)} {clock(o.placedAt)}</td><td><span class="code">{o.code}</span></td><td>{o.name}</td><td>{o.area}</td><td>{STATUS_LABEL[o.status]}</td><td>{o.pay === 'cod' ? 'Cash' : 'UPI'}</td><td class="r">{rupees(o.total)}</td></tr>
          ))}</tbody>
        </table></div>
      </section>
    </>
  );
}

function startOfIstDay(ms: number) {
  const d = istDay(ms);
  return Date.parse(`${d}T00:00:00+05:30`);
}

function downloadCsv(os: Order[]) {
  const head = ['date', 'time', 'code', 'status', 'customer', 'phone', 'area', 'items', 'subtotal', 'delivery_fee', 'total', 'payment', 'paid', 'km_saved'];
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = os.map(o => [istDay(o.placedAt), clock(o.placedAt), o.code, o.status, o.name, o.phone, o.area, o.lines.map(l => `${l.qty}x ${l.name}`).join('; '), o.subtotal, o.deliveryFee, o.total, o.pay, o.payState, (o.kmSaved ?? 0).toFixed(2)].map(q).join(','));
  const blob = new Blob(['﻿' + [head.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `orders-${istDay(Date.now())}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
