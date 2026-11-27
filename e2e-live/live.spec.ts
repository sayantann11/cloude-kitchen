import { expect, test, type Page } from '@playwright/test';

test.beforeEach(({ page }) => {
  page.on('requestfailed', r => console.log(`::warning::request failed ${r.url().slice(0, 120)} ${r.failure()?.errorText}`));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log(`::warning::[browser ${m.type()}] ${m.text().slice(0, 300)}`); });
  page.on('pageerror', e => console.log(`::warning::[page error] ${e.message.slice(0, 300)}`));
});

const card = (page: Page, name: string) => page.locator('.item').filter({ has: page.locator('.nm').getByText(name, { exact: true }) });
const rs = (s: string) => Number(s.replace(/[^\d]/g, ''));
const add = (page: Page, name: string) => card(page, name).getByRole('button', { name: `Add ${name}`, exact: true }).click();

async function fillCheckout(page: Page, o: { name: string; phone: string; address: string }) {
  await page.locator('#note').fill('TEST ORDER - automated check, please ignore');
  await page.getByRole('button', { name: /Use my current location/ }).click();
  await expect(page.getByText('Near Farm Road')).toBeVisible();
  await page.locator('#addr').fill(o.address);
  await page.locator('#name').fill(o.name);
  await page.locator('#phone').fill(o.phone);
}

async function cancel(page: Page) {
  await page.getByRole('button', { name: 'Cancel order' }).click();
  await page.getByRole('button', { name: 'Ordered by mistake' }).click();
  await expect(page.locator('.eta')).toContainText('Cancelled');
}

test('every one of the 103 dishes shows a price and adds to the cart with the right total', async ({ page }) => {
  const t0 = Date.now();
  await page.goto('/');
  await expect(page.locator('.item')).toHaveCount(103);
  console.log(`menu ready in ${Date.now() - t0} ms`);
  const dishes = await page.locator('.item').evaluateAll(els => els.map(e => ({
    name: e.querySelector('.nm')?.textContent ?? '', price: e.querySelector('.price')?.textContent ?? '',
  })));
  let sum = 0;
  for (const d of dishes) {
    expect(d.name, 'dish without a name').not.toBe('');
    expect(rs(d.price), `${d.name} has no price`).toBeGreaterThan(0);
    sum += rs(d.price);
    await add(page, d.name);
    await expect(card(page, d.name).getByRole('group', { name: `Quantity of ${d.name}` })).toContainText('1');
  }
  const total = `₹${sum.toLocaleString('en-IN')}`;
  await expect(page.locator('.cartbar')).toContainText(`103 items · ${total}`);
  await page.locator('.cartbar').click();
  await expect(page.locator('.cartline')).toHaveCount(103);
  await expect(page.locator('.line.total')).toContainText(total); // free delivery above ₹399
  console.log(`103 dishes, menu total ${total}`);
  await page.evaluate(() => localStorage.removeItem('mk:cart'));
});

test('search, every category button and Odia switch work', async ({ page }) => {
  await page.goto('/');
  const group = page.getByRole('group', { name: 'Menu categories' });
  const cats = await group.getByRole('button').allTextContents();
  expect(cats.length).toBe(13);
  for (const c of cats) {
    await group.getByRole('button', { name: c, exact: true }).click();
    await expect(page.locator(`.menu-sec[data-cat="${c}"] h2`)).toBeInViewport();
  }
  const search = page.getByRole('searchbox', { name: 'Search dishes' });
  await search.fill('paneer');
  expect(await page.locator('.item').count()).toBeGreaterThan(20);
  await search.fill('momos');
  await expect(page.locator('.item')).toHaveCount(3);
  await search.fill('soup');
  await expect(page.locator('.item')).toHaveCount(6);
  await search.fill('pizza');
  await expect(page.getByText('No dishes match')).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await page.getByRole('button', { name: 'Change language' }).click();
  await expect(page.locator('#menu-search')).toHaveAttribute('placeholder', 'ଖାଦ୍ୟ ଖୋଜନ୍ତୁ');
  await page.getByRole('button', { name: 'Change language' }).click();
});

