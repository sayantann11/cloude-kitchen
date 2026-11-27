import { expect, type BrowserContext, type Page } from '@playwright/test';

export const PLACES = {
  farmRoad: { lat: 21.4815, lng: 83.987 },
  ainthapali: { lat: 21.4895, lng: 83.994 },
  khetrajpur: { lat: 21.456, lng: 83.969 },
  far: { lat: 21.7, lng: 84.25 },
};

/** Fresh demo data, kitchen open 24 h, so tests don't depend on the clock. */
export async function freshApp(context: BrowserContext, extraSettings: Record<string, unknown> = {}) {
  await context.addInitScript(([extra]) => {
    if (sessionStorage.getItem('e2e-init')) return;
    sessionStorage.setItem('e2e-init', '1');
    if (localStorage.getItem('mk:e2e')) return;
    localStorage.clear();
    localStorage.setItem('mk:e2e', '1');
    const allDay = Array.from({ length: 7 }, () => ({ open: '00:00', close: '00:00' }));
    localStorage.setItem('mk:settings', JSON.stringify({ hours: allDay, riders: [{ id: 'r1', name: 'Bikash', phone: '9876500001' }, { id: 'r2', name: 'Sanjay', phone: '9876500002' }], ...extra }));
  }, [extraSettings] as const);
}

export async function setProfile(page: Page, p: { name: string; phone: string; address: string; location: { lat: number; lng: number } }) {
  await page.evaluate(v => localStorage.setItem('mk:profile', JSON.stringify(v)), p);
}

export async function addItem(page: Page, name: string, times = 1) {
  const card = page.locator('.item', { has: page.getByRole('heading', { name, exact: false }) }).first();
  await card.getByRole('button', { name: new RegExp(`^Add ${escapeRe(name)}`) }).click();
  for (let i = 1; i < times; i++) await card.getByRole('button', { name: new RegExp(`Add one more ${escapeRe(name)}`) }).click();
}

export async function placeOrder(page: Page, opts: { name: string; phone: string; address: string; location: { lat: number; lng: number }; items: [string, number][]; pay?: RegExp }) {
  await page.goto('/');
  await setProfile(page, { name: opts.name, phone: opts.phone, address: opts.address, location: opts.location });
  await page.reload();
  for (const [item, n] of opts.items) await addItem(page, item, n);
  await page.locator('.cartbar').click();
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
  if (opts.pay) await page.getByRole('radio', { name: opts.pay }).check();
  await page.locator('#place-order').click();
  await expect(page).toHaveURL(/\/order\/[A-Za-z0-9]+/);
  await expect(page.getByText('Order sent to the kitchen')).toBeVisible();
  const code = (await page.locator('.code').first().textContent())!.trim();
  return { url: page.url(), code };
}

export async function kitchenLogin(page: Page) {
  await page.goto('/kitchen');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('heading', { name: /New orders/ })).toBeAttached();
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
