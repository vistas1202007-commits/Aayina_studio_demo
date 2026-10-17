# Aaina Beauty Studio

A salon website, mobile web app and studio dashboard. The existing [Netlify site](https://strong-cucurucho-858239.netlify.app/) remains an explicitly labelled demo.

## Run locally

Requires Node 24 or later.

```sh
npm ci
npm start
```

Open `http://127.0.0.1:3000`. Demo mode is the default; no verification code, appointment or payment is sent. The customer app is at `/app/` and the studio dashboard preview is at `/admin/`.

For live mode, copy `.env.example` to `.env`, configure the verification provider and authorised staff phone numbers, set `STUDIO_MODE=live`, and restart. See [deployment and provider setup](docs/DEPLOYMENT.md).

## What is included

- Refreshed responsive pages, calmer typography, clearer service cards, mobile booking summary and a matching studio desk.
- A shared booking engine for service prices, combo rules, rewards, full-duration staff availability and four-hour cancellation limits.
- SQLite persistence, verified phone sessions, ownership checks and an administrator allowlist.
- Atomic booking creation, qualified staff allocation, idempotent retries, rescheduling and stored price/duration snapshots.
- A staff calendar with day/week views, enquiry tracking, service editing, opening hours and artist leave.
- Persisted callback, bridal and waitlist enquiries.
- A durable notification outbox with retries, provider acceptance status and opted-in appointment reminders.
- Real calendar-file downloads in both interfaces.
- Escaped customer text, validated browser storage, native modal focus handling and reduced-motion support.
- Responsive WebP photographs, smaller font selection, social previews, canonical links and sitemap.
- An installable PWA with public offline browsing. Live booking always requires connectivity.

## Verification

```sh
npm run check
npm test
npx playwright install --with-deps chromium
npm run test:browser
```

The browser suite checks 1440px, 390px and 320px layouts, customer/staff workflows, storage recovery, HTML escaping, calendar downloads and offline behaviour. It writes screenshots and an axe accessibility report to ignored `artifacts/`. Set `AXE_STRICT=1` to fail on serious/critical accessibility findings; CI does this automatically.

Provider adapters in automated tests are deterministic test doubles. Real Twilio verification and external notification delivery require deployment credentials and separate live verification.

## Assets and metadata

`npm run images` rebuilds responsive WebP variants and PNG app icons using ImageMagick. Original JPEGs are retained as fallbacks. For a different static demo domain, run `PUBLIC_URL=https://your-domain.example npm run metadata`. The Node server uses its configured `PUBLIC_URL` for production metadata.

## Project structure

```text
index.html / services.html / bridal.html / booking.html
app/                 customer mobile web app
admin/               studio dashboard
core.js              shared business rules
client.js            same-origin session and API client
data.js              initial service catalogue and artist skills
server/              HTTP API, SQLite persistence and provider adapters
tests/               business-rule, API and browser regression checks
scripts/             checks, responsive assets and hosting metadata
docs/DEPLOYMENT.md   configuration, operations and validation boundary
```

## Content and credits

The photographs, names, prices and reviews are illustrative demo content. Real business photographs, verified reviews, operator details and privacy/retention information must be supplied before a real studio launch. Online payment collection is not offered; customers pay at the studio.

Original website designed and developed by **Shivani Sharma**.
