// Render an animation page (render(t) on a 1080x1920 canvas) to stills or to an H.264 MP4.
//   node promo/render.mjs stills promo/opening.html 0.5 1.2 2.6 4 6
//   node promo/render.mjs video  promo/opening.html promo/out/opening.mp4 [fps]
// Encoding uses the browser's WebCodecs H.264 encoder + mp4-muxer (no ffmpeg needed).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const [mode, page_, ...rest] = process.argv.slice(2);
const pageUrl = pathToFileURL(path.resolve(page_)).href + '#export';
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto(pageUrl);
await page.waitForFunction(() => typeof window.render === 'function');
await page.evaluate(() => document.fonts.ready);

if (mode === 'stills') {
  const dir = path.resolve('promo/out/stills');
  fs.mkdirSync(dir, { recursive: true });
  for (const t of rest.map(Number)) {
    const data = await page.evaluate(tt => { window.render(tt); return document.getElementById('c').toDataURL('image/jpeg', 0.85); }, t);
    const file = path.join(dir, `${path.basename(page_, '.html')}-${t.toFixed(2)}s.jpg`);
    fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
    console.log(file);
  }
} else if (mode === 'video') {
  const out = path.resolve(rest[0]);
  const fps = Number(rest[1] || 30);
  await page.addScriptTag({ path: path.resolve('promo/node_modules/mp4-muxer/build/mp4-muxer.js') });
  const b64 = await page.evaluate(async fps => {
    const W = 1080, H = 1920, n = Math.round(window.DUR * fps);
    const cv = document.getElementById('c');
    let codec = 'avc1.640034';
    if (!(await VideoEncoder.isConfigSupported({ codec, width: W, height: H })).supported) codec = 'avc1.4d0034';
    const muxer = new Mp4Muxer.Muxer({ target: new Mp4Muxer.ArrayBufferTarget(), video: { codec: 'avc', width: W, height: H, frameRate: fps }, fastStart: 'in-memory' });
    let err = null;
    const enc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: e => { err = e; } });
    enc.configure({ codec, width: W, height: H, bitrate: 14_000_000, framerate: fps, latencyMode: 'quality' });
    for (let i = 0; i < n; i++) {
      window.render(i / fps);
      const f = new VideoFrame(cv, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
      enc.encode(f, { keyFrame: i % fps === 0 });
      f.close();
      while (enc.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 5));
      if (err) throw err;
    }
    await enc.flush();
    muxer.finalize();
    const buf = new Uint8Array(muxer.target.buffer);
    let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return { b64: btoa(s), codec, frames: n };
  }, fps);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(b64.b64, 'base64'));
  console.log(`${out}  ${b64.frames} frames @${fps}fps  codec ${b64.codec}  ${(fs.statSync(out).size / 1e6).toFixed(1)} MB`);
}
await browser.close();
