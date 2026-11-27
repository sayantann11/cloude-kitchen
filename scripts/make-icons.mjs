// Renders public/icons/icon.svg to PNGs with the locally installed Edge/Chrome (no extra downloads).
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const svg = await readFile(new URL('../public/icons/icon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' });
const page = await browser.newPage();
const out = [
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['icon-maskable-512.png', 512, 0.12], // safe-zone padding for Android masks
];
for (const [name, size, pad] of out) {
  await page.setViewportSize({ width: size, height: size });
  const inner = Math.round(size * (1 - pad * 2));
  await page.setContent(`<html><body style="margin:0;background:#0d5c50;display:grid;place-items:center;width:${size}px;height:${size}px">
    <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body></html>`);
  await page.screenshot({ path: new URL(`../public/icons/${name}`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), omitBackground: false });
  console.log('wrote', name);
}
await browser.close();