test('checkout blocks bad input, small orders and far addresses', async ({ page }) => {
  await page.goto('/');
  await add(page, 'Tawa Roti (each)');
  await page.locator('.cartbar').click();
  await expect(page.getByText(/Minimum order is ₹99/)).toBeVisible();
  await expect(page.locator('#place-order')).toBeDisabled();
  await page.evaluate(() => localStorage.removeItem('mk:cart'));
  await page.goto('/');
  await add(page, 'Paneer Masala');
  await page.locator('.cartbar').click();
  await page.locator('#place-order').click();
  await expect(page.getByText('Enter your name')).toBeVisible();
  await expect(page.getByText('Enter a 10-digit mobile number')).toBeVisible();
  await expect(page.getByText('Place the pin on your house')).toBeVisible();
  await page.evaluate(() => {
    localStorage.setItem('mk:profile', JSON.stringify({ name: 'Far Test', phone: '9000000002', address: 'Far away test road 1', location: { lat: 21.7, lng: 84.25 } }));
  });
  await page.reload();
  await expect(page.getByText(/Too far/)).toBeVisible();
  await expect(page.locator('#place-order')).toBeDisabled();
  await page.evaluate(() => { localStorage.removeItem('mk:cart'); localStorage.removeItem('mk:profile'); });
});

test('real order, cash on delivery: placed, saved, listed, cancelled', async ({ page }) => {
  await page.goto('/');
  await add(page, 'Paneer Meal');
  await add(page, 'Veg Hakka Noodles');
  await card(page, 'Veg Hakka Noodles').getByRole('button', { name: 'Add one more Veg Hakka Noodles', exact: true }).click();
  await page.locator('.cartbar').click();
  await expect(page.locator('.line.total')).toContainText('₹439'); // 199 + 2×120, free delivery
  await fillCheckout(page, { name: 'QA Bot Cash', phone: '9000000003', address: 'TEST house 3, Farm Road' });
  await page.locator('#place-order').click();
  await expect(page).toHaveURL(/\/order\/[A-Za-z0-9]{20}/, { timeout: 20_000 });
  await expect(page.getByText('Order sent to the kitchen')).toBeVisible();
  const code = (await page.locator('.code').first().textContent())!.trim();
  await page.reload();
  await expect(page.getByText('Waiting for the kitchen to accept')).toBeVisible();
  await page.goto('/orders');
  await expect(page.getByText(code)).toBeVisible();
  await page.getByText(code).click();
  await cancel(page);
  console.log(`order ${code} placed and cancelled`);
});

test('real order, UPI on delivery, cart empties afterwards', async ({ page }) => {
  await page.goto('/');
  await add(page, 'Chinese Combo');
  await page.locator('.cartbar').click();
  await expect(page.locator('.line.total')).toContainText('₹244'); // 219 + 25 delivery
  await fillCheckout(page, { name: 'QA Bot UPI', phone: '9000000004', address: 'TEST house 4, Farm Road' });
  await page.getByRole('radio', { name: /UPI on delivery/ }).check();
  await expect(page.getByRole('radio', { name: /Pay now by UPI/ })).toHaveCount(0); // no UPI ID set yet
  await page.locator('#place-order').click();
  await expect(page).toHaveURL(/\/order\//, { timeout: 20_000 });
  await expect(page.getByText(/UPI on delivery/).first()).toBeVisible();
  const code = (await page.locator('.code').first().textContent())!.trim();
  await cancel(page);
  await page.goto('/checkout');
  await expect(page.getByText('Your cart is empty')).toBeVisible();
  console.log(`order ${code} placed and cancelled`);
});

test('admin portal is separate and locked; unknown pages are handled', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.item').first()).toBeVisible();
  await expect(page.locator('a[href^="/admin"]')).toHaveCount(0);
  await page.goto('/admin/menu');
  await expect(page.getByRole('heading', { name: 'Admin login' })).toBeVisible();
  await page.goto('/kitchen');
  await expect(page.getByText('Page not found')).toBeVisible();
  const robots = await (await page.request.get('/robots.txt')).text();
  expect(robots).toContain('Disallow: /admin');
});
