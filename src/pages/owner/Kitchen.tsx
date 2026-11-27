import { logoLetter } from '../../lib/format';
import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { DEMO_OWNER } from '../../data/local';
import { errMsg, menu, notify, owner, settings, store } from '../../state/app';
import { path } from '../../state/router';
import { IcBike, IcChart, IcCog, IcFood, IcList } from '../../ui/icons';
import { Btn, Field, Skeleton, Switch } from '../../ui/kit';
import { Board } from './Board';
import { enableAlerts, kTrips, placed, soundOn, startKitchenSync } from './kstate';
import { lowStockCount, MenuAdmin } from './MenuAdmin';
import { Reports } from './Reports';
import { SettingsPage } from './Settings';
import { TripsPage } from './Trips';

const TABS = [
  { href: '/admin', label: 'Orders', icon: IcList },
  { href: '/admin/trips', label: 'Trips', icon: IcBike },
  { href: '/admin/menu', label: 'Menu', icon: IcFood },
  { href: '/admin/reports', label: 'Reports', icon: IcChart },
  { href: '/admin/settings', label: 'Settings', icon: IcCog },
];

export function KitchenApp() {
  const o = owner.value;
  if (o === undefined || !store.value) return <div class="wrap" style={{ paddingTop: '40px' }}><Skeleton /></div>;
  if (!o) return <Login />;
  return <KitchenShell />;
}

function KitchenShell() {
  useEffect(() => startKitchenSync(), []);
  const p = path.value.split('?')[0].replace(/\/$/, '') || '/admin';
  const s = settings.value;
  const tab = TABS.find(t => t.href === p) ?? TABS[0];
  const counts: Record<string, number> = { '/admin': placed.value.length, '/admin/trips': kTrips.value.length, '/admin/menu': lowStockCount(menu.value) };

  const nav = (cls: string) => (
    <nav class={`k-tabs ${cls}`} aria-label="Admin sections">
      {TABS.map(t => (
        <a key={t.href} href={t.href} aria-current={t === tab ? 'page' : undefined}>
          <t.icon />{t.label}{counts[t.href] ? <span class="count">{counts[t.href]}</span> : null}
        </a>
      ))}
    </nav>
  );

  return (
    <div class="k-shell">
      {!soundOn.value && (
        <div class="alertbar" role="alert">
          <span>Turn on new-order sound so you never miss an order</span>
          <button type="button" class="btn small" onClick={enableAlerts}>Turn on</button>
        </div>
      )}
      <header class="appbar">
        <div class="bandha" aria-hidden="true" />
        <div class="wrap wide appbar-in">
          <a class="brand grow" href="/admin">
            <span class="logo" aria-hidden="true">{logoLetter(s.kitchenName)}</span>
            <span style={{ minWidth: 0 }}><b>{s.kitchenName}</b><small>Admin{store.value?.mode === 'local' ? ' · demo data' : ''}</small></span>
          </a>
          <Switch id="pause" checked={!s.paused} onChange={v => { void store.value!.saveSettings({ paused: !v }).then(() => notify(v ? 'Taking orders again' : 'Orders paused')).catch(e => notify(errMsg(e), 'err')); }} label={s.paused ? 'Paused' : 'Taking orders'} />
        </div>
        <div class="wrap wide" style={{ paddingBottom: '8px' }}>{nav('top')}</div>
      </header>
      <main class="wrap wide">
        {tab.href === '/admin' && <Board />}
        {tab.href === '/admin/trips' && <TripsPage />}
        {tab.href === '/admin/menu' && <MenuAdmin />}
        {tab.href === '/admin/reports' && <Reports />}
        {tab.href === '/admin/settings' && <SettingsPage />}
      </main>
      {nav('bottom')}
    </div>
  );
}

function Login() {
  const demo = store.value?.mode === 'local';
  const email = useSignal(demo ? DEMO_OWNER.email : '');
  const pass = useSignal(demo ? DEMO_OWNER.password : '');
  const busy = useSignal(false);
  const err = useSignal('');
  const submit = async (e: Event) => {
    e.preventDefault();
    busy.value = true; err.value = '';
    try { await store.value!.ownerSignIn(email.value, pass.value); } catch (x) { err.value = errMsg(x); } finally { busy.value = false; }
  };
  return (
    <main class="wrap" style={{ maxWidth: '420px', paddingTop: '48px' }}>
      <form class="card" onSubmit={submit}>
        <div class="row"><span class="logo">{logoLetter(settings.value.kitchenName)}</span><div><h1 style={{ fontSize: '20px' }}>Admin login</h1><div class="muted small">{settings.value.kitchenName}</div></div></div>
        {demo && <div class="banner info"><div><b>Demo mode</b>Login is filled in for you. Real logins come from Firebase once it is connected.</div></div>}
        <Field id="em" label="Email"><input id="em" type="email" autocomplete="username" value={email.value} onInput={e => { email.value = (e.target as HTMLInputElement).value; }} required /></Field>
        <Field id="pw" label="Password" error={err.value}><input id="pw" type="password" autocomplete="current-password" value={pass.value} onInput={e => { pass.value = (e.target as HTMLInputElement).value; }} required /></Field>
        <Btn type="submit" busy={busy.value} block>Log in</Btn>
        <a href="/" class="linkbtn" style={{ justifySelf: 'center' }}>Go to customer menu</a>
      </form>
    </main>
  );
}
