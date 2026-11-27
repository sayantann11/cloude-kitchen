# The Night Kitchen (cloude-kitchen)

Pure-veg ordering app + separate admin portal for a cloud kitchen in Sambalpur, with **smart order grouping**: orders placed within 30–50 minutes on the same side of town go out with one rider, on the shortest route, and only if nobody's food arrives late.

Built for **₹0/month** hosting at 30–40 orders a night (Firebase free plan).

## What's inside

| Who | Screen | What they can do |
| --- | --- | --- |
| Customer | `/` Menu | Full menu card (103 dishes, 13 sections), search, categories, offer prices, "only N left", sold-out items, "order again", Odia/English |
| Customer | `/checkout` | Cart, cooking note, map pin + "use my location", saved address, min order / free delivery / outer zone fees, cash / UPI on delivery / pay-now UPI |
| Customer | `/order/:id` | Live status, arrival time, rider name + call, cancel before accept, UPI pay link + "I have paid", call/WhatsApp kitchen, reorder |
| Customer | `/orders` | Order history on this phone |
| Admin | `/admin` | New-order chime + vibration + notification, accept with prep time, reject with reason, mark packed, **grouped trip suggestions with savings**, route map, Google Maps navigation, send to rider over WhatsApp, pause orders, keep screen on, print KOT |
| Admin | `/admin/trips` | Riders on the road, stop progress, cash collected, end trip |
| Admin | `/admin/menu` | Add / edit / delete / hide dishes, change price in place, bulk price change (% or ₹, by category), offer price, stock count per dish (auto sold out at 0, low-stock alerts), sold-out switch, photo link, categories and their order |
| Admin | `/admin/reports` | Sales, cash vs UPI, on-time %, km saved, top dishes, top areas, orders by hour, CSV download |
| Admin | `/admin/settings` | Name, phone, kitchen location, hours per day, fees, zones, promise times, grouping rules, UPI ID, riders |
| Rider | `/rider/:tripId` | Stop list from the WhatsApp link, call customer, navigate, mark delivered + cash/UPI collected. Works with weak signal |

## Tech (chosen for speed and ₹0 hosting)

- **Preact + TypeScript + Vite**: first load ≈ 30 KB gzipped. Kitchen, rider, maps and Firebase are separate chunks loaded only when needed.
- **Firebase (Spark free plan)**: Firestore (live updates), Auth (anonymous for customers/riders, email for the owner), Hosting.
- **Leaflet + OpenStreetMap**: free maps, no API key. Navigation hands off to Google Maps links (free).
- **PWA**: installable on phones, works offline for repeat visits.
- **No backend server, no Cloud Functions** → nothing to pay for. Security is in `firestore.rules`.

Free-plan headroom at 40 orders/night (≈ 200 visitors): ~2,000 reads and ~300 writes a day against limits of 50,000 and 20,000.

## Run it on your computer

```powershell
npm install
npm run dev
```

Open http://localhost:5173 (customers) and http://localhost:5173/admin (owner). With no Firebase keys it runs in **demo mode** (data stays in the browser). Admin login in demo mode: `owner@demo.local` / `kitchen123` (pre-filled).

Try it on your phone on the same Wi-Fi:

```powershell
npm run build
npx vite preview --host
```

Then open the "Network" address it prints on your phone.

## Admin portal is separate

- Customers use `/`. The owner uses **`/admin`**: a different page (`admin.html`) with its own app icon ("NK Admin", installable on the owner's phone).
- Nothing in the customer app links to it, customers never download its code, and it is hidden from Google (`noindex`, `robots.txt`).
- Even if someone finds the address, they only see a login. Orders, customer details and menu changes are locked to accounts listed in Firestore `owners/{uid}` (`firestore.rules`).

### Stock

Leave a dish's stock empty to not count it (just use the On/Off switch). Type a number (e.g. 20 portions) to count it: customers can't order more than what's left, they see "Only 3 left" near the end, the count goes down when you **accept** an order, and the dish turns sold out by itself at 0. The Menu tab shows a badge for dishes running low. "Reset sold out" switches everything back on at the start of a night.

## Tests

```powershell
npm run check
```

Runs the type-check, 40 unit tests (batching, routing, prices, stock, hours, validation), the production build, and 19 browser tests in Edge at phone size covering the full night: customer orders → kitchen accepts → orders grouped → rider delivers → customer sees "Delivered" live, plus stock, price changes and the separate admin portal. Use `$env:PW_CHANNEL="chrome"` to test in Chrome. `$env:SCREENS=1; npx playwright test screens` saves screenshots of every screen to `test-results/screens`.

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
7. **First login**: open `/admin`, log in, go to **Settings**: set the real kitchen name, phone, WhatsApp, kitchen location on the map, hours, UPI ID and riders → **Save**. Then **Menu**: fix dishes and prices.
8. **Share** the link on WhatsApp / Instagram / a QR code on the packaging. Customers can "Add to Home screen".

### Auto-deploy from GitHub (free, can be done from a phone)

Every push to `main` runs all tests on GitHub, then publishes the site **and** the security rules.

1. Firebase console → ⚙️ Project settings → **Service accounts** → **Generate new private key** (downloads a JSON file; keep it private, never share it).
2. GitHub repo → Settings → Secrets and variables → Actions → **New repository secret**: name `FIREBASE_SERVICE_ACCOUNT`, value = the whole JSON file.
3. Push to `main` (or re-run the latest workflow). The site updates in about 3 minutes.

The public web keys live in `.env.production` (they are not secrets). From a computer you can also deploy directly: `npx firebase login`, then `npm run deploy`.

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
src/pages/      customer/, owner/ (admin portal), rider/
admin.html      admin portal page (/admin), src/admin.tsx its entry
e2e/            Playwright browser tests
firestore.rules who may read/write what
demo/           the original clickable UI demo
```

## Before launch checklist

- [ ] Menu prices confirmed (the menu card says its prices are suggestions), kitchen phone/WhatsApp, UPI ID and riders entered in Settings
- [ ] Opening hours set (default 6 pm–11:30 pm)
- [ ] Kitchen location pinned exactly (routes start there)
- [ ] Odia text reviewed by a native speaker (`src/state/i18n.ts`, Odia dish names in Menu)
- [ ] Place 2–3 real test orders end to end on actual phones
- [ ] Owner keeps the dashboard open during service with sound on and "Keep screen on"
