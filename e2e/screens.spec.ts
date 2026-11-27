// Visual check: saves phone screenshots of every main screen to test-results/screens (run: npx playwright test screens).
import { expect, test } from '@playwright/test';
import { freshApp, kitchenLogin, PLACES, placeOrder } from './helpers';

test.skip(!process.env.SCREENS, 'set SCREENS=1 to capture screenshots');

test('capture screens', async ({ context }) => {
  await freshApp(context);
  const dir = 'test-results/screens';
  const c = await context.newPage();
  await c.goto('/');
  await c.waitForTimeout(400);
  await c.screenshot({ path: `${dir}/01-menu.png` });
  const a = await placeOrder(c, { name: 'Rakesh Meher', phone: '9437160008', address: 'Farm Road, behind SBI ATM, 2nd floor', location: PLACES.farmRoad, items: [['Machha Besara', 1], ['Dalma Bhata', 1]] });
  const b = await placeOrder(c, { name: 'Priya Sahu', phone: '9861041221', address: 'Near Ainthapali Chowk, blue gate', location: PLACES.ainthapali, items: [['Odia Veg Thali', 2], ['Chhena Poda (2 slices)', 1]] });
  await c.screenshot({ path: `${dir}/03-tracking.png`, fullPage: true });
  await c.goto('/');
  await c.getByRole('button', { name: /^Add Chicken Kassa/ }).click();
  await c.goto('/checkout');
  await c.waitForTimeout(1500);
  await c.screenshot({ path: `${dir}/02-checkout.png`, fullPage: true });

  const k = await context.newPage();
  await kitchenLogin(k);
  await k.waitForTimeout(300);
  await k.screenshot({ path: `${dir}/04-kitchen-new.png`, fullPage: true });
  for (const o of [a, b]) await k.locator(`#accept-${o.code}`).click();
  await k.getByRole('button', { name: /Send out/ }).click();
  await k.screenshot({ path: `${dir}/05-kitchen-sendout.png`, fullPage: true });
  await k.getByTestId('batch').first().getByRole('button', { name: 'View route' }).click();
  await k.waitForTimeout(1500);
  await k.screenshot({ path: `${dir}/06-route.png` });
  await k.getByRole('button', { name: 'Send this trip' }).click();
  await k.locator('#confirm-send').click();
  const href = await k.getByRole('link', { name: 'Open rider page' }).getAttribute('href');
  const r = await context.newPage();
  await r.goto(href!);
  await r.screenshot({ path: `${dir}/07-rider.png`, fullPage: true });
  await k.goto('/kitchen/menu');
  await k.screenshot({ path: `${dir}/08-menu-admin.png` });
  await k.goto('/kitchen/reports');
  await k.screenshot({ path: `${dir}/09-reports.png`, fullPage: true });
  await k.goto('/kitchen/settings');
  await k.screenshot({ path: `${dir}/10-settings.png` });
  expect(true).toBe(true);
});
