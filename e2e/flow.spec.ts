import { expect, test } from '@playwright/test';
import { freshApp, kitchenLogin, PLACES, placeOrder } from './helpers';

test.beforeEach(async ({ context }) => { await freshApp(context); });

test('full night: 3 orders → kitchen accepts → 2 grouped into one trip → rider delivers → customer sees it live', async ({ context }) => {
  const customer = await context.newPage();

  const a = await placeOrder(customer, { name: 'Rakesh Meher', phone: '9437160008', address: 'Farm Road, behind SBI ATM', location: PLACES.farmRoad, items: [['Machha Besara', 1], ['Dalma Bhata', 1]] });
  const b = await placeOrder(customer, { name: 'Priya Sahu', phone: '9861041221', address: 'Near Ainthapali Chowk, blue gate', location: PLACES.ainthapali, items: [['Odia Veg Thali', 2]] });
  const c = await placeOrder(customer, { name: 'Sourav Dash', phone: '7008011145', address: 'Khetrajpur railway colony C/14', location: PLACES.khetrajpur, items: [['Egg Roll', 2]] });

  const kitchen = await context.newPage();
  await kitchenLogin(kitchen);
  await expect(kitchen.locator('.ocard.new')).toHaveCount(3);
  await expect(kitchen.locator('.kpi').first()).toContainText('3');

  for (const o of [a, b, c]) await kitchen.locator(`#accept-${o.code}`).click();
  await expect(kitchen.locator('.ocard.new')).toHaveCount(0);

  // Customer sees "Being cooked" live, without reloading.
  await customer.goto(b.url);
  await expect(customer.getByText('Ready in about 20 min')).toBeVisible();

  // Send out: Farm Road + Ainthapali grouped, Khetrajpur alone.
  await kitchen.getByRole('button', { name: /Send out/ }).click();
  const batches = kitchen.getByTestId('batch');
  await expect(batches).toHaveCount(2);
  const grouped = batches.filter({ hasText: '2 orders, one trip' });
  await expect(grouped).toContainText('Rakesh Meher');
  await expect(grouped).toContainText('Priya Sahu');
  await expect(grouped).toContainText(/Saves \d+\.\d km/);
  await expect(batches.filter({ hasText: 'Single order' })).toContainText('Sourav Dash');

  await grouped.getByRole('button', { name: 'View route' }).click();
  await expect(kitchen.getByRole('application', { name: 'Route map' })).toBeVisible();
  const gm = kitchen.getByRole('link', { name: 'Open in Google Maps' });
  await expect(gm).toHaveAttribute('href', /google\.com\/maps\/dir\/.*waypoints=/);
  await kitchen.getByRole('button', { name: 'Send this trip' }).click();
  await kitchen.getByRole('radio', { name: /Sanjay/ }).check();
  await kitchen.locator('#confirm-send').click();
  await expect(kitchen.getByText('2 orders out with Sanjay')).toBeVisible();
  await expect(kitchen.getByRole('link', { name: 'Send on WhatsApp' })).toHaveAttribute('href', /wa\.me\/919876500002\?text=.*rider/);

  // Customer sees the rider.
  await expect(customer.getByText('Your rider is on the way: Sanjay')).toBeVisible();
  await expect(customer.getByText(/also delivering 1 other order/)).toBeVisible();

  // Rider opens the link and delivers both.
  const riderHref = await kitchen.getByRole('link', { name: 'Open rider page' }).getAttribute('href');
  const rider = await context.newPage();
  await rider.goto(riderHref!);
  await expect(rider.getByText('Rider · Sanjay')).toBeVisible();
  await expect(rider.locator('.kpi').first()).toContainText('2');
  for (const o of [a, b]) {
    await rider.locator(`#deliver-${o.code}`).click();
    await rider.locator('#collect-cash').click();
  }
  await expect(rider.getByText('All delivered. Great work!')).toBeVisible();

  // Customer page flips to Delivered live.
  await expect(customer.locator('.eta')).toContainText('Delivered');

  // Kitchen: trip gone from the road, km saved counted.
  await kitchen.goto('/kitchen/trips');
  await expect(kitchen.getByText('No riders out')).toBeVisible();
  await kitchen.goto('/kitchen');
  await expect(kitchen.locator('.kpi.good')).not.toContainText(/^Saved by grouping today0\.0/);

  // Reports
  await kitchen.goto('/kitchen/reports');
  await expect(kitchen.locator('.kpi').first()).toContainText('2');
  const dl = kitchen.waitForEvent('download');
  await kitchen.getByRole('button', { name: 'Download CSV' }).click();
  expect((await dl).suggestedFilename()).toMatch(/^orders-\d{4}-\d{2}-\d{2}\.csv$/);
});

