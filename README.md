# Mahanadi Kitchen (cloude-kitchen)

Ordering app + kitchen dashboard for a cloud kitchen in Sambalpur, with **smart order grouping**: orders placed within 30–50 minutes on the same side of town go out with one rider, on the shortest route, and only if nobody's food arrives late.

Built for **₹0/month** hosting at 30–40 orders a night (Firebase free plan).

## What's inside

| Who | Screen | What they can do |
| --- | --- | --- |
| Customer | `/` Menu | Search, veg-only filter, categories, bestseller tags, sold-out items, "order again", Odia/English |
| Customer | `/checkout` | Cart, cooking note, map pin + "use my location", saved address, min order / free delivery / outer zone fees, cash / UPI on delivery / pay-now UPI |
| Customer | `/order/:id` | Live status, arrival time, rider name + call, cancel before accept, UPI pay link + "I have paid", call/WhatsApp kitchen, reorder |
| Customer | `/orders` | Order history on this phone |
| Owner | `/kitchen` | New-order chime + vibration + notification, accept with prep time, reject with reason, mark packed, **grouped trip suggestions with savings**, route map, Google Maps navigation, send to rider over WhatsApp, pause orders, keep screen on, print KOT |
| Owner | `/kitchen/trips` | Riders on the road, stop progress, cash collected, end trip |
| Owner | `/kitchen/menu` | Add / edit / delete dishes, sold-out switch, categories and their order |
| Owner | `/kitchen/reports` | Sales, cash vs UPI, on-time %, km saved, top dishes, top areas, orders by hour, CSV download |
| Owner | `/kitchen/settings` | Name, phone, kitchen location, hours per day, fees, zones, promise times, grouping rules, UPI ID, riders |
| Rider | `/rider/:tripId` | Stop list from the WhatsApp link, call customer, navigate, mark delivered + cash/UPI collected. Works with weak signal |

## Tech (chosen for speed and ₹0 hosting)

- **Preact + TypeScript + Vite**: first load ≈ 30 KB gzipped. Kitchen, rider, maps and Firebase are separate chunks loaded only when needed.
- **Firebase (Spark free plan)**: Firestore (live updates, offline cache), Auth (anonymous for customers/riders, email for the owner), Hosting.
- **Leaflet + OpenStreetMap**: free maps, no API key. Navigation hands off to Google Maps links (free).
- **PWA**: installable on phones, works offline for repeat visits.
- **No backend server, no Cloud Functions** → nothing to pay for. Security is in `firestore.rules`.

Free-plan headroom at 40 orders/night (≈ 200 visitors): ~2,000 reads and ~300 writes a day against limits of 50,000 and 20,000.

## Run it on your computer

```powershell
npm install
npm run dev
```

Open http://localhost:5173. With no Firebase keys it runs in **demo mode** (data stays in the browser). Kitchen login in demo mode: `owner@demo.local` / `kitchen123` (pre-filled).

Try it on your phone on the same Wi-Fi:

```powershell
npm run build
npx vite preview --host
```

Then open the "Network" address it prints on your phone.

## Tests

```powershell
npm run check
```

Runs the type-check, 35 unit tests (batching, routing, prices, hours, validation), the production build, and 16 browser tests in Edge at phone size covering the full night: customer orders → kitchen accepts → orders grouped → rider delivers → customer sees "Delivered" live. Use `$env:PW_CHANNEL="chrome"` to test in Chrome. `$env:SCREENS=1; npx playwright test screens` saves screenshots of every screen to `test-results/screens`.

## Go live on Firebase (free) — about 20 minutes

1. **Create the project**: https://console.firebase.google.com → Add project (Analytics not needed).
2. **Firestore**: Build → Firestore Database → Create → location **asia-south1 (Mumbai)** → production mode.
3. **Auth**: Build → Authentication → Get started → enable **Anonymous** and **Email/Password**. Under Users → Add user → the owner's email and a strong password. Copy the user's **UID**.
4. **Make that user the owner**: Firestore → Start collection `owners` → Document ID = the UID → add any field (e.g. `name: "Owner"`) → Save.
5. **Web app keys**: Project settings → Your apps → Web (`</>`) → register → copy the config into a new file `.env.local` (see `.env.example`).
6. **Deploy** (one time: `npm install -g firebase-tools` then `firebase login`):

   ```powershell
   firebase use --add
   npm run deploy
   ```

   This builds the app and uploads the site, the security rules and the database index. The site is live at `https://<project-id>.web.app`.
7. **First login**: open `/kitchen`, log in, go to **Settings**: set the real kitchen name, phone, WhatsApp, kitchen location on the map, hours, UPI ID and riders → **Save**. Then **Menu**: fix dishes and prices.
8. **Share** the link on WhatsApp / Instagram / a QR code on the packaging. Customers can "Add to Home screen".

### Auto-deploy from GitHub (optional, free)

Every push to `main` runs all tests on GitHub. To also publish the site automatically:

1. Firebase console → Project settings → **Service accounts** → **Generate new private key** (downloads a JSON file; keep it private).
2. GitHub repo → Settings → Secrets and variables → Actions:
   - **Secrets** tab → New secret `FIREBASE_SERVICE_ACCOUNT` → paste the whole JSON file.
   - **Variables** tab → add `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MESSAGING_SENDER_ID` from your web app config.
3. Push to `main`. The site updates in about 2 minutes. Security rules change rarely: deploy them from your PC with `npx firebase deploy --only firestore`.

Optional: connect a custom domain (Hosting → Add custom domain, ~₹800–1,200/year for the domain). For extra protection against spam orders, turn on Firebase App Check (reCAPTCHA, free).

## How grouping works

`src/lib/engine.ts` (fully unit-tested). An order joins a trip only if:

1. it was placed within the **window** (default 40 min) of the trip's first order,
2. it's within **3.2 km** of a stop already in the trip and in the same direction from the kitchen (±55°),
3. the trip has room (default **3** orders),
4. the best stop order (all orders are tried) still delivers **everyone** before their promised time.

Distances are straight-line × 1.35 at 20 km/h plus 3 minutes per handover, tuned for Sambalpur. All rules are adjustable in Settings.

## Project layout

```
src/lib/        engine (batching + routes), pricing, hours, validation, UPI links  ← pure, tested
src/data/       DataStore interface, LocalStore (demo/tests), FirebaseStore (live), seed menu
src/state/      app state (signals), router, Odia strings
src/pages/      customer/, owner/, rider/
e2e/            Playwright browser tests
firestore.rules who may read/write what
demo/           the original clickable UI demo
```

## Before launch checklist

- [ ] Real menu, prices, kitchen phone/WhatsApp, UPI ID and riders entered in Settings
- [ ] Kitchen location pinned exactly (routes start there)
- [ ] Odia text reviewed by a native speaker (`src/state/i18n.ts`, Odia dish names in Menu)
- [ ] Place 2–3 real test orders end to end on actual phones
- [ ] Owner keeps the dashboard open during service with sound on and "Keep screen on"
