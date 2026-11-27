import { expect, test, type Page } from '@playwright/test';
import { addItem, dishCard, freshApp, kitchenLogin, PLACES, placeOrder } from './helpers';

test.beforeEach(async ({ context }) => { await freshApp(context); });

const row = (page: Page, name: string) => page.getByTestId('admin-row').filter({ has: page.getByRole('button', { name: `Edit ${name}`, exact: true }) });

test('admin portal is a separate page that customers never load or see', async ({ page }) => {
  const scripts: string[] = [];
  page.on('response', async r => { if (r.url().endsWith('.js') || r.url().includes('/src/')) scripts.push(await r.text().catch(() => '')); });
  await page.goto('/');
  await expect(page.locator('.item').first()).toBeVisible();
  await page.waitForLoadState('networkidle');
  // No link to the admin portal anywhere in the customer app, and none of its code is downloaded.
  await expect(page.locator('a[href^="/admin"], a[href^="/kitchen"]')).toHaveCount(0);
  expect(scripts.some(s => s.includes('Admin login'))).toBe(false);
  // Old kitchen address is gone from the customer app.
  await page.goto('/kitchen');
  await expect(page.getByText('Page not found')).toBeVisible();
  // The admin portal lives at /admin, behind a login, and is hidden from search engines.
  await page.goto('/admin/menu');
  await expect(page.getByRole('heading', { name: 'Admin login' })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/admin.webmanifest');
});

test('stock: admin sets portions, customer is capped, accepting an order sells it out', async ({ context }) => {
  const admin = await context.newPage();
  await kitchenLogin(admin);
  await admin.goto('/admin/menu');
  await admin.getByRole('searchbox', { name: 'Find a dish' }).fill('veg biryani');
  const stock = admin.getByRole('spinbutton', { name: 'Stock of Veg Biryani' });
  await stock.fill('2');
  await stock.press('Enter');
  await expect(admin.getByText('Veg Biryani: 2 left')).toBeVisible();
  await expect(row(admin, 'Veg Biryani')).toContainText('Only 2 left');
  await expect(admin.locator('.k-tabs.top a[href="/admin/menu"] .count')).toHaveText('1');

  const customer = await context.newPage();
  await customer.goto('/');
  const card = dishCard(customer, 'Veg Biryani');
  await expect(card).toContainText('Only 2 left');
  await addItem(customer, 'Veg Biryani', 2);
  await expect(card.getByRole('button', { name: 'Add one more Veg Biryani' })).toBeDisabled();

  const o = await placeOrder(customer, { name: 'Stock Test', phone: '9000033333', address: 'Farm Road lane 4, house 2', location: PLACES.farmRoad, items: [] });
  await admin.goto('/admin');
  await admin.locator(`#accept-${o.code}`).click();
  await expect(admin.getByText('Now sold out: Veg Biryani')).toBeVisible();

  await customer.goto('/');
  await expect(card).toHaveClass(/off/);
  await expect(card).toContainText('Sold out');

  // Restock from the "Sold out" filter: dish goes back on sale.
  await admin.goto('/admin/menu');
  await admin.getByRole('button', { name: /^Sold out/ }).click();
  await expect(admin.getByTestId('admin-row')).toHaveCount(1);
  const s2 = admin.getByRole('spinbutton', { name: 'Stock of Veg Biryani' });
  await s2.fill('10');
  await s2.press('Enter');
  await expect(card).not.toHaveClass(/off/);
});

test('prices: inline change, bulk change by category, offer price, hide a dish', async ({ context }) => {
  const admin = await context.newPage();
  await kitchenLogin(admin);
  await admin.goto('/admin/menu');
  const customer = await context.newPage();
  await customer.goto('/');
  const price = (name: string) => dishCard(customer, name).locator('.price');

  // Inline price edit
  const p = admin.getByRole('spinbutton', { name: 'Price of Paneer Masala' });
  await p.fill('199');
  await p.press('Enter');
  await expect(admin.getByText('Paneer Masala: ₹185 → ₹199')).toBeVisible();
  await expect(price('Paneer Masala')).toHaveText('₹199');

  // Bulk: Dal +10%, nearest ₹1
  await admin.getByRole('button', { name: 'Change prices' }).click();
  await admin.locator('#bp-scope').selectOption('Dal');
  await admin.locator('#bp-round').selectOption('1');
  await expect(admin.getByText('3 prices will change')).toBeVisible();
  await expect(admin.getByText('₹100 → ₹110')).toBeVisible();
  await admin.locator('#bp-apply').click();
  await expect(admin.getByText('Updated 3 prices')).toBeVisible();
  await expect(price('Dal Fry')).toHaveText('₹110');
  await expect(price('Dal Makhani')).toHaveText('₹176');

  // Offer price + hide
  await admin.getByRole('searchbox', { name: 'Find a dish' }).fill('kaju');
  await admin.getByRole('button', { name: 'Edit Kaju Curry', exact: true }).click();
  await admin.locator('#it-old').fill('250');
  await admin.getByRole('button', { name: 'Save dish' }).click();
  const kaju = dishCard(customer, 'Kaju Curry');
  await expect(kaju).toContainText('₹250');
  await expect(kaju).toContainText('10% off');

  await admin.getByRole('button', { name: 'Edit Kaju Curry', exact: true }).click();
  await admin.getByRole('switch', { name: 'Shown on menu' }).uncheck();
  await admin.getByRole('button', { name: 'Save dish' }).click();
  await expect(kaju).toHaveCount(0);
  await expect(row(admin, 'Kaju Curry')).toContainText('Hidden from customers');
});
