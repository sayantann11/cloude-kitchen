import { useComputed, useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import type { MenuItem, Order } from '../../data/types';
import { rupees } from '../../lib/format';
import { LOW_STOCK, maxQty, quote, sellable, stockLeft } from '../../lib/pricing';
import { cart, cartCount, lang, menu, notify, open, setQty, settings, store, vegOnly } from '../../state/app';
import { t } from '../../state/i18n';

import { IcSearch } from '../../ui/icons';
import { Stepper, VegMark } from '../../ui/kit';
import { preloadMap } from '../../ui/MapView';
import { CustomerShell } from './Shell';

export function MenuPage() {
  const q = useSignal('');
  const active = useSignal(menu.value.categories[0] ?? '');
  const last = useSignal<Order | null>(null);
  const s = settings.value;
  const st = open.value;

  // "Order again" shortcut from the last delivered order
  useEffect(() => {
    const db = store.value;
    if (!db) return;
    let off = () => {};
    db.customerUid().then(uid => { off = db.watchMyOrders(uid, os => { last.value = os.find(o => o.status === 'delivered') ?? null; }); });
    return () => off();
  }, [store.value]);

  const sections = useComputed(() => {
    const term = q.value.trim().toLowerCase();
    const m = menu.value;
    return m.categories.map(cat => ({
      cat,
      items: m.items.filter(i => i.category === cat && !i.hidden && (!vegOnly.value || i.veg) && (!term || `${i.name} ${i.nameOr ?? ''} ${i.desc} ${i.tag ?? ''}`.toLowerCase().includes(term))),
    })).filter(sec => sec.items.length);
  });

  // Scroll-spy: highlight the category in view
  const lock = useRef(0);
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.menu-sec'));
    if (!('IntersectionObserver' in window) || !els.length) return;
    const io = new IntersectionObserver(entries => {
      if (Date.now() < lock.current) return;
      const vis = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (vis) active.value = (vis.target as HTMLElement).dataset.cat ?? active.value;
    }, { rootMargin: '-170px 0px -55% 0px' });
    els.forEach(e => io.observe(e));
    return () => io.disconnect();
  }, [sections.value.map(x => x.cat).join('|')]);

  const jump = (cat: string) => {
    active.value = cat;
    lock.current = Date.now() + 800;
    document.getElementById(`cat-${slug(cat)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const qt = quote(cart.value, menu.value.items, s, null);
  const allVeg = menu.value.items.every(i => i.hidden || i.veg);
  const reorder = () => {
    const o = last.value;
    if (!o) return;
    const avail = new Set(menu.value.items.filter(sellable).map(i => i.id));
    const next = { ...cart.value };
    let skipped = 0;
    for (const l of o.lines) {
      const it = menu.value.items.find(i => i.id === l.id);
      if (it && avail.has(l.id)) next[l.id] = Math.min(maxQty(it), (next[l.id] ?? 0) + l.qty); else skipped++;
    }
    cart.value = next;
    notify(skipped ? `Added to cart. ${skipped} item(s) are sold out today.` : 'Added your last order to the cart');
  };

  return (
    <CustomerShell>
      <div class="stack lg">
        <section class="hero">
          <h1>{s.tagline}</h1>
          <div class="row">
            {allVeg && <span class="chip good"><span class="vmark" aria-hidden="true" />Pure veg</span>}
            {st.open ? <span class="chip good"><span class="dot" />{st.label}</span> : <span class="chip warn">{st.label}</span>}
            <span class="chip">{s.promiseMin - 15}–{s.promiseMin} min</span>
            {s.freeDeliveryAbove > 0 && <span class="chip">{t('Free delivery')} above {rupees(s.freeDeliveryAbove)}</span>}
          </div>
        </section>

        {!st.open && (
          <div class={`banner ${st.reason === 'paused' ? 'crit' : 'warn'}`} role="status">
            <div><b>{st.reason === 'paused' ? 'Not taking orders right now' : 'We are closed'}</b>{st.label}. You can still look at the menu.</div>
          </div>
        )}

        {last.value && (
          <div class="card tight">
            <div class="row between">
              <div class="grow small"><b>Your last order</b><div class="muted">{last.value.lines.map(l => `${l.qty}× ${l.name}`).join(', ')}</div></div>
              <button type="button" class="btn ghost small" onClick={reorder}>{t('Order again')}</button>
            </div>
          </div>
        )}

        <div class="toolbar">
          <div class="search">
            <IcSearch />
            <input type="search" id="menu-search" placeholder={t('Search dishes')} aria-label={t('Search dishes')} value={q.value} onInput={e => { q.value = (e.target as HTMLInputElement).value; }} autocomplete="off" />
            {q.value && <button type="button" class="clear" onClick={() => { q.value = ''; }} aria-label="Clear search">×</button>}
          </div>
          <div class="cats" role="group" aria-label="Menu categories">
            {!allVeg && <button type="button" class="vegtoggle" aria-pressed={vegOnly.value} onClick={() => { vegOnly.value = !vegOnly.value; }}><span class="vmark" aria-hidden="true" /> {t('Veg only')}</button>}
            {sections.value.map(sec => (
              <button key={sec.cat} type="button" aria-pressed={active.value === sec.cat} onClick={() => jump(sec.cat)}>{sec.cat}</button>
            ))}
          </div>
        </div>

        {sections.value.length === 0 && (
          <div class="empty"><b>No dishes match “{q.value}”</b><button type="button" class="linkbtn" onClick={() => { q.value = ''; vegOnly.value = false; }}>Show full menu</button></div>
        )}

        {sections.value.map(sec => (
          <section key={sec.cat} class="menu-sec" id={`cat-${slug(sec.cat)}`} data-cat={sec.cat} aria-labelledby={`h-${slug(sec.cat)}`}>
            <h2 id={`h-${slug(sec.cat)}`}>{sec.cat} <small>{sec.items.length}</small></h2>
            {sec.items.map(i => <ItemCard key={i.id} item={i} />)}
          </section>
        ))}
      </div>

      {cartCount.value > 0 && (
        <div class="bottombar">
          <a class="cartbar" href="/checkout" onPointerEnter={preloadMap} onTouchStart={preloadMap}>
            <span>
              {cartCount.value} {t('items')} · {rupees(qt.subtotal)}
              {qt.freeDeliveryGap > 0 && qt.freeDeliveryGap < 150 ? <small>Add {rupees(qt.freeDeliveryGap)} more for free delivery</small> : null}
            </span>
            <span>{t('View cart')} →</span>
          </a>
        </div>
      )}
    </CustomerShell>
  );
}

function ItemCard({ item: i }: { item: MenuItem }) {
  const qty = cart.value[i.id] ?? 0;
  const ok = sellable(i);
  const left = stockLeft(i);
  const offer = i.oldPrice && i.oldPrice > i.price ? i.oldPrice : 0;
  const action = !ok ? <span class="chip">{t('Sold out')}</span>
    : qty ? <Stepper qty={qty} label={i.name} max={maxQty(i)} onChange={n => setQty(i.id, n)} />
    : <button type="button" class="add" onClick={() => setQty(i.id, 1)} aria-label={`${t('Add')} ${i.name}`}>{t('Add').toUpperCase()}</button>;
  return (
    <div class={`item ${ok ? '' : 'off'} ${i.imageUrl ? 'has-img' : ''}`}>
      <div>
        <h3><VegMark veg={i.veg} /><span class="nm">{i.name}</span>{i.tag && <span class="tag">{i.tag}</span>}</h3>
        {lang.value === 'or' && i.nameOr && <div class="or">{i.nameOr}</div>}
        {i.desc && <p>{i.desc}</p>}
        <span class="price">{rupees(i.price)}</span>
        {offer > 0 && <> <s class="was">{rupees(offer)}</s> <span class="off-pct">{Math.round((1 - i.price / offer) * 100)}% off</span></>}
        {ok && left !== null && left <= LOW_STOCK && <span class="few">Only {left} left</span>}
      </div>
      {i.imageUrl ? (
        <div class="item-media"><img src={i.imageUrl} alt="" loading="lazy" decoding="async" width={96} height={96} />{action}</div>
      ) : action}
    </div>
  );
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