test('kitchen rejects an order and the customer sees why', async ({ context }) => {
  const customer = await context.newPage();
  const o = await placeOrder(customer, { name: 'Test Customer', phone: '9000011111', address: 'Golebazar main road shop 4', location: PLACES.farmRoad, items: [['Dalma Bhata', 1]] });
  const kitchen = await context.newPage();
  await kitchenLogin(kitchen);
  await kitchen.locator('.ocard.new').getByRole('button', { name: 'Details' }).click();
  await kitchen.getByRole('button', { name: 'Reject' }).click();
  await kitchen.getByRole('button', { name: 'Item finished' }).click();
  await expect(customer.getByText('Kitchen could not take this order')).toBeVisible();
  await expect(customer.getByText('Item finished')).toBeVisible();
  void o;
});

test('owner marks a dish sold out and pauses orders; customers see both', async ({ context }) => {
  const kitchen = await context.newPage();
  await kitchenLogin(kitchen);
  await kitchen.goto('/kitchen/menu');
  await kitchen.getByRole('switch', { name: 'On' }).first().uncheck();
  await expect(kitchen.getByText(/1 sold out today/)).toBeVisible();

  const customer = await context.newPage();
  await customer.goto('/');
  await expect(customer.locator('.item.off').first()).toContainText('Sold out');

  // Add a new dish
  await kitchen.getByRole('button', { name: '+ Add dish' }).click();
  await kitchen.locator('#it-name').fill('Chicken Biryani');
  await kitchen.locator('#it-price').fill('199');
  await kitchen.locator('#it-cat').selectOption('Thali');
  await kitchen.getByRole('switch', { name: 'Veg' }).uncheck();
  await kitchen.getByRole('button', { name: 'Save dish' }).click();
  await expect(customer.getByRole('heading', { name: 'Chicken Biryani' })).toBeVisible();

  // Pause
  await kitchen.getByRole('switch', { name: 'Taking orders' }).uncheck();
  await expect(customer.getByText('Not taking orders right now')).toBeVisible();
});

test('owner changes settings and they apply to customers', async ({ context }) => {
  const kitchen = await context.newPage();
  await kitchenLogin(kitchen);
  await kitchen.goto('/kitchen/settings');
  await kitchen.locator('#s-kitchenName').fill('Sambalpur Rasoi');
  await kitchen.locator('#s-deliveryFee').fill('30');
  await kitchen.locator('#s-upi').fill('not-a-upi');
  await kitchen.locator('#save-settings').click();
  await expect(kitchen.getByText('UPI ID looks like name@bank')).toBeVisible();
  await kitchen.locator('#s-upi').fill('rasoi@okaxis');
  await kitchen.locator('#save-settings').click();
  await expect(kitchen.getByText('Settings saved')).toBeVisible();

  const customer = await context.newPage();
  await customer.goto('/');
  await expect(customer.locator('.brand b')).toHaveText('Sambalpur Rasoi');
  await customer.getByRole('button', { name: /^Add Dalma Bhata/ }).click();
  await customer.locator('.cartbar').click();
  await expect(customer.getByText('₹30')).toBeVisible();
  await expect(customer.getByRole('radio', { name: /Pay now by UPI/ })).toBeVisible();
});

test('pay-now UPI: link, customer marks paid, kitchen sees it', async ({ context }) => {
  const setup = await context.newPage();
  await setup.goto('/');
  await setup.evaluate(() => { const s = JSON.parse(localStorage.getItem('mk:settings') || '{}'); s.upiId = 'kitchen@okaxis'; localStorage.setItem('mk:settings', JSON.stringify(s)); });
  const customer = await context.newPage();
  const o = await placeOrder(customer, { name: 'Lipsa Mishra', phone: '9437000001', address: 'Sakhipara, near school gate', location: PLACES.farmRoad, items: [['Fish Thali', 1]], pay: /Pay now by UPI/ });
  const link = customer.getByRole('link', { name: 'Open UPI app' });
  await expect(link).toHaveAttribute('href', /^upi:\/\/pay\?pa=kitchen%40okaxis.*am=295\.00/);
  await customer.getByLabel('UPI reference number (optional)').fill('123456789012');
  await customer.getByRole('button', { name: 'I have paid' }).click();
  await expect(customer.getByText(/Payment marked as done/)).toBeVisible();

  const kitchen = await context.newPage();
  await kitchenLogin(kitchen);
  await kitchen.locator('.ocard.new').getByRole('button', { name: 'Details' }).click();
  await expect(kitchen.getByText('customer says paid')).toBeVisible();
  await expect(kitchen.getByText('123456789012')).toBeVisible();
  void o;
});

test('wrong kitchen password is refused', async ({ page }) => {
  await page.goto('/kitchen');
  await page.locator('#pw').fill('nope');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByText('Wrong email or password')).toBeVisible();
});
