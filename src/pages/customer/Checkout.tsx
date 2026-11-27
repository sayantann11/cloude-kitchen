import { useSignal } from '@preact/signals';
import type { LatLng, Order, PayMethod } from '../../data/types';
import { km1, rupees } from '../../lib/format';
import { nearestPlace } from '../../lib/geo';
import { docId, shortCode } from '../../lib/ids';
import { maxQty, quote, sellable } from '../../lib/pricing';
import { cleanText, normalizePhone, validateCheckout } from '../../lib/validate';
import { cart, cookingNote, errMsg, menu, notify, open, profile, setQty, settings, store } from '../../state/app';
import { t } from '../../state/i18n';
import { navigate } from '../../state/router';
import { IcLocate } from '../../ui/icons';
import { Btn, Empty, Field, Stepper, VegMark } from '../../ui/kit';
import { MapView } from '../../ui/MapView';
import { CustomerShell } from './Shell';

export function CheckoutPage() {
  const p = profile.value;
  const name = useSignal(p.name);
  const phone = useSignal(p.phone);
  const address = useSignal(p.address);
  const loc = useSignal<LatLng | null>(p.location);
  const pay = useSignal<PayMethod>('cod');
  const errors = useSignal<Record<string, string>>({});
  const busy = useSignal(false);
  const locating = useSignal(false);
  const s = settings.value;
  const items = menu.value.items;
  const maxOf = (id: string) => { const it = items.find(i => i.id === id); return it ? maxQty(it) : 20; };
  const q = quote(cart.value, items, s, loc.value);
  const st = open.value;

  if (q.lines.length === 0 && q.missing.length === 0) {
    return (
      <CustomerShell back={{ href: '/', label: t('Back to menu') }}>
        <Empty title={t('Your cart is empty')}><a class="btn primary" href="/">{t('Browse menu')}</a></Empty>
      </CustomerShell>
    );
  }

  const locate = () => {
    if (!('geolocation' in navigator)) { notify('Location is not available on this device. Tap the map instead.', 'err'); return; }
    locating.value = true;
    navigator.geolocation.getCurrentPosition(
      pos => { locating.value = false; loc.value = { lat: pos.coords.latitude, lng: pos.coords.longitude }; if (pos.coords.accuracy > 80) notify(`Location found (±${Math.round(pos.coords.accuracy)} m). Drag the pin onto your exact house.`); },
      err => { locating.value = false; notify(err.code === 1 ? 'Location permission denied. Tap the map to place your pin.' : 'Could not get your location. Tap the map to place your pin.', 'err'); },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  };

  const submit = async () => {
    const e = validateCheckout({ name: name.value, phone: phone.value, address: address.value });
    if (!loc.value) e.loc = 'Place the pin on your house on the map';
    errors.value = e;
    if (Object.keys(e).length) {
      document.querySelector('.has-err, [data-err]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!st.open) { notify(st.label, 'err'); return; }
    if (q.missing.length) { notify('Remove sold-out items first', 'err'); return; }
    if (q.belowMin) { notify(`Minimum order is ${rupees(s.minOrder)}`, 'err'); return; }
    if (q.tooFar) { notify(`Sorry, we deliver up to ${s.maxDeliveryKm} km from the kitchen`, 'err'); return; }
    const db = store.value;
    if (!db) return;
    busy.value = true;
    try {
      const now = Date.now();
      const ph = normalizePhone(phone.value)!;
      const order: Order = {
        id: docId(), code: shortCode(), customerUid: await db.customerUid(),
        name: cleanText(name.value, 60), phone: ph, address: cleanText(address.value, 200),
        area: nearestPlace(loc.value!), location: loc.value!, note: cleanText(cookingNote.value, 200),
        lines: q.lines, subtotal: q.subtotal, deliveryFee: q.deliveryFee, total: q.total,
        pay: pay.value, payState: 'pending', status: 'placed', placedAt: now,
        promiseAt: now + q.promiseMin * 60_000, roadKm: Math.round((q.roadKm ?? 0) * 10) / 10,
      };
      await db.placeOrder(order);
      profile.value = { name: order.name, phone: ph, address: order.address, location: order.location };
      cart.value = {};
      cookingNote.value = '';
      navigate(`/order/${order.id}?new=1`, true);
    } catch (err) {
      notify(errMsg(err), 'err');
    } finally {
      busy.value = false;
    }
  };

  const canUpiNow = !!s.upiId;

  return (
    <CustomerShell back={{ href: '/', label: t('Back to menu') }}>
      <div class="stack lg">
        <h1 style={{ fontSize: '24px' }}>Checkout</h1>
        {!st.open && <div class="banner warn" role="status"><div><b>Ordering is closed</b>{st.label}</div></div>}

        <section class="card" aria-labelledby="h-cart">
          <h2 id="h-cart">{t('Your order')}</h2>
          {q.missing.length > 0 && (
            <div class="banner crit"><div><b>Sold out now</b>{q.missing.join(', ')}. <button type="button" class="linkbtn" onClick={() => { const c = { ...cart.value }; for (const it of items) if (!sellable(it)) delete c[it.id]; for (const id of Object.keys(c)) if (!items.some(i => i.id === id)) delete c[id]; cart.value = c; }}>Remove them</button></div></div>
          )}
          {q.capped.length > 0 && (
            <div class="banner warn"><div><b>Only a few left</b>We lowered the quantity of {q.capped.join(', ')} to what the kitchen has.</div></div>
          )}
          <div class="stack">
            {q.lines.map(l => (
              <div class="cartline" key={l.id}>
                <VegMark veg={l.veg} />
                <span>{l.name}</span>
                <Stepper qty={l.qty} label={l.name} max={maxOf(l.id)} onChange={n => setQty(l.id, n)} />
                <span class="num" style={{ minWidth: '56px', textAlign: 'right' }}>{rupees(l.price * l.qty)}</span>
              </div>
            ))}
          </div>
          <a href="/" class="linkbtn">+ Add more items</a>
          <Field id="note" label={t('Cooking note (optional)')}>
            <input id="note" type="text" maxLength={200} placeholder="e.g. less spicy, no onion" value={cookingNote.value} onInput={e => { cookingNote.value = (e.target as HTMLInputElement).value; }} />
          </Field>
        </section>

        <section class="card" aria-labelledby="h-loc" data-err={errors.value.loc ? '' : undefined}>
          <div class="row between">
            <h2 id="h-loc">{t('Delivery location')}</h2>
            <Btn variant="ghost" small onClick={locate} busy={locating.value}><IcLocate /> {t('Use my current location')}</Btn>
          </div>
          <p class="muted small" style={{ margin: 0 }}>Drag the pin or tap the map on your exact house. The rider navigates to this pin.</p>
          <MapView kitchen={s.location} pick={loc.value} onPick={v => { loc.value = v; errors.value = { ...errors.value, loc: '' }; }} height={250} ariaLabel="Map to choose your delivery location" />
          {errors.value.loc && <div class="err" role="alert" style={{ color: 'var(--crit)', fontSize: '13px' }}>{errors.value.loc}</div>}
          {loc.value && q.roadKm != null && (
            <div class="row">
              <span class="chip brand">Near {nearestPlace(loc.value)}</span>
              <span class="chip">{km1(q.roadKm)} km from kitchen</span>
              {q.outerZone && !q.tooFar && <span class="chip warn">Outer zone · up to {s.outerPromiseMin} min</span>}
              {q.tooFar && <span class="chip crit">Too far · we deliver up to {s.maxDeliveryKm} km</span>}
            </div>
          )}
          <Field id="addr" label={t('House no. and landmark')} hint="(e.g. Plot 12, behind Hanuman temple, green gate)" error={errors.value.address}>
            <textarea id="addr" maxLength={200} value={address.value} onInput={e => { address.value = (e.target as HTMLTextAreaElement).value; }} autocomplete="street-address" />
          </Field>
        </section>

        <section class="card" aria-labelledby="h-contact">
          <h2 id="h-contact">Contact</h2>
          <div class="grid2">
            <Field id="name" label={t('Name')} error={errors.value.name}>
              <input id="name" type="text" maxLength={60} value={name.value} onInput={e => { name.value = (e.target as HTMLInputElement).value; }} autocomplete="name" />
            </Field>
            <Field id="phone" label={t('Mobile number')} error={errors.value.phone}>
              <input id="phone" type="tel" inputMode="numeric" maxLength={16} value={phone.value} onInput={e => { phone.value = (e.target as HTMLInputElement).value; }} autocomplete="tel-national" placeholder="10-digit number" />
            </Field>
          </div>
        </section>

        <section class="card" aria-labelledby="h-pay">
          <h2 id="h-pay">{t('Payment')}</h2>
          <div class="choice" role="radiogroup" aria-labelledby="h-pay">
            <label for="pay-cod"><input id="pay-cod" type="radio" name="pay" checked={pay.value === 'cod'} onChange={() => { pay.value = 'cod'; }} /><span>{t('Cash on delivery')}</span></label>
            <label for="pay-upid"><input id="pay-upid" type="radio" name="pay" checked={pay.value === 'upi_on_delivery'} onChange={() => { pay.value = 'upi_on_delivery'; }} /><span>{t('UPI on delivery')}<small>Scan the rider's QR</small></span></label>
            {canUpiNow && <label for="pay-upin"><input id="pay-upin" type="radio" name="pay" checked={pay.value === 'upi_now'} onChange={() => { pay.value = 'upi_now'; }} /><span>{t('Pay now by UPI')}<small>GPay, PhonePe, Paytm · after placing the order</small></span></label>}
          </div>
        </section>

        <section class="card" aria-labelledby="h-bill">
          <h2 id="h-bill">Bill</h2>
          <div class="lines">
            <div class="line"><span>{t('Item total')}</span><span class="num">{rupees(q.subtotal)}</span></div>
            <div class="line"><span>{t('Delivery fee')}{q.outerZone ? ' (incl. outer zone)' : ''}</span><span class="num">{q.deliveryFee ? rupees(q.deliveryFee) : t('Free delivery')}</span></div>
            {q.freeDeliveryGap > 0 && <div class="line small" style={{ color: 'var(--brand)' }}><span>Add {rupees(q.freeDeliveryGap)} more for free delivery</span></div>}
            <div class="line total"><span>{t('To pay')}</span><span class="num">{rupees(q.total)}</span></div>
          </div>
          {q.belowMin && <div class="banner warn"><div>Minimum order is {rupees(s.minOrder)}. Add {rupees(q.shortBy)} more.</div></div>}
        </section>
      </div>

      <div class="bottombar">
        <Btn block onClick={submit} busy={busy.value} disabled={!st.open || q.belowMin || q.tooFar || q.lines.length === 0} id="place-order">
          {t('Place order')} · {rupees(q.total)}
        </Btn>
      </div>
    </CustomerShell>
  );
}
