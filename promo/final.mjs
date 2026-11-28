// Final 30s edit.
//   node promo/final.mjs stills 3 7 12 ...   -> promo/out/stills/final-XXs.jpg
//   node promo/final.mjs video               -> promo/out/StackForge-promo-30s.mp4
// Needs: promo/out/01-opening (drawn live), promo/out/clips/*.mp4 (record.mjs), promo/out/vo/*.wav (vo.ps1).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const [mode, ...rest] = process.argv.slice(2);
const root = path.resolve('promo');
const vo = JSON.parse(fs.readFileSync(path.join(root, 'vo.json'), 'utf8')).lines
  .map(l => ({ ...l, wavB64: fs.readFileSync(path.join(root, 'out/vo', `${l.id}.wav`)).toString('base64') }));

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge', args: ['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('pageerror', e => console.error('page error:', e.message));
await page.goto(pathToFileURL(path.join(root, 'composer.html')).href + '#export');
await page.waitForFunction(() => typeof window.compose === 'function' && typeof window.renderEnd === 'function');
await page.evaluate(() => document.fonts.ready);
console.log('clips', await page.evaluate(() => window.loadClips()));
console.log('voice', JSON.stringify(await page.evaluate(v => window.setupVO(v), vo)));

if (mode === 'stills') {
  const dir = path.join(root, 'out/stills'); fs.mkdirSync(dir, { recursive: true });
  for (const t of rest.map(Number)) {
    const d = await page.evaluate(tt => window.stillJpeg(tt), t);
    const f = path.join(dir, `final-${t.toFixed(2)}s.jpg`);
    fs.writeFileSync(f, Buffer.from(d.split(',')[1], 'base64'));
  }
  console.log('stills done');
} else {
  const t0 = Date.now();
  const r = await page.evaluate(() => window.renderAll());
  const out = path.join(root, 'out/StackForge-promo-30s.mp4');
  fs.writeFileSync(out, Buffer.from(r.mp4, 'base64'));
  console.log(`${out}  ${r.frames} frames  ${r.codec}  audio peak ${r.peak.toFixed(2)}  ${(fs.statSync(out).size / 1e6).toFixed(1)} MB  in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
await browser.close();
