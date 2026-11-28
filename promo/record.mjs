// Records the 4 feature clips from the running app (demo mode, seeded data) at phone size.
//   1) npm run dev   (app on http://localhost:5173)
//   2) node promo/record.mjs            -> promo/out/clips/0N-*.mp4  (1080x2340, 30fps)
// Uses Chrome's screencast (every repaint, as JPEG) + WebCodecs H.264. Nothing touches Firebase: every URL has ?demo.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import { buildSeed, newOrder } from './seed-demo.mjs';

const APP = process.env.APP_URL || 'http://localhost:5173';
const FPS = 30, OUT = path.resolve('promo/out/clips');
const NOW = Date.parse('2026-11-28T22:10:00+05:30'); // a busy Friday-night moment
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge', args: ['--allow-file-access-from-files'] });
const ctx = await browser.newContext({
  viewport: { width: 360, height: 780 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  timezoneId: 'Asia/Kolkata', locale: 'en-IN', colorScheme: 'dark',
});
await ctx.clock.install({ time: NOW });
const seed = buildSeed(NOW);
await ctx.addInitScript(([seed]) => {
  if (!localStorage.getItem('promo-seeded')) { for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); localStorage.setItem('promo-seeded', '1'); }
  sessionStorage.setItem('mk:sound', '1'); // hide the "turn on sound" bar
  // soft tap ripple so viewers see where the finger lands
  addEventListener('pointerdown', e => {
    const d = document.createElement('div');
    d.style.cssText = `position:fixed;left:${e.clientX - 22}px;top:${e.clientY - 22}px;width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.35);border:2px solid rgba(255,255,255,.8);pointer-events:none;z-index:99999;transform:scale(.4);opacity:1;transition:transform .45s ease-out,opacity .45s ease-out`;
    document.documentElement.appendChild(d);
    requestAnimationFrame(() => { d.style.transform = 'scale(1.6)'; d.style.opacity = '0'; });
    setTimeout(() => d.remove(), 600);
  }, true);
  // no blinking caret or scrollbars in the recording
  addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '::-webkit-scrollbar{display:none} *{scrollbar-width:none} input{caret-color:transparent}'; document.head.appendChild(s); });
}, [seed]);

const page = await ctx.newPage();
const helper = await ctx.newPage(); // same-origin tab that drops new orders into the demo store
await helper.goto(`${APP}/robots.txt`);
await page.bringToFront();
const encoderPage = await browser.newPage();
await encoderPage.goto(pathToFileURL(path.resolve('promo/encoder.html')).href);

const pause = ms => page.waitForTimeout(ms);
async function tap(locator) {
  // keep the target clear of the fixed top bar and bottom nav
  const b0 = await locator.boundingBox();
  if (!b0 || b0.y < 120 || b0.y + b0.height > 780 - 110) { await locator.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'smooth' })); await page.waitForTimeout(450); }
  const b = await locator.boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
}
async function dropOrder(i) {
  const now = await helper.evaluate(() => Date.now());
  const o = newOrder(now, i);
  await helper.evaluate(o => { const all = JSON.parse(localStorage.getItem('mk:orders') || '{}'); all[o.id] = o; localStorage.setItem('mk:orders', JSON.stringify(all)); }, o);
  return o;
}
async function smoothScroll(dy, ms) {
  const steps = Math.round(ms / 16);
  for (let k = 1; k <= steps; k++) {
    const u = k / steps, e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    await page.evaluate(y => window.scrollTo(0, y), Math.round(startY + dy * e));
    await page.waitForTimeout(16);
  }
}
let startY = 0;

async function record(name, action) {
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', async e => {
    frames.push({ t: e.metadata.timestamp, data: e.data });
    cdp.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(() => {});
  });
  const first = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92 });
  const t0 = Date.now() / 1000;
  frames.push({ t: t0, data: first.data });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1080, maxHeight: 2340, everyNthFrame: 1 });
  await action();
  const t1 = Date.now() / 1000;
  await cdp.send('Page.stopScreencast');
  await cdp.detach();

  // constant 30fps: each output frame shows the latest repaint at that moment
  frames.sort((a, b) => a.t - b.t);
  const n = Math.round((t1 - t0) * FPS);
  const runs = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const tk = t0 + k / FPS;
    while (j + 1 < frames.length && frames[j + 1].t <= tk) j++;
    if (runs.length && runs[runs.length - 1].j === j) runs[runs.length - 1].repeat++;
    else runs.push({ j, repeat: 1 });
  }
  const codec = await encoderPage.evaluate(([w, h, fps]) => window.encInit(w, h, fps), [1080, 2340, FPS]);
  for (const r of runs) await encoderPage.evaluate(([b64, rep]) => window.encFrame(b64, rep), [frames[r.j].data, r.repeat]);
  const b64 = await encoderPage.evaluate(() => window.encFinish());
  const file = path.join(OUT, `${name}.mp4`);
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  console.log(`${file}  ${(n / FPS).toFixed(2)}s  ${frames.length} repaints  ${codec}  ${(fs.statSync(file).size / 1e6).toFixed(1)} MB`);
}

// ---------- 1. Orders coming in ----------
await page.goto(`${APP}/admin?demo`);
await page.getByRole('heading', { name: /New orders/ }).waitFor();
await pause(1500);
const incoming = [];
await record('01-orders-coming-in', async () => {
  await pause(700);
  for (let i = 0; i < 3; i++) { incoming.push(await dropOrder(i)); await pause(1450); }
  await pause(500);
});

// ---------- 2. Kitchen queue / status updates ----------
await record('02-kitchen-queue', async () => {
  await pause(500);
  await tap(page.locator(`#accept-${incoming[0].code}`)); await pause(750);
  await tap(page.locator(`#accept-${incoming[1].code}`)); await pause(750);
  await tap(page.locator('.board-tabs button', { hasText: 'Cooking' })); await pause(1100);
  await tap(page.locator(`#ready-${incoming[0].code}`)); await pause(900);
  await tap(page.locator('.board-tabs button', { hasText: 'Send out' })); await pause(1700);
});

// ---------- 3. Stock + low-stock alert ----------
await page.goto(`${APP}/admin/menu?demo`);
await page.getByText(/dishes ·/).waitFor();
await page.evaluate(() => { const el = document.querySelector('.segtabs'); window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 150); });
await pause(1200);
await record('03-stock-low-alert', async () => {
  await pause(600);
  await tap(page.getByRole('button', { name: /^Low stock/ })); await pause(1300);
  const momos = page.getByRole('spinbutton', { name: 'Stock of Veg Fried Momos' });
  await tap(momos); await pause(250);
  await momos.fill('');
  await momos.pressSequentially('25', { delay: 160 }); await pause(300);
  await momos.press('Enter'); await pause(1700);
});

// ---------- 4. Today's sales dashboard ----------
await page.goto(`${APP}/admin/reports?demo`);
await page.getByText('Delivered orders').waitFor();
await pause(1500);
await record('04-sales-dashboard', async () => {
  await pause(1100);
  startY = 0; await smoothScroll(560, 1500);
  await pause(900);
  startY = 560; await smoothScroll(520, 1300);
  await pause(800);
});

await browser.close();
