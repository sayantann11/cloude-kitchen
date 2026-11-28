import { chromium } from '@playwright/test';
import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
const file = pathToFileURL(path.resolve(process.argv[2])).href;
const b = await chromium.launch({ channel: 'msedge', args: ['--allow-file-access-from-files'] });
setTimeout(() => { console.log('timeout'); process.exit(1); }, 60000);
const p = await b.newPage();
const CHK = path.join(path.dirname(path.resolve(process.argv[2])), '_check.html');
fs.writeFileSync(CHK, `<video id=v src="${path.basename(process.argv[2])}" muted></video><canvas id=c width=270 height=480></canvas>`);
await p.goto(pathToFileURL(CHK).href);
const TIMES = (process.argv[4] || '0.3,1.9,4.6,5.95').split(',').map(Number);
const info = await p.evaluate(async (TIMES) => {
  const v = document.getElementById('v'); if (v.error) throw new Error('decode ' + v.error.message); if (v.readyState < 1) await new Promise((r, j) => { v.onloadedmetadata = r; v.onerror = () => j(new Error(v.error?.message)); });
  const out = { duration: v.duration, w: v.videoWidth, h: v.videoHeight, frames: [] };
  for (const t of TIMES) { await new Promise(r => { v.onseeked = r; v.currentTime = t; }); await new Promise(r => requestAnimationFrame(() => r())); const c = document.getElementById('c'); c.width = 360; c.height = Math.round(360 * v.videoHeight / v.videoWidth); c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); out.frames.push(c.toDataURL('image/jpeg', 0.8)); }
  return out;
}, TIMES);
info.frames.forEach((d, k) => fs.writeFileSync(process.argv[3].replace('.png', `-${k}.jpg`), Buffer.from(d.split(',')[1], 'base64')));
console.log(JSON.stringify({ duration: info.duration, size: `${info.w}x${info.h}` }));
await b.close(); process.exit(0);
