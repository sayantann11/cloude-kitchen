import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import type { Order } from '../../data/types';
import { clock, dateLabel, rupees } from '../../lib/format';
import { store } from '../../state/app';
import { t } from '../../state/i18n';
import { Empty, Skeleton } from '../../ui/kit';
import { CustomerShell } from './Shell';

export const STATUS_LABEL: Record<Order['status'], string> = {
  placed: 'Waiting for kitchen', accepted: 'Being cooked', ready: 'Packed', out: 'Out for delivery',
  delivered: 'Delivered', cancelled: 'Cancelled', rejected: 'Not accepted',
};
const tone = (s: Order['status']) => (s === 'delivered' ? 'good' : s === 'cancelled' || s === 'rejected' ? 'crit' : 'warn');

export function OrdersPage() {
  const list = useSignal<Order[] | null>(null);
  useEffect(() => {
    const db = store.value;
    if (!db) return;
    let off = () => {};
    db.customerUid().then(uid => { off = db.watchMyOrders(uid, os => { list.value = os; }); });
    return () => off();
  }, [store.value]);

  return (
    <CustomerShell back={{ href: '/', label: 'Menu' }}>
      <div class="stack lg">
        <h1 style={{ fontSize: '24px' }}>{t('My orders')}</h1>
        {list.value === null ? <Skeleton /> : list.value.length === 0 ? (
          <Empty title="No orders yet">Orders you place on this phone show up here.<a class="btn primary" href="/">{t('Browse menu')}</a></Empty>
        ) : list.value.map(o => (
          <a key={o.id} href={`/order/${o.id}`} class="card tight" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div class="row between">
              <span class="row" style={{ gap: '8px' }}><span class="code">{o.code}</span><span class="muted small">{dateLabel(o.placedAt)} · {clock(o.placedAt)}</span></span>
              <span class={`chip ${tone(o.status)}`}>{STATUS_LABEL[o.status]}</span>
            </div>
            <div class="small">{o.lines.map(l => `${l.qty}× ${l.name}`).join(', ')}</div>
            <div class="row between small"><span class="muted">{o.area}</span><b class="num">{rupees(o.total)}</b></div>
          </a>
        ))}
      </div>
    </CustomerShell>
  );
}
