import { useSignal } from '@preact/signals';
import type { Rider, Settings } from '../../data/types';
import { DAYS } from '../../lib/hours';
import { docId } from '../../lib/ids';
import { cleanText, isUpiId, normalizePhone } from '../../lib/validate';
import { owner, settings, store } from '../../state/app';
import { Btn, Field, Switch } from '../../ui/kit';
import { MapView } from '../../ui/MapView';
import { act } from './OrderSheet';

type Draft = Settings;

export function SettingsPage() {
  const d = useSignal<Draft>(structuredClone(settings.value));
  const err = useSignal<Record<string, string>>({});
  const busy = useSignal(false);
  const v = d.value;
  const set = (p: Partial<Draft>) => { d.value = { ...v, ...p }; };
  const num = (k: keyof Draft, min: number, max: number) => ({
    id: `s-${k}`, type: 'number', inputMode: 'numeric' as const, min, max, value: String(v[k] as number),
    onInput: (e: Event) => set({ [k]: Number((e.target as HTMLInputElement).value) } as Partial<Draft>),
  });
  const dirty = JSON.stringify(v) !== JSON.stringify(settings.value);

  const save = async () => {
    const e: Record<string, string> = {};
    if (cleanText(v.kitchenName, 40).length < 2) e.kitchenName = 'Enter the kitchen name';
    if (!normalizePhone(v.phone)) e.phone = 'Enter a 10-digit mobile number';
    if (v.upiId && !isUpiId(v.upiId)) e.upiId = 'UPI ID looks like name@bank';
    if (v.batchWindowMin < 10 || v.batchWindowMin > 90) e.batchWindowMin = '10 to 90 minutes';
    if (v.maxPerTrip < 1 || v.maxPerTrip > 6) e.maxPerTrip = '1 to 6 orders';
    v.riders.forEach((r, i) => { if (!normalizePhone(r.phone) || cleanText(r.name, 30).length < 2) e[`rider${i}`] = 'Each rider needs a name and 10-digit phone'; });
    err.value = e;
    if (Object.keys(e).length) { document.querySelector('.has-err')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    const phone = normalizePhone(v.phone)!;
    const clean: Draft = {
      ...v,
      kitchenName: cleanText(v.kitchenName, 40), tagline: cleanText(v.tagline, 80), address: cleanText(v.address, 160),
      phone, whatsapp: v.whatsapp.replace(/\D/g, '') || `91${phone}`, upiId: v.upiId.trim(), upiName: cleanText(v.upiName, 40),
      pauseMessage: cleanText(v.pauseMessage, 120),
      riders: v.riders.map(r => ({ ...r, name: cleanText(r.name, 30), phone: normalizePhone(r.phone)! })),
    };
    busy.value = true;
    await act(() => store.value!.saveSettings(clean), 'Settings saved');
    busy.value = false;
  };

  const setRider = (i: number, p: Partial<Rider>) => set({ riders: v.riders.map((r, j) => (j === i ? { ...r, ...p } : r)) });

  return (
    <div class="stack lg" style={{ maxWidth: '760px' }}>
      <h2 style={{ fontSize: '20px' }}>Settings</h2>

      <section class="card">
        <h2>Kitchen</h2>
        <Field id="s-kitchenName" label="Kitchen name" error={err.value.kitchenName}><input id="s-kitchenName" type="text" value={v.kitchenName} onInput={e => set({ kitchenName: (e.target as HTMLInputElement).value })} /></Field>
        <Field id="s-tagline" label="Tagline on menu"><input id="s-tagline" type="text" value={v.tagline} onInput={e => set({ tagline: (e.target as HTMLInputElement).value })} /></Field>
        <div class="grid2">
          <Field id="s-phone" label="Phone for customers" error={err.value.phone}><input id="s-phone" type="tel" value={v.phone} onInput={e => set({ phone: (e.target as HTMLInputElement).value })} /></Field>
          <Field id="s-wa" label="WhatsApp number" hint="(with 91)"><input id="s-wa" type="tel" value={v.whatsapp} onInput={e => set({ whatsapp: (e.target as HTMLInputElement).value })} /></Field>
        </div>
        <Field id="s-addr" label="Kitchen address"><input id="s-addr" type="text" value={v.address} onInput={e => set({ address: (e.target as HTMLInputElement).value })} /></Field>
        <div class="small"><b>Kitchen location</b> <span class="muted">(routes start here; tap the map to move it)</span></div>
        <MapView kitchen={settings.value.location} pick={v.location} onPick={p => set({ location: p })} height={220} ariaLabel="Kitchen location map" />
      </section>

      <section class="card">
        <h2>Opening hours</h2>
        <div class="stack" style={{ gap: '8px' }}>
          {v.hours.map((h, i) => (
            <div class="hours" key={i}>
              <b>{DAYS[i].slice(0, 3)}</b>
              <input type="time" aria-label={`${DAYS[i]} opens`} value={h.open} disabled={h.closed} onInput={e => set({ hours: v.hours.map((x, j) => (j === i ? { ...x, open: (e.target as HTMLInputElement).value } : x)) })} />
              <input type="time" aria-label={`${DAYS[i]} closes`} value={h.close} disabled={h.closed} onInput={e => set({ hours: v.hours.map((x, j) => (j === i ? { ...x, close: (e.target as HTMLInputElement).value } : x)) })} />
              <Switch id={`day-${i}`} checked={!h.closed} onChange={on => set({ hours: v.hours.map((x, j) => (j === i ? { ...x, closed: !on } : x)) })} label={h.closed ? 'Closed' : 'Open'} />
            </div>
          ))}
        </div>
        <Btn variant="ghost" small onClick={() => set({ hours: v.hours.map(() => ({ ...v.hours[1] })) })}>Copy Monday to all days</Btn>
        <Field id="s-pausemsg" label="Message when orders are paused"><input id="s-pausemsg" type="text" value={v.pauseMessage} onInput={e => set({ pauseMessage: (e.target as HTMLInputElement).value })} /></Field>
      </section>

      <section class="card">
        <h2>Delivery and fees</h2>
        <div class="grid3">
          <Field id="s-minOrder" label="Minimum order (₹)"><input {...num('minOrder', 0, 5000)} /></Field>
          <Field id="s-deliveryFee" label="Delivery fee (₹)"><input {...num('deliveryFee', 0, 500)} /></Field>
          <Field id="s-freeDeliveryAbove" label="Free delivery above (₹)" hint="0 = never"><input {...num('freeDeliveryAbove', 0, 10000)} /></Field>
          <Field id="s-outerZoneKm" label="Outer zone starts (km)"><input {...num('outerZoneKm', 1, 50)} /></Field>
          <Field id="s-outerZoneFee" label="Outer zone extra (₹)"><input {...num('outerZoneFee', 0, 500)} /></Field>
          <Field id="s-maxDeliveryKm" label="Max delivery distance (km)"><input {...num('maxDeliveryKm', 1, 60)} /></Field>
          <Field id="s-promiseMin" label="Promise in town (min)"><input {...num('promiseMin', 15, 120)} /></Field>
          <Field id="s-outerPromiseMin" label="Promise outer zone (min)"><input {...num('outerPromiseMin', 15, 180)} /></Field>
          <Field id="s-prepMin" label="Usual prep time (min)"><input {...num('prepMin', 5, 90)} /></Field>
        </div>
      </section>

      <section class="card">
        <h2>Order grouping</h2>
        <p class="muted small" style={{ margin: 0 }}>Orders placed within the window, on the same side of town, share one rider, but only if nobody's food arrives late.</p>
        <div class="grid3">
          <Field id="s-batchWindowMin" label="Group window (min)" error={err.value.batchWindowMin}><input {...num('batchWindowMin', 10, 90)} /></Field>
          <Field id="s-maxPerTrip" label="Max orders per rider" error={err.value.maxPerTrip}><input {...num('maxPerTrip', 1, 6)} /></Field>
          <Field id="s-nearKm" label="Max gap between stops (km)"><input id="s-nearKm" type="number" step="0.1" min={0.5} max={10} value={v.nearKm} onInput={e => set({ nearKm: Number((e.target as HTMLInputElement).value) })} /></Field>
        </div>
      </section>

      <section class="card">
        <h2>UPI payments</h2>
        <p class="muted small" style={{ margin: 0 }}>Add your UPI ID to let customers pay right after ordering. No gateway fee. Leave empty to offer only pay-on-delivery.</p>
        <div class="grid2">
          <Field id="s-upi" label="UPI ID" error={err.value.upiId}><input id="s-upi" type="text" placeholder="kitchen@okaxis" value={v.upiId} onInput={e => set({ upiId: (e.target as HTMLInputElement).value })} /></Field>
          <Field id="s-upiname" label="Name shown in UPI app"><input id="s-upiname" type="text" value={v.upiName} onInput={e => set({ upiName: (e.target as HTMLInputElement).value })} /></Field>
        </div>
      </section>

      <section class="card">
        <h2>Riders</h2>
        {v.riders.map((r, i) => (
          <div class={`row ${err.value[`rider${i}`] ? 'has-err' : ''}`} key={r.id}>
            <input type="text" aria-label={`Rider ${i + 1} name`} placeholder="Name" value={r.name} style={{ flex: '1 1 140px' }} onInput={e => setRider(i, { name: (e.target as HTMLInputElement).value })} />
            <input type="tel" aria-label={`Rider ${i + 1} phone`} placeholder="Phone" value={r.phone} style={{ flex: '1 1 140px' }} onInput={e => setRider(i, { phone: (e.target as HTMLInputElement).value })} />
            <Btn variant="danger" small onClick={() => set({ riders: v.riders.filter((_, j) => j !== i) })} aria-label={`Remove rider ${r.name}`}>Remove</Btn>
            {err.value[`rider${i}`] && <div class="err small" style={{ color: 'var(--crit)', width: '100%' }}>{err.value[`rider${i}`]}</div>}
          </div>
        ))}
        <Btn variant="ghost" small onClick={() => set({ riders: [...v.riders, { id: docId().slice(0, 8), name: '', phone: '' }] })}>+ Add rider</Btn>
      </section>

      <section class="card">
        <h2>Account</h2>
        <div class="row between"><span class="small">Logged in as <b>{owner.value?.email}</b></span><Btn variant="ghost" small onClick={() => act(() => store.value!.ownerSignOut())}>Log out</Btn></div>
      </section>

      <div class="bottombar" style={{ bottom: 'calc(60px + env(safe-area-inset-bottom, 0px))' }}>
        <div class="row" style={{ justifyContent: 'flex-end' }}>
          {dirty && <Btn variant="ghost" onClick={() => { d.value = structuredClone(settings.value); err.value = {}; }}>Discard</Btn>}
          <Btn onClick={save} busy={busy.value} disabled={!dirty} id="save-settings">{dirty ? 'Save changes' : 'All saved'}</Btn>
        </div>
      </div>
    </div>
  );
}
