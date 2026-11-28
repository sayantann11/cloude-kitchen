// Inspect a finished MP4 the way a player sees it: duration, size, audio track length/level, sample frames.
import { chromium } from '@playwright/test'; import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
const file = path.resolve(process.argv[2]);
const b = await chromium.launch({ channel: 'msedge', args: ['--allow-file-access-from-files'] });
const p = await b.newPage();
const chk = path.join(path.dirname(file), '_verify.html');
fs.writeFileSync(chk, `<video id=v src="${path.basename(file)}" muted></video><canvas id=c width=270 height=480></canvas>`);
await p.goto(pathToFileURL(chk).href);
const info = await p.evaluate(async b64 => {
  const v = document.getElementById('v'); if (v.readyState < 1) await new Promise(r => v.onloadedmetadata = r);
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const ab = await new OfflineAudioContext(2, 48000, 48000).decodeAudioData(bytes.buffer);
  let pk = 0, rms = 0; const d = ab.getChannelData(0); for (let i = 0; i < d.length; i++) { pk = Math.max(pk, Math.abs(d[i])); rms += d[i] * d[i]; }
  const frames = [];
  for (const t of [1.5, 9, 14, 19, 23, 26.5, 29]) { await new Promise(r => { v.onseeked = r; v.currentTime = t; }); const c = document.getElementById('c'); c.getContext('2d').drawImage(v, 0, 0, 270, 480); frames.push(c.toDataURL('image/jpeg', 0.8)); }
  return { video: v.duration, size: v.videoWidth + 'x' + v.videoHeight, audio: ab.duration, audioPeak: +pk.toFixed(2), audioRms: +Math.sqrt(rms / d.length).toFixed(3), frames };
}, fs.readFileSync(file).toString('base64'));
info.frames.forEach((d, k) => fs.writeFileSync(path.resolve(`promo/out/stills/verify-${k}.jpg`), Buffer.from(d.split(',')[1], 'base64')));
delete info.frames; console.log(JSON.stringify(info));
await b.close(); fs.unlinkSync(chk);
