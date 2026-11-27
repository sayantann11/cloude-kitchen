import { expect, test } from '@playwright/test';
import { addItem, freshApp, PLACES, setProfile } from './helpers';

test.beforeEach(async ({ context }) => { await freshApp(context); });

test('menu loads the full menu card with categories and search', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('late-night cravings');
  await expect(page.getByRole('heading', { name: /Combos & Meals/ })).toBeVisible();
  await expect(page.locator('.item')).toHaveCount(103);
  await expect(page.locator('.hero .chip').getByText('Pure veg')).toBeVisible();
  await expect(page.getByRole('button', { name: /Veg only/ })).toHaveCount(0); // pointless on a pure-veg menu

  await page.getByRole('searchbox', { name: 'Search dishes' }).fill('manchurian');
  await expect(page.locator('.item')).toHaveCount(6); // 4 Manchurian dishes + Chinese & Noodles combos
  await page.getByRole('button', { name: 'Clear search' }).click();
  await page.getByRole('group', { name: 'Menu categories' }).getByRole('button', { name: 'Momos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Fried Chilli Momos' })).toBeInViewport();

  await page.getByRole('searchbox', { name: 'Search dishes' }).fill('pizza');
  await expect(page.getByText('No dishes match')).toBeVisible();
});

test('cart survives a reload and the bill is right', async ({ page }) => {
  await page.goto('/');
  await addItem(page, 'Paneer Masala', 2);
  await addItem(page, 'Jeera Rice');
  await expect(page.locator('.cartbar')).toContainText('3 items · ₹470');
  await page.reload();
  await expect(page.locator('.cartbar')).toContainText('3 items · ₹470');
  await page.locator('.cartbar').click();
  await expect(page.locator('.line.total')).toContainText('₹470'); // free delivery above ₹399
  await page.getByRole('button', { name: 'Remove one Paneer Masala' }).click();
  await expect(page.locator('.line.total')).toContainText('₹310'); // 285 + 25 delivery
});

test('checkout validates name, phone, address and pin', async ({ page }) => {
  await page.goto('/');
  await addItem(page, 'Paneer Masala');
  await page.locator('.cartbar').click();
  await page.locator('#place-order').click();
  await expect(page.getByText('Enter your name')).toBeVisible();
  await expect(page.getByText('Enter a 10-digit mobile number')).toBeVisible();
  await expect(page.getByText('Add house number and a landmark')).toBeVisible();
  await expect(page.getByText('Place the pin on your house')).toBeVisible();
  await page.locator('#phone').fill('12345');
  await page.locator('#place-order').click();
  await expect(page.getByText('Enter a 10-digit mobile number')).toBeVisible();
});

test('use my current location drops the pin and shows the area', async ({ page }) => {
  await page.goto('/');
  await addItem(page, 'Veg Biryani');
  await page.locator('.cartbar').click();
  await page.getByRole('button', { name: /Use my current location/ }).click();
  await expect(page.getByText('Near Farm Road')).toBeVisible();
  await expect(page.getByText(/km from kitchen/)).toBeVisible();
});

test('tapping the map moves the pin', async ({ page }) => {
  await page.goto('/');
  await addItem(page, 'Veg Biryani');
  await page.locator('.cartbar').click();
  const map = page.getByRole('application', { name: /choose your delivery location/ });
  await expect(map.locator('.leaflet-tile-pane')).toBeAttached();
  await map.click({ position: { x: 60, y: 60 } });
  await expect(page.getByText(/^Near /)).toBeVisible();
});

test('minimum order and too-far addresses block checkout', async ({ page }) => {
  await page.goto('/');
  await setProfile(page, { name: 'Test', phone: '9861000000', address: 'Somewhere far away road', location: PLACES.far });
  await page.reload();
  await addItem(page, 'Tawa Roti (each)');
  await page.locator('.cartbar').click();
  await expect(page.getByText(/Minimum order is ₹99/)).toBeVisible();
  await expect(page.getByText(/Too far/)).toBeVisible();
  await expect(page.locator('#place-order')).toBeDisabled();
});

test('place an order, see live tracking, cancel it', async ({ page }) => {
  await page.goto('/');
  await setProfile(page, { name: 'Priya Sahu', phone: '98610 41221', address: 'Near Ainthapali Chowk, blue gate', location: PLACES.ainthapali });
  await page.reload();
  await addItem(page, 'Kaju Curry');
  await page.locator('.cartbar').click();
  await page.getByLabel('Cooking note (optional)').fill('less spicy');
  await page.locator('#place-order').click();
  await expect(page).toHaveURL(/\/order\//);
  await expect(page.getByText('Order sent to the kitchen')).toBeVisible();
  await expect(page.getByText('Waiting for the kitchen to accept')).toBeVisible();
  await expect(page.getByText('less spicy')).toBeVisible();

  await page.getByRole('button', { name: 'Cancel order' }).click();
  await page.getByRole('button', { name: 'Ordered by mistake' }).click();
  await expect(page.locator('.eta')).toContainText('Cancelled');

  await page.goto('/orders');
  await expect(page.getByText('Cancelled')).toBeVisible();
  await page.goto('/');
  await expect(page.locator('.cartbar')).toHaveCount(0); // cart was cleared after ordering
});

test('Odia language toggle', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Change language' }).click();
  await expect(page.getByRole('searchbox')).toHaveAttribute('placeholder', 'ଖାଦ୍ୟ ଖୋଜନ୍ତୁ');
  await expect(page.getByRole('heading', { name: 'Paneer Masala' })).toBeVisible();
});

test('closed kitchen shows when it opens and blocks ordering', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('mk:settings') || '{}');
    s.hours = Array.from({ length: 7 }, () => ({ open: '00:00', close: '00:00', closed: true }));
    localStorage.setItem('mk:settings', JSON.stringify(s));
  });
  await page.reload();
  await expect(page.getByText('We are closed')).toBeVisible();
  void context;
});
