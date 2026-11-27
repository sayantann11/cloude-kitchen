import { expect, test, type BrowserContext, type Page } from '@playwright/test';

// Full owner + rider + customer night on the LIVE site, as a temporary QA admin (no password).
// Customer names start with "QA Bot" so cleanup can find and delete every test order.

const FIREBASE = {
  apiKey: 'AIzaSyDL7QWNMJj3wWfAjOn0pbQX4lQrwa6rDZs',
  authDomain: 'night-kitchen-4d444.firebaseapp.com',
  projectId: 'night-kitchen-4d444',
  appId: '1:234297178927:web:2af42ba54d97cf218a3fda',
};
const SDK = 'https://www.gstatic.com/firebasejs/11.10.0';
const PLACES = {
  farmRoad: { lat: 21.4815, lng: 83.987 },
  ainthapali: { lat: 21.4895, lng: 83.994 },
  khetrajpur: { lat: 21.456, lng: 83.969 },
};

const card = (page: Page, name: string) => page.locator('.item').filter({ has: page.locator('.nm').getByText(name, { exact: true }) });
const row = (page: Page, name: string) => page.getByTestId('admin-row').filter({ has: page.getByRole('button', { name: `Edit ${name}`, exact: true }) });

function logErrors(page: Page, who: string) {
  openPages.push(page);
  page.on('pageerror', e => console.log(`::warning::[${who} page error] ${e.message.slice(0, 300)}`));
  page.on('console', m => { if (m.type() === 'error') console.log(`::warning::[${who} console] ${m.text().slice(0, 300)}`); });
}

async function placeOrder(page: Page, o: { name: string; phone: string; location: { lat: number; lng: number }; items: [string, number][] }) {
  await page.goto('/');
  await page.evaluate(p => localStorage.setItem('mk:profile', JSON.stringify(p)), { name: o.name, phone: o.phone, address: `QA test address for ${o.name}`, location: o.location });
  await page.reload();
  for (const [item, n] of o.items) {
    await card(page, item).getByRole('button', { name: `Add ${item}`, exact: true }).click();
    for (let i = 1; i < n; i++) await card(page, item).getByRole('button', { name: `Add one more ${item}`, exact: true }).click();
  }
  await page.locator('.cartbar').click();
  await page.locator('#note').fill('QA BOT automated test - will be deleted');
  await page.locator('#place-order').click();
  await expect(page).toHaveURL(/\/order\/[A-Za-z0-9]{20}/, { timeout: 30_000 });
  const code = (await page.locator('.code').first().textContent())!.trim();
  return { url: page.url(), code };
}

async function adminContext(ctx: BrowserContext, baseURL: string) {
  const browser = ctx.browser()!;
  const admin = await browser.newContext({ baseURL, viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, timezoneId: 'Asia/Kolkata', acceptDownloads: true });
  const page = await admin.newPage();
  logErrors(page, 'admin');
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Admin login' })).toBeVisible();
  // Sign in the temporary QA admin with a one-time token (no password). Same Firebase storage the app reads.
  await page.evaluate(async ({ token, cfg, sdk }) => {
    const { initializeApp } = await import(/* @vite-ignore */ `${sdk}/firebase-app.js`);
    const { getAuth, signInWithCustomToken } = await import(/* @vite-ignore */ `${sdk}/firebase-auth.js`);
    await signInWithCustomToken(getAuth(initializeApp(cfg)), token);
  }, { token: process.env.QA_TOKEN!, cfg: FIREBASE, sdk: SDK });
  await page.reload();
  await expect(page.getByRole('heading', { name: /New orders/ })).toBeAttached();
  return page;
}

const openPages: Page[] = [];
test.afterEach(async ({}, info) => {
  if (info.status === info.expectedStatus) return;
  for (const p of openPages) {
    const txt = await p.locator('body').innerText().catch(() => '(closed)');
    console.log(`::warning::screen at failure ${p.url()} :: ${txt.replace(/\s+/g, ' ').slice(0, 500)}`);
  }
});

test.beforeAll(() => { if (!process.env.QA_TOKEN) throw new Error('QA_TOKEN missing: run through the Live admin QA workflow'); });

