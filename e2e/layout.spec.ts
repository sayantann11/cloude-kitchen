import { expect, test } from '@playwright/test';
import { freshApp, kitchenLogin, PLACES, placeOrder } from './helpers';

test.beforeEach(async ({ context }) => { await freshApp(context); });

async function noSideScroll(page: import('@playwright/test').Page, where: string) {
  const { sw, w } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
  expect(sw, `${where} is wider than the phone screen`).toBeLessThanOrEqual(w + 1);
  // Nothing inside main may poke past the right edge either.
  const over = await page.evaluate(() => Array.from(document.querySelectorAll('main *')).filter(el => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.right > window.innerWidth + 1 && !el.closest('.scroll-x, .cats, .k-tabs, .leaflet-container');
  }).map(el => el.tagName + '.' + el.className).slice(0, 5));
  expect(over, `${where} has elements past the screen edge`).toEqual([]);
}

test('every screen fits a phone without sideways scrolling', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('/');
  await noSideScroll(page, 'menu');
  const o = await placeOrder(page, { name: 'Layout Test', phone: '9000022222', address: 'Farm Road lane 2, house 5', location: PLACES.farmRoad, items: [['Paneer Masala', 1]] });
  await noSideScroll(page, 'tracking');
  await page.goto('/orders');
  await noSideScroll(page, 'my orders');
  await page.getByRole('link', { name: /Layout|Paneer Masala/ }).first().click();
  await page.goto('/');
  await page.getByRole('button', { name: /^Add Veg Biryani/ }).click();
  await page.goto('/checkout');
  await noSideScroll(page, 'checkout');

  await kitchenLogin(page);
  await noSideScroll(page, 'kitchen orders');
  for (const tab of ['trips', 'menu', 'reports', 'settings']) {
    await page.goto(`/admin/${tab}`);
    await page.waitForLoadState('networkidle');
    await noSideScroll(page, `kitchen ${tab}`);
  }
  void o;
});
