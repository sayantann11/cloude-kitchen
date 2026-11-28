// Contact sheet of stills: node promo/sheet.mjs out.png a.jpg b.jpg ...
import { chromium } from '@playwright/test'; import fs from 'node:fs';
const [out, ...files] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'msedge' }); const p = await b.newPage({ viewport: { width: 250 * files.length + 10, height: 560 } });
await p.setContent(`<body style="margin:0;background:#111;display:flex;gap:6px;padding:5px">${files.map(f => `<img style="width:244px" src="data:image/jpeg;base64,${fs.readFileSync(f).toString('base64')}">`).join('')}</body>`);
await p.screenshot({ path: out }); await b.close();
