import { logoLetter } from '../../lib/format';
import type { ComponentChildren } from 'preact';
import { cartCount, lang, open, settings } from '../../state/app';
import { t } from '../../state/i18n';
import { IcReceipt } from '../../ui/icons';

export function CustomerShell({ children, back }: { children: ComponentChildren; back?: { href: string; label: string } }) {
  const s = settings.value;
  return (
    <>
      <header class="appbar">
        <div class="bandha" aria-hidden="true" />
        <div class="wrap appbar-in">
          {back ? (
            <a class="iconbtn" href={back.href} aria-label={back.label}>←</a>
          ) : null}
          <a class="brand grow" href="/" aria-label={`${s.kitchenName} home`}>
            <span class="logo" aria-hidden="true">{logoLetter(s.kitchenName)}</span>
            <span style={{ minWidth: 0 }}>
              <b>{s.kitchenName}</b>
              <small>{open.value.open ? <span style={{ color: 'var(--good)' }}>● {open.value.label}</span> : open.value.label}</small>
            </span>
          </a>
          <button type="button" class="iconbtn" onClick={() => { lang.value = lang.value === 'en' ? 'or' : 'en'; }} aria-label="Change language">
            {lang.value === 'en' ? 'ଓଡ଼ିଆ' : 'EN'}
          </button>
          <a class="iconbtn" href="/orders" aria-label={t('My orders')}>
            <IcReceipt />
          </a>
        </div>
      </header>
      <main class="wrap">{children}</main>
      <span class="sr-only" aria-live="polite">{cartCount.value ? `${cartCount.value} items in cart` : ''}</span>
    </>
  );
}