test('live night: orders → reject → accept → grouped trip → rider delivers → menu, stock, prices → reports', async ({ context, baseURL }) => {
  const customer = await context.newPage();
  logErrors(customer, 'customer');

  // 1. Four real orders from customers
  const a = await placeOrder(customer, { name: 'QA Bot Farm Road', phone: '9000000011', location: PLACES.farmRoad, items: [['Paneer Kadhai', 1], ['Jeera Rice', 1]] });
  const b = await placeOrder(customer, { name: 'QA Bot Ainthapali', phone: '9000000012', location: PLACES.ainthapali, items: [['Paneer Masala', 2]] });
  const c = await placeOrder(customer, { name: 'QA Bot Khetrajpur', phone: '9000000013', location: PLACES.khetrajpur, items: [['Paneer Roll', 2]] });
  const d = await placeOrder(customer, { name: 'QA Bot Reject', phone: '9000000014', location: PLACES.farmRoad, items: [['Veg Roll', 2]] });
  console.log(`orders placed: ${a.code} ${b.code} ${c.code} ${d.code}`);

  // 2. Admin sees them live
  const k = await adminContext(context, baseURL!);
  for (const o of [a, b, c, d]) await expect(k.locator(`#accept-${o.code}`)).toBeVisible();
  console.log('admin login + live new orders: ok');

  // 3. Reject one; customer sees why
  await k.locator('.ocard.new').filter({ hasText: d.code }).getByRole('button', { name: 'Details' }).click();
  await k.getByRole('button', { name: 'Reject' }).click();
  await k.getByRole('button', { name: 'Fake / test order' }).click();
  await expect(k.locator(`#accept-${d.code}`)).toHaveCount(0);
  await customer.goto(d.url);
  await expect(customer.getByText('Kitchen could not take this order')).toBeVisible();
  await expect(customer.getByText('Fake / test order')).toBeVisible();
  console.log('reject + customer sees reason: ok');

  // 4. Accept three; customer sees "being cooked" live
  for (const o of [a, b, c]) await k.locator(`#accept-${o.code}`).click();
  for (const o of [a, b, c]) await expect(k.locator(`#accept-${o.code}`)).toHaveCount(0);
  await customer.goto(b.url);
  await expect(customer.getByText(/Ready in about \d+ min/)).toBeVisible();
  console.log('accept + live status on customer page: ok');

  // 5. Grouping: Farm Road + Ainthapali in one trip
  await k.getByRole('button', { name: /Send out/ }).click();
  const grouped = k.getByTestId('batch').filter({ hasText: 'QA Bot Farm Road' }).filter({ hasText: 'QA Bot Ainthapali' });
  await expect(grouped).toHaveCount(1);
  await expect(grouped).toContainText(/orders, one trip/);
  await expect(grouped).toContainText(/Saves \d+\.\d km/);
  await grouped.getByRole('button', { name: 'View route' }).click();
  await expect(k.getByRole('application', { name: 'Route map' })).toBeVisible();
  await expect(k.getByRole('link', { name: 'Open in Google Maps' })).toHaveAttribute('href', /google\.com\/maps\/dir\//);
  await k.getByRole('button', { name: 'Send this trip' }).click();
  await k.getByRole('radio').first().check();
  await k.locator('#confirm-send').click();
  await expect(k.getByText(/\d orders out with/)).toBeVisible();
  await expect(k.getByRole('link', { name: 'Send on WhatsApp' })).toHaveAttribute('href', /wa\.me\//);
  const riderHref = await k.getByRole('link', { name: 'Open rider page' }).getAttribute('href');
  console.log('grouping + route + dispatch: ok');

  // 6. Customer sees the rider; rider delivers both
  await customer.goto(a.url);
  await expect(customer.getByText(/Your rider is on the way:/)).toBeVisible();
  const rider = await context.newPage();
  logErrors(rider, 'rider');
  await rider.goto(riderHref!);
  await expect(rider.getByText(/Rider ·/)).toBeVisible();
  for (const o of [a, b]) {
    await rider.locator(`#deliver-${o.code}`).click();
    await rider.locator('#collect-cash').click();
    await expect(rider.locator(`#deliver-${o.code}`)).toHaveCount(0);
  }
  await expect(rider.getByText('All delivered. Great work!')).toBeVisible();
  await expect(customer.locator('.eta')).toContainText('Delivered');
  console.log('rider page + delivered live on customer page: ok');

  // 7. Third order: mark packed
  await k.goto('/admin');
  await k.locator(`#ready-${c.code}`).click();
  await expect(k.locator(`#ready-${c.code}`)).toHaveCount(0);
  console.log('mark packed: ok');

  // 8. Trips screen
  await k.goto('/admin/trips');
  await expect(k.locator('main')).toBeVisible();

  // 9. Menu: stock, price, sold out (all restored by cleanup)
  await k.goto('/admin/menu');
  await expect(k.getByText(/103 dishes/)).toBeVisible();
  const find = k.getByRole('searchbox', { name: 'Find a dish' });
  await find.fill('veg biryani');
  const stock = k.getByRole('spinbutton', { name: 'Stock of Veg Biryani' });
  await stock.fill('2'); await stock.press('Enter');
  await expect(row(k, 'Veg Biryani')).toContainText('Only 2 left');
  await find.fill('paneer masala');
  const price = k.getByRole('spinbutton', { name: 'Price of Paneer Masala' });
  await price.fill('199'); await price.press('Enter');
  await expect(k.getByText('Paneer Masala: ₹185 → ₹199')).toBeVisible();
  await find.fill('dal fry');
  await k.getByRole('switch', { name: 'On' }).first().uncheck();
  await expect(row(k, 'Dal Fry')).toContainText('Sold out');
  await customer.goto('/');
  await expect(card(customer, 'Veg Biryani')).toContainText('Only 2 left');
  await expect(card(customer, 'Paneer Masala').locator('.price')).toHaveText('₹199');
  await expect(card(customer, 'Dal Fry')).toContainText('Sold out');
  console.log('menu: stock, price, sold out reach customers live: ok');
  await find.fill('');
  await k.getByRole('button', { name: 'Change prices' }).click();
  await expect(k.getByText(/prices will change/)).toBeVisible();
  await k.keyboard.press('Escape');

  // 10. Settings and reports open without errors
  await k.goto('/admin/settings');
  await expect(k.locator('#save-settings')).toBeVisible();
  await k.goto('/admin/reports');
  await expect(k.getByText('Delivered orders')).toBeVisible();
  const dl = k.waitForEvent('download');
  await k.getByRole('button', { name: 'Download CSV' }).click();
  expect((await dl).suggestedFilename()).toMatch(/^orders-\d{4}-\d{2}-\d{2}\.csv$/);
  console.log('settings + reports + CSV: ok');
});
