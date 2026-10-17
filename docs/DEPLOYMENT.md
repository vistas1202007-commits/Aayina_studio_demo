# Deploying Aaina

## Two explicit modes

Static hosting (including the existing Netlify demo) uses `runtime-config.js` with `mode: 'demo'`. It does not provide real accounts, bookings, SMS, payments or a shared database. The Node server serves the same pages and supplies live configuration only when `STUDIO_MODE=live`. Never cache or proxy `/api/*` or `/runtime-config.js`.

Run Node 24 or later. Copy `.env.example` to a private `.env`, install with `npm ci`, and use `npm start`. The API and frontend must share an origin. In production, terminate HTTPS at a trusted reverse proxy, set the exact HTTPS `PUBLIC_URL`, and persist `DATABASE_PATH` on a writable volume. The HTTP port should be accessible only through that proxy. The server does not trust arbitrary forwarded IP headers.

`Dockerfile` runs as the non-root node user. Persist `/data` and supply environment variables at runtime; do not bake secrets into the image. The Docker build itself is not part of the local validation; CI validates Node directly.

## Verified access

Create a Twilio Verify service. Set `TWILIO_VERIFY_SERVICE_SID`, `TWILIO_API_KEY_SID`, and `TWILIO_API_KEY_SECRET`. Verification requests and code checks go to Twilio's fixed HTTPS API. No bypass code exists in the application. The deterministic verification adapter used by automated tests is injected by the test runner and is not an HTTP endpoint or environment option.

Put the authorised studio team's verified 10-digit Indian phone numbers in `ADMIN_PHONES`. Public sign-in cannot request an admin role. Sessions are opaque random tokens; only token hashes are stored, with expiry. Production cookies are HttpOnly, SameSite=Strict and Secure. State-changing API calls require JSON and the exact configured Origin. Limits apply to OTP requests, verification attempts, enquiries and bookings.

## Appointment operations

Pending and confirmed bookings reserve a complete sequence of qualified staff segments in an SQLite `BEGIN IMMEDIATE` transaction. Concurrent requests are rechecked before saving. Customers can reschedule/cancel only their own pending or confirmed appointments, at least four hours before the start. Admins can confirm, change assignment, cancel or mark a past appointment completed. Completing a future appointment is rejected.

Times are interpreted in Asia/Kolkata. The booking grid uses the next 14 days; the API accepts dates up to 90 days ahead. Artist leave, full-studio closures, opening hours and service availability affect new availability checks. Blocking time does not silently cancel existing appointments: inspect the calendar and contact affected customers before changing leave/hours.

Existing appointments retain line-item prices, total, discounts and durations when a service menu is edited. The sixth-visit reward requires five completed visits and can be reserved once per cycle. Cancellation releases a reserved reward. Client-provided prices and booking states are ignored.

`AUTO_CONFIRM=false` is the default. Staff confirm pending requests from `/admin/`. Use `AUTO_CONFIRM=true` only when the studio wants immediate confirmation.

## Notification adapter

Set an HTTPS `NOTIFICATION_WEBHOOK_URL` and a strong `NOTIFICATION_WEBHOOK_SECRET`. A worker checks the durable outbox every minute and POSTs JSON events for requests, confirmation, changes, cancellation and reminders (24 hours and 2 hours before a confirmed appointment). The webhook implementation is responsible for translating those events to the chosen approved SMS/WhatsApp provider.

Headers:

- `Idempotency-Key`: stable event ID; deduplicate repeated delivery attempts.
- `X-Aaina-Timestamp`: Unix time.
- `X-Aaina-Signature`: hex HMAC-SHA256 of `timestamp + '.' + exactRequestBody` using the shared secret.

The receiver should verify signatures and a short timestamp window. Return 2xx only when the event is accepted. Delivery retries use exponential backoff, up to eight attempts. The admin desk distinguishes queued events, provider acceptance, and exhausted attempts. Provider acceptance is not evidence of delivery to the customer's device. The application never claims it sent a message simply because a booking was saved.

Appointment reminders respect the profile reminder preference. Cancelled/rescheduled appointments invalidate their old queued reminder jobs. Offers are opt-in; no marketing campaign sender is implemented.

## Content and hosting metadata

Set `PUBLIC_URL` so the Node server uses your deployment origin in canonical/social links and its generated sitemap. For a static demo on a different domain, run `PUBLIC_URL=https://your-domain.example npm run metadata` before publishing. The template currently identifies the supplied Netlify demo.

The portfolio photographs, staff names, prices and reviews remain sample content. Before a real studio launch, provide approved business details, photographs, reviews, contact information, provider disclosures and a retention policy. Sample portfolio labels are intentionally visible. No fabricated LocalBusiness rating or address schema is published.

The PWA caches only public pages and assets. API responses, runtime mode, authentication and admin pages bypass its cache. Live booking fails closed offline; no offline request is presented as confirmed.

## Storage, retention and recovery

This is a single-studio deployment using SQLite on persistent local storage. Run one application instance against that volume. Back up with SQLite's online backup facilities, or stop the server before copying the database and its journal files. Test restoration before accepting real appointments. Database files, environment files, source server code and test artifacts are excluded from the public static-file allowlist.

The operator owns database access, backups, retention and data-removal requests. Rate limits are stored in SQLite and deliberately do not trust incoming proxy IP headers. If traffic grows, migrate the persistence adapter to a managed transactional database and a distributed job runner.

## Validation boundary

`npm test` covers scheduling, ownership, sessions, administrator access, input validation, pricing snapshots, cancellation limits and notification state with injected test providers. `npm run test:browser` drives both interfaces against the actual local API, exercises demo/live journeys, offline behaviour and accessibility, and saves screenshots. Real Twilio and notification-provider delivery need operator credentials and are not claimed by these tests.

References: [Twilio verification](https://www.twilio.com/docs/verify/api/verification), [verification checks](https://www.twilio.com/docs/verify/api/verification-check), [Node SQLite](https://nodejs.org/api/sqlite.html).
