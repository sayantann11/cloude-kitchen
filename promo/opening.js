// Opening shot, fully procedural (original art, no brands). render(t) draws the frame at t seconds.
// World = 1080x1920. A camera pushes in slowly, the phone buzzes 3 times, then the camera dives into the phone.
const W = 1080, H = 1920, DUR = 6;
const cv = document.getElementById('c');
const main = cv.getContext('2d');
const off = document.createElement('canvas'); off.width = W; off.height = H;
const offCtx = off.getContext('2d');
let g = main; // current drawing context (scene goes to an offscreen canvas so it can be blurred)

// ---------- helpers ----------
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, u) => a + (b - a) * u;
const easeIO = u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const easeOut = u => 1 - Math.pow(1 - u, 3);
const spring = u => (u <= 0 ? 0 : u >= 1 ? 1 : 1 - Math.exp(-6 * u) * Math.cos(10 * u));
function rng(seed) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); }
function rr(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
const FONT = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';

// ---------- static scene data (seeded) ----------
const R = rng(7);
const stars = Array.from({ length: 140 }, () => ({ x: R() * W, y: R() * 760, r: R() * 2 + 0.6, p: R() * 6 }));
function skyline(seed, yBase, minH, maxH, wMin, wMax) {
  const r = rng(seed), out = [];
  for (let x = -40; x < W + 40;) {
    const w = lerp(wMin, wMax, r()), h = lerp(minH, maxH, r());
    const win = [];
    for (let wy = yBase - h + 18; wy < yBase - 14; wy += 22)
      for (let wx = x + 10; wx < x + w - 12; wx += 18) if (r() < 0.38) win.push({ x: wx, y: wy, c: r() < 0.5 ? '#3ef2ff' : r() < 0.7 ? '#ff4fd8' : '#ffd36e', f: r() * 10 });
    out.push({ x, w, h, win, ant: r() < 0.25 });
    x += w + lerp(4, 18, r());
  }
  return out;
}
const far = skyline(11, 1080, 140, 420, 50, 110);
const mid = skyline(23, 1210, 220, 560, 90, 170);
const rain = Array.from({ length: 170 }, () => ({ x: R() * (W + 300) - 150, y: R() * H, s: 1500 + R() * 900, l: 26 + R() * 40 }));

// ---------- camera ----------
const PHONE = { x: 648, y: 1300, w: 56, h: 110 };   // phone screen centre in world space
const ZOOM_START = 2.75, S_END = 14.6;
function camera(t) {
  const F0 = { x: 540, y: 980 };
  if (t < ZOOM_START) {
    const s = 1 + 0.045 * easeIO(clamp(t / ZOOM_START));
    return { s, F: F0, u: 0 };
  }
  const u = easeIO(clamp((t - ZOOM_START) / (DUR - ZOOM_START)));
  const s0 = 1.045;
  const s = Math.exp(lerp(Math.log(s0), Math.log(S_END), u));
  return { s, F: { x: lerp(F0.x, PHONE.x, u), y: lerp(F0.y, PHONE.y, u) }, u };
}
function applyCam(cam, depth) {
  // depth 0 = far background (moves less), 1 = foreground
  const s = 1 + (cam.s - 1) * depth;
  g.setTransform(s, 0, 0, s, W / 2 - s * cam.F.x, 960 - s * cam.F.y + (960 - 960));
}

// ---------- ending (25–27.6s of the final cut): he grins and tosses the phone ----------
let ENDK = null; // { k: toss progress 0..1, grin: 0..1 } while rendering the ending
function endPose(k) {
  if (k < 0.3) { const q = k / 0.3; return { x: 648 - 10 * q, y: 1300 + 25 * Math.sin(q * Math.PI) - 60 * q * q, rot: -0.25 * q, scale: 1, flying: false }; }
  const p = (k - 0.3) / 0.7;
  return { x: 638 - 170 * p, y: 1240 - 560 * p - 220 * p * p, rot: -0.25 - 4 * Math.PI * p, scale: 1 + 0.6 * p, flying: true };
}
// person() is drawn tilted around the feet; convert a world point into that tilted frame
function toLocal(pt) { const a = 0.07, dx = pt.x - 700, dy = pt.y - 1565; return { x: 700 + dx * Math.cos(a) - dy * Math.sin(a), y: 1565 + dx * Math.sin(a) + dy * Math.cos(a) }; }

// buzz times
const BUZZ = [0.85, 1.6, 2.3];
const ORDERS = [
  { n: 1042, amt: 349, items: 2, area: 'Farm Road' },
  { n: 1043, amt: 518, items: 3, area: 'Ainthapali' },
  { n: 1044, amt: 289, items: 1, area: 'Modipara' },
];
function buzzShake(t) {
  let a = 0;
  for (const b of BUZZ) { const d = t - b; if (d > 0 && d < 0.35) a += Math.sin(d * 90) * (1 - d / 0.35); }
  return a;
}

// ---------- layers ----------
function sky(t) {
  const gr = g.createLinearGradient(0, 0, 0, 1250);
  gr.addColorStop(0, '#07021a'); gr.addColorStop(0.45, '#1d0942'); gr.addColorStop(0.75, '#5a1166'); gr.addColorStop(1, '#ff2f7a');
  g.fillStyle = gr; g.fillRect(-2000, -2000, W + 4000, 3300);
  for (const s of stars) { g.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.7 + s.p)); g.fillStyle = '#fff'; g.beginPath(); g.arc(s.x, s.y, s.r, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  // synthwave sun with stripes
  const cx = 540, cy = 860, r = 270;
  const sg = g.createLinearGradient(0, cy - r, 0, cy + r);
  sg.addColorStop(0, '#ffe66d'); sg.addColorStop(0.5, '#ff8a3d'); sg.addColorStop(1, '#ff2f7a');
  g.save(); g.shadowColor = '#ff6a8a'; g.shadowBlur = 80; g.fillStyle = sg; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); g.restore();
  g.fillStyle = '#4a0f5f';
  for (let i = 0; i < 9; i++) { const y = cy + 20 + i * 30 + ((t * 18) % 30); const hgt = 3 + i * 1.6; g.globalAlpha = 0.85; g.fillRect(cx - r, y, r * 2, hgt); }
  g.globalAlpha = 1;
}
function buildings(list, yBase, fill, edge, t) {
  for (const b of list) {
    g.fillStyle = fill; g.fillRect(b.x, yBase - b.h, b.w, b.h + 400);
    g.strokeStyle = edge; g.globalAlpha = 0.35; g.lineWidth = 2; g.strokeRect(b.x, yBase - b.h, b.w, b.h + 400); g.globalAlpha = 1;
    if (b.ant) { g.fillStyle = '#ff3b6b'; g.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4 + b.x); g.fillRect(b.x + b.w / 2 - 2, yBase - b.h - 40, 4, 40); g.beginPath(); g.arc(b.x + b.w / 2, yBase - b.h - 42, 5, 0, 7); g.fill(); g.globalAlpha = 1; }
    for (const w of b.win) { g.fillStyle = w.c; g.globalAlpha = 0.45 + 0.4 * (Math.sin(t * 0.8 + w.f) > -0.7 ? 1 : 0.2); g.fillRect(w.x, w.y, 8, 11); }
    g.globalAlpha = 1;
  }
}
function neonText(txt, x, y, size, color, t, flick = 0) {
  const on = flick ? (Math.sin(t * 23) > -0.8 || (t % 3) > 0.2 ? 1 : 0.25) : 1;
  g.save(); g.font = `900 ${size}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.globalAlpha = on; g.shadowColor = color; g.shadowBlur = 40; g.fillStyle = color; g.fillText(txt, x, y);
  g.shadowBlur = 12; g.fillStyle = '#fff'; g.globalAlpha = on * 0.85; g.fillText(txt, x, y); g.restore();
}
function steam(x0, y0, t, n, spread, rise, size) {
  for (let i = 0; i < n; i++) {
    const life = 2.6, a = ((t + i * (life / n)) % life), k = a / life;
    const x = x0 + Math.sin(a * 2.1 + i * 1.7) * spread * (0.3 + k), y = y0 - a * rise;
    const r = size * (0.5 + k * 1.8);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(255,240,255,${0.22 * (1 - k)})`); gr.addColorStop(1, 'rgba(255,240,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
}
function kitchen(t) {
  // building
  g.fillStyle = '#170a2c'; g.fillRect(40, 860, 640, 640);
  g.strokeStyle = '#ff4fd8'; g.lineWidth = 3; g.globalAlpha = 0.5; g.strokeRect(40, 860, 640, 640); g.globalAlpha = 1;
  // chimney + vent steam
  g.fillStyle = '#22103d'; g.fillRect(520, 780, 60, 90);
  // awning
  g.fillStyle = '#2a0f45'; g.beginPath(); g.moveTo(60, 1120); g.lineTo(660, 1120); g.lineTo(690, 1185); g.lineTo(30, 1185); g.closePath(); g.fill();
  for (let i = 0; i < 11; i++) { g.fillStyle = i % 2 ? '#ff2f7a' : '#3ef2ff'; g.globalAlpha = 0.55; g.fillRect(35 + i * 60, 1170, 60, 15); }
  g.globalAlpha = 1;
  // shop window, warm light
  const wg = g.createLinearGradient(0, 1200, 0, 1440);
  wg.addColorStop(0, '#ffb35c'); wg.addColorStop(1, '#ff6a3d');
  g.save(); g.shadowColor = '#ff8a3d'; g.shadowBlur = 70; g.fillStyle = wg; g.fillRect(80, 1205, 560, 235); g.restore();
  // kitchen interior silhouettes: cook, pots, flame
  g.fillStyle = 'rgba(60,15,30,0.85)';
  g.fillRect(80, 1370, 560, 70); // counter
  const bob = Math.sin(t * 5) * 4;
  g.beginPath(); g.arc(250, 1268 + bob, 26, 0, 7); g.fill();                 // cook head
  g.beginPath(); g.ellipse(250, 1240 + bob, 30, 16, 0, Math.PI, 0); g.fill(); // chef hat
  g.fillRect(222, 1290 + bob, 56, 80);                                         // cook body
  g.save(); g.translate(300, 1320 + bob); g.rotate(-0.6 + Math.sin(t * 6) * 0.25); g.fillRect(0, -6, 70, 12); g.restore(); // arm with pan
  g.fillRect(380, 1335, 90, 35); g.fillRect(500, 1325, 80, 45);                // pots
  for (let i = 0; i < 3; i++) { // flames
    const fx = 420 + i * 18, fh = 22 + Math.sin(t * 20 + i) * 8;
    g.fillStyle = '#3ef2ff'; g.globalAlpha = 0.9; g.beginPath(); g.moveTo(fx - 7, 1372); g.quadraticCurveTo(fx, 1372 - fh * 2, fx + 7, 1372); g.fill();
  }
  g.globalAlpha = 1;
  // window frame
  g.strokeStyle = '#2a0f45'; g.lineWidth = 10; g.strokeRect(80, 1205, 560, 235); g.beginPath(); g.moveTo(360, 1205); g.lineTo(360, 1440); g.stroke();
  // door
  g.fillStyle = '#0f0620'; g.fillRect(560, 1250, 0, 0);
  // signs
  neonText('CLOUD KITCHEN', 360, 960, 74, '#ff4fd8', t, 1);
  neonText('OPEN 24/7', 360, 1045, 46, '#3ef2ff', t);
  // steam: vent + window top
  steam(550, 780, t, 9, 26, 150, 46);
  steam(250, 1205, t + 0.7, 7, 40, 120, 40);
  steam(500, 1210, t + 1.3, 6, 30, 110, 36);
}
function street(t) {
  const gg = g.createLinearGradient(0, 1480, 0, 1920);
  gg.addColorStop(0, '#12052a'); gg.addColorStop(1, '#05010d');
  g.fillStyle = gg; g.fillRect(-2000, 1480, W + 4000, 1400);
  // pavement edge glow
  g.fillStyle = '#ff2f7a'; g.globalAlpha = 0.7; g.fillRect(-2000, 1478, W + 4000, 5); g.globalAlpha = 1;
  // perspective grid on the road
  const vx = 540, vy = 1300;
  g.strokeStyle = '#ff2f9a'; g.lineWidth = 2;
  for (let i = -14; i <= 14; i++) { g.globalAlpha = 0.28; g.beginPath(); g.moveTo(vx + i * 30, 1483); g.lineTo(vx + i * 220, 2100); g.stroke(); }
  for (let k = 0; k < 14; k++) {
    const z = ((k + (t * 0.9) % 1) / 14); const y = 1483 + Math.pow(z, 2.2) * 620;
    g.globalAlpha = 0.12 + 0.3 * z; g.beginPath(); g.moveTo(-2000, y); g.lineTo(W + 2000, y); g.stroke();
  }
  g.globalAlpha = 1;
  // wet reflections of the signs
  for (const [x, c, a] of [[360, '#ff4fd8', 0.35], [360, '#ffb35c', 0.3], [820, '#3ef2ff', 0.25]]) {
    g.save(); g.translate(x + Math.sin(t * 2 + x) * 6, 1490); g.scale(1, 2.6);
    const rg = g.createRadialGradient(0, 0, 0, 0, 0, 190);
    rg.addColorStop(0, c); rg.addColorStop(1, c + '00');
    g.globalAlpha = a; g.fillStyle = rg; g.beginPath(); g.arc(0, 0, 190, 0, Math.PI); g.fill(); g.restore();
  }
}
function scooter(t) {
  g.save();
  // wheels
  for (const wx of [600, 930]) {
    g.fillStyle = '#05010d'; g.beginPath(); g.arc(wx, 1560, 52, 0, 7); g.fill();
    g.strokeStyle = '#3ef2ff'; g.lineWidth = 5; g.shadowColor = '#3ef2ff'; g.shadowBlur = 18; g.beginPath(); g.arc(wx, 1560, 46, 0, 7); g.stroke();
    g.shadowBlur = 0; g.fillStyle = '#2b2440'; g.beginPath(); g.arc(wx, 1560, 16, 0, 7); g.fill();
  }
  // body
  g.fillStyle = '#16c3c9';
  g.beginPath(); g.moveTo(640, 1545); g.quadraticCurveTo(700, 1450, 820, 1455); g.lineTo(960, 1460); g.quadraticCurveTo(1000, 1500, 975, 1550); g.lineTo(640, 1550); g.closePath(); g.fill();
  g.fillStyle = '#0d8c96'; g.fillRect(660, 1520, 300, 26);
  // front column + handlebar
  g.strokeStyle = '#16c3c9'; g.lineWidth = 22; g.lineCap = 'round';
  g.beginPath(); g.moveTo(615, 1530); g.lineTo(570, 1370); g.stroke();
  g.strokeStyle = '#1b1530'; g.lineWidth = 12; g.beginPath(); g.moveTo(540, 1360); g.lineTo(610, 1372); g.stroke();
  g.fillStyle = '#ffe66d'; g.shadowColor = '#ffe66d'; g.shadowBlur = 30; g.beginPath(); g.ellipse(572, 1400, 14, 18, 0, 0, 7); g.fill(); g.shadowBlur = 0;
  // seat
  g.fillStyle = '#1b1530'; rr(780, 1430, 170, 30, 14); g.fill();
  // delivery box (no logo, just a neon stripe)
  g.fillStyle = '#ff2f7a'; rr(860, 1270, 170, 165, 16); g.fill();
  g.fillStyle = '#c21a5c'; g.fillRect(860, 1300, 170, 14);
  g.fillStyle = '#ffe66d'; g.globalAlpha = 0.9; g.fillRect(880, 1370, 130, 8); g.globalAlpha = 1;
  g.restore();
}
function person(t) {
  const breathe = Math.sin(t * 2.2) * 2.5;
  const E = ENDK;
  const glance = E ? 0 : clamp((t - 0.9) / 0.4); // looks down at phone after first buzz
  g.save();
  g.translate(700, 1565); g.rotate(-0.07); g.translate(-700, -1565);
  // legs (crossed, leaning)
  g.fillStyle = '#1a2340';
  g.beginPath(); g.moveTo(668, 1410); g.lineTo(712, 1410); g.lineTo(735, 1560); g.lineTo(705, 1562); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(705, 1410); g.lineTo(748, 1410); g.lineTo(690, 1560); g.lineTo(660, 1558); g.closePath(); g.fill();
  g.fillStyle = '#f2f2f7'; rr(650, 1548, 56, 22, 9); g.fill(); rr(700, 1550, 58, 22, 9); g.fill();
  // torso (t-shirt)
  g.fillStyle = '#0e3b4a';
  g.beginPath(); g.moveTo(645, 1255 + breathe); g.quadraticCurveTo(708, 1225 + breathe, 770, 1255 + breathe); g.lineTo(760, 1420); g.lineTo(655, 1420); g.closePath(); g.fill();
  // apron
  g.fillStyle = '#f4a261';
  g.beginPath(); g.moveTo(668, 1278 + breathe); g.lineTo(748, 1278 + breathe); g.lineTo(758, 1470); g.quadraticCurveTo(708, 1482, 658, 1470); g.closePath(); g.fill();
  g.strokeStyle = '#f4a261'; g.lineWidth = 6; g.beginPath(); g.moveTo(672, 1280 + breathe); g.lineTo(690, 1238 + breathe); g.moveTo(744, 1280 + breathe); g.lineTo(726, 1238 + breathe); g.stroke();
  g.fillStyle = '#e07b39'; rr(684, 1380, 48, 34, 6); g.fill(); // pocket
  // back arm resting on the seat
  g.strokeStyle = '#0e3b4a'; g.lineWidth = 30; g.lineCap = 'round';
  g.beginPath(); g.moveTo(765, 1275 + breathe); g.lineTo(800, 1370); g.stroke();
  g.strokeStyle = '#a86a45'; g.lineWidth = 24; g.beginPath(); g.moveTo(800, 1370); g.lineTo(820, 1432); g.stroke();
  // neck + head
  g.fillStyle = '#a86a45'; g.fillRect(694, 1205 + breathe, 28, 34);
  const hx = 708 + glance * -6, hy = 1175 + breathe + glance * 6;
  g.beginPath(); g.ellipse(hx, hy, 44, 52, glance * -0.15, 0, 7); g.fill();
  // phone glow on the face
  const fg = g.createRadialGradient(hx - 30, hy + 30, 0, hx - 30, hy + 30, 90);
  fg.addColorStop(0, 'rgba(90,240,255,0.55)'); fg.addColorStop(1, 'rgba(90,240,255,0)');
  g.fillStyle = fg; g.beginPath(); g.ellipse(hx, hy, 44, 52, 0, 0, 7); g.fill();
  // hair
  g.fillStyle = '#140b1c';
  g.beginPath(); g.ellipse(hx + 4, hy - 30, 50, 30, 0.1, Math.PI * 0.95, Math.PI * 2.05); g.fill();
  g.beginPath(); g.moveTo(hx - 46, hy - 24); g.quadraticCurveTo(hx - 10, hy - 70, hx + 40, hy - 52); g.quadraticCurveTo(hx + 10, hy - 34, hx - 46, hy - 24); g.fill();
  // ear
  g.fillStyle = '#9a5f3d'; g.beginPath(); g.ellipse(hx + 40, hy + 4, 8, 13, 0, 0, 7); g.fill();
  g.strokeStyle = '#1a0d14'; g.lineWidth = 4; g.lineCap = 'round';
  const ey = hy - 2 + glance * 4;
  if (E && E.grin > 0.2) {
    // happy closed eyes + big open grin
    g.beginPath(); g.arc(hx - 18, ey + 4, 7, Math.PI * 1.1, Math.PI * 1.9); g.moveTo(hx + 19, ey + 4); g.arc(hx + 12, ey + 4, 7, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    g.fillStyle = '#3a0d18'; g.beginPath(); g.moveTo(hx - 22, hy + 14); g.quadraticCurveTo(hx - 4, hy + 14 - 2, hx + 16, hy + 14); g.quadraticCurveTo(hx - 3, hy + 14 + 30 * E.grin, hx - 22, hy + 14); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(hx - 19, hy + 15); g.lineTo(hx + 13, hy + 15); g.lineTo(hx + 10, hy + 21); g.lineTo(hx - 16, hy + 21); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,90,120,0.25)'; g.beginPath(); g.arc(hx - 30, hy + 12, 9, 0, 7); g.arc(hx + 26, hy + 12, 9, 0, 7); g.fill(); // blush
  } else {
    g.beginPath(); g.moveTo(hx - 24, ey); g.lineTo(hx - 12, ey + glance * 2); g.moveTo(hx + 6, ey); g.lineTo(hx + 18, ey + glance * 2); g.stroke();
    g.lineWidth = 3.5; g.beginPath(); g.arc(hx - 4, hy + 22, 12, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  }
  if (E) {
    // arm follows the phone, then flies up after the throw
    const P = endPose(E.k);
    let hand = toLocal({ x: P.x - 6, y: P.y + 42 });
    if (P.flying) { const q = easeOut(clamp((E.k - 0.3) / 0.18)); hand = { x: lerp(hand.x, 596, q), y: lerp(hand.y, 1105, q) }; }
    const S = { x: 660, y: 1272 + breathe };
    const El = { x: (S.x + hand.x) / 2 - 34, y: (S.y + hand.y) / 2 + 22 };
    g.strokeStyle = '#0e3b4a'; g.lineWidth = 30; g.lineCap = 'round';
    g.beginPath(); g.moveTo(S.x, S.y); g.lineTo(lerp(S.x, El.x, 0.75), lerp(S.y, El.y, 0.75)); g.stroke();
    g.strokeStyle = '#a86a45'; g.lineWidth = 22;
    g.beginPath(); g.moveTo(lerp(S.x, El.x, 0.7), lerp(S.y, El.y, 0.7)); g.lineTo(El.x, El.y); g.lineTo(hand.x, hand.y); g.stroke();
    if (P.flying) { g.fillStyle = '#a86a45'; g.beginPath(); g.ellipse(hand.x, hand.y - 8, 14, 18, -0.3, 0, 7); g.fill(); } // open hand
  } else {
    // front arm: shoulder -> elbow (sleeve) -> forearm up to the phone
    g.strokeStyle = '#0e3b4a'; g.lineWidth = 30; g.lineCap = 'round';
    g.beginPath(); g.moveTo(660, 1272 + breathe); g.lineTo(628, 1335); g.stroke();
    g.strokeStyle = '#a86a45'; g.lineWidth = 22;
    g.beginPath(); g.moveTo(626, 1338); g.quadraticCurveTo(606, 1392, 640, 1372); g.stroke();
  }
  g.restore();
}
function phone(t, cam) {
  const sh = ENDK ? 0 : buzzShake(t) * (1 - cam.u);
  const { x, y, w, h } = PHONE;
  const pose = ENDK ? endPose(ENDK.k) : null;
  g.save();
  if (pose) {
    // motion trail while it flies
    if (pose.flying) for (let k = 1; k <= 5; k++) { const q = endPose(Math.max(0.3, ENDK.k - k * 0.025)); g.save(); g.globalAlpha = 0.12 * (6 - k) / 5; g.translate(q.x, q.y); g.rotate(q.rot); g.scale(q.scale, q.scale); g.fillStyle = '#5af0ff'; rr(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 9); g.fill(); g.restore(); }
    g.translate(pose.x, pose.y); g.rotate(pose.rot); g.scale(pose.scale, pose.scale);
  } else { g.translate(x, y); g.rotate(sh * 0.06); g.translate(sh * 1.5, 0); }
  // vibration marks
  if (Math.abs(sh) > 0.15 && cam.u < 0.2) {
    g.strokeStyle = '#ffffff'; g.globalAlpha = 0.7 * Math.abs(sh); g.lineWidth = 2.5;
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(sx * (w / 2 + 8 + k * 7), -14 + k * 14); g.lineTo(sx * (w / 2 + 14 + k * 7), -6 + k * 14); g.stroke(); }
    g.globalAlpha = 1;
  }
  // glow
  g.shadowColor = '#5af0ff'; g.shadowBlur = 40 * (1 - cam.u * 0.8);
  g.fillStyle = '#0b0b12'; rr(-w / 2 - 3.2, -h / 2 - 3.2, w + 6.4, h + 6.4, 9); g.fill();
  g.shadowBlur = 0;
  g.strokeStyle = '#3a3a52'; g.lineWidth = 0.8; rr(-w / 2 - 3.2, -h / 2 - 3.2, w + 6.4, h + 6.4, 9); g.stroke();
  // screen
  g.save(); rr(-w / 2, -h / 2, w, h, 6.5); g.clip();
  const sg = g.createLinearGradient(0, -h / 2, 0, h / 2);
  sg.addColorStop(0, '#1b0d3a'); sg.addColorStop(1, '#0a0618');
  g.fillStyle = sg; g.fillRect(-w / 2, -h / 2, w, h);
  // status bar + clock
  g.fillStyle = '#fff'; g.font = `600 3.2px ${FONT}`; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText('11:47', -w / 2 + 4, -h / 2 + 4);
  g.textAlign = 'right'; g.fillText('5G ▮▮▮', w / 2 - 4, -h / 2 + 4);
  g.beginPath(); g.fillStyle = '#000'; rr(-7, -h / 2 + 2, 14, 4, 2); g.fill(); // camera island
  g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = `300 13px ${FONT}`; g.fillText('11:47', 0, -h / 2 + 22);
  g.font = `500 3px ${FONT}`; g.fillStyle = '#c9b8ff'; g.fillText('Friday · Sambalpur', 0, -h / 2 + 32);
  // notification banners stack in as the phone buzzes
  ORDERS.forEach((o, i) => {
    const k = spring(clamp((t - BUZZ[i]) / 0.5));
    if (k <= 0) return;
    const n = ORDERS.filter((_, j) => t >= BUZZ[j]).length;
    const slot = n - 1 - i; // newest on top
    const by = -h / 2 + 40 + slot * 15.5 - (1 - k) * 18;
    g.globalAlpha = clamp(k * 1.4);
    g.fillStyle = 'rgba(255,255,255,0.13)'; rr(-w / 2 + 3, by, w - 6, 13.5, 3.2); g.fill();
    g.fillStyle = '#ff8a3d'; rr(-w / 2 + 5, by + 2.2, 9, 9, 2.4); g.fill();
    g.fillStyle = '#fff'; g.font = `800 5px ${FONT}`; g.textAlign = 'center'; g.fillText('₹', -w / 2 + 9.5, by + 6.9);
    g.textAlign = 'left'; g.font = `700 3.3px ${FONT}`; g.fillStyle = '#fff'; g.fillText(`Online Order #${o.n}`, -w / 2 + 16.5, by + 4.6);
    g.font = `500 2.7px ${FONT}`; g.fillStyle = '#d9cffd'; g.fillText(`₹${o.amt} · ${o.items} item${o.items > 1 ? 's' : ''} · ${o.area}`, -w / 2 + 16.5, by + 9.2);
    g.globalAlpha = 1;
  });
  // screen sheen
  const sh2 = g.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  sh2.addColorStop(0, 'rgba(255,255,255,0.08)'); sh2.addColorStop(0.4, 'rgba(255,255,255,0)');
  g.fillStyle = sh2; g.fillRect(-w / 2, -h / 2, w, h);
  g.restore();
  // fingers wrapping the phone (not once it's been thrown)
  if (pose && pose.flying) { g.restore(); return; }
  g.fillStyle = '#a86a45';
  for (let k = 0; k < 3; k++) { rr(w / 2 - 1, 8 + k * 9, 9, 7.5, 3.5); g.fill(); }
  rr(-w / 2 - 8, 14, 10, 18, 4.5); g.fill(); // thumb
  g.restore();
}
function popups(t, cam) {
  // big floating order cards beside the hero (fade out when the camera dives in)
  const fade = 1 - clamp((t - ZOOM_START) / 0.5);
  if (fade <= 0) return;
  ORDERS.forEach((o, i) => {
    const d = t - BUZZ[i];
    if (d < 0) return;
    const k = spring(clamp(d / 0.6));
    const life = 1;
    const a = Math.min(k, life) * fade;
    if (a <= 0) return;
    const n = ORDERS.filter((_, j) => t >= BUZZ[j]).length;
    const slot = n - 1 - i; // newest card at the bottom of the stack, older ones pushed up
    const settle = easeOut(clamp(d / 0.7));
    const x = lerp(PHONE.x, 540, settle), y = lerp(PHONE.y - 60, 720 - slot * 128, settle);
    g.save(); g.globalAlpha = clamp(a); g.translate(x, y); g.scale(0.7 + 0.3 * k, 0.7 + 0.3 * k);
    g.shadowColor = '#ff4fd8'; g.shadowBlur = 30;
    g.fillStyle = 'rgba(20,8,40,0.88)'; rr(-200, -52, 400, 104, 22); g.fill();
    g.shadowBlur = 0; g.strokeStyle = '#ff4fd8'; g.lineWidth = 2.5; rr(-200, -52, 400, 104, 22); g.stroke();
    g.fillStyle = '#ff8a3d'; rr(-182, -34, 68, 68, 16); g.fill();
    g.fillStyle = '#fff'; g.font = `900 40px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('₹', -148, 2);
    g.textAlign = 'left'; g.font = `800 30px ${FONT}`; g.fillText(`Online Order #${o.n}`, -98, -14);
    g.font = `500 24px ${FONT}`; g.fillStyle = '#d9cffd'; g.fillText(`₹${o.amt} · ${o.items} item${o.items > 1 ? 's' : ''}`, -98, 20);
    g.restore();
  });
}
function rainLayer(t, cam) {
  g.strokeStyle = 'rgba(190,220,255,0.28)'; g.lineWidth = 2;
  const a = 1 - cam.u;
  if (a <= 0) return;
  g.globalAlpha = a;
  g.beginPath();
  for (const d of rain) { const y = ((d.y + t * d.s) % (H + 200)) - 100; const x = d.x - (y * 0.12); g.moveTo(x, y); g.lineTo(x - d.l * 0.12, y + d.l); }
  g.stroke(); g.globalAlpha = 1;
}
function post(t, cam) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  // spotlight on the phone while the camera dives in
  if (cam.u > 0) {
    const px = W / 2 + cam.s * (PHONE.x - cam.F.x), py = 960 + cam.s * (PHONE.y - cam.F.y);
    const rIn = cam.s * 45, rOut = cam.s * 45 + 380;
    const sp = g.createRadialGradient(px, py, rIn, px, py, rOut);
    const k = Math.sin(Math.PI * clamp(cam.u * 1.15));   // strongest mid-dive, gone at the end
    sp.addColorStop(0, 'rgba(5,0,15,0)'); sp.addColorStop(1, `rgba(5,0,15,${0.82 * k})`);
    g.fillStyle = sp; g.fillRect(0, 0, W, H);
  }
  // vignette
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${0.55 * (1 - cam.u)})`);
  g.fillStyle = v; g.fillRect(0, 0, W, H);
  // subtle scanlines + grain
  g.fillStyle = 'rgba(0,0,0,0.06)';
  for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
  const r = rng(Math.floor(t * 30) + 1);
  g.fillStyle = 'rgba(255,255,255,0.035)';
  for (let i = 0; i < 900; i++) g.fillRect(r() * W, r() * H, 2, 2);
  // fade in from black
  const fi = 1 - clamp(t / 0.6);
  if (fi > 0) { g.fillStyle = `rgba(0,0,0,${fi})`; g.fillRect(0, 0, W, H); }
}

function render(t) {
  const cam = camera(t);
  g = offCtx;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
  // camera shake on each buzz (tiny), only before the dive
  const shk = buzzShake(t) * 3 * (1 - cam.u);
  applyCam(cam, 0.2); g.translate(shk, 0); sky(t); buildings(far, 1080, '#1a0933', '#7b3dff', t);
  applyCam(cam, 0.55); g.translate(shk, 0); buildings(mid, 1210, '#120626', '#ff4fd8', t);
  applyCam(cam, 1); g.translate(shk, 0);
  street(t); kitchen(t); scooter(t); person(t); popups(t, cam); rainLayer(t, cam);
  // depth of field: the scene goes soft while the camera dives into the sharp phone
  g = main;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
  const blur = 26 * Math.pow(clamp(cam.u * 1.6), 1.2);
  g.filter = blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : 'none';
  g.drawImage(off, 0, 0);
  g.filter = 'none';
  applyCam(cam, 1); g.translate(shk, 0);
  phone(t, cam);
  post(t, cam);
}
// te = seconds into the ending shot (0..2.6)
function renderEnd(te) {
  const t = 6 + te;
  ENDK = { k: clamp((te - 0.45) / 1.6), grin: clamp((te - 0.05) / 0.35) };
  const cam = { s: lerp(2.0, 2.25, easeIO(clamp(te / 2.6))), F: { x: 690, y: 1300 }, u: 0 };
  g = offCtx;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
  applyCam(cam, 0.2); sky(t); buildings(far, 1080, '#1a0933', '#7b3dff', t);
  applyCam(cam, 0.55); buildings(mid, 1210, '#120626', '#ff4fd8', t);
  applyCam(cam, 1); street(t); kitchen(t); scooter(t); person(t); rainLayer(t, cam);
  g = main;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
  g.drawImage(off, 0, 0);
  applyCam(cam, 1); phone(t, cam);
  post(t + 10, cam); // +10: skip the fade-in from black
  ENDK = null;
}
window.renderEnd = renderEnd;
window.render = render;
window.DUR = DUR;
render(0.0);
// live preview when opened in a browser (not during export)
if (!location.hash.includes('export')) { const t0 = performance.now(); (function loop() { render(((performance.now() - t0) / 1000) % DUR); requestAnimationFrame(loop); })(); }
