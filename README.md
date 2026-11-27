# RK Luxmnl Diamond Jewelry

Database-backed luxury jewelry catalog, customer inquiries, private viewing requests, customization briefs, Instagram-or-Facebook live-selling archive, and authorized original Reel downloads. This upgrades the existing champagne-gold Next.js website in place. There is **no cart, checkout or payment processing**.

## Technology and architecture

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4 and Motion.
- PostgreSQL with Prisma 6, committed SQL migrations, foreign keys and indexes.
- Node crypto scrypt passwords and opaque, hashed database sessions; HttpOnly/SameSite cookies, production Secure cookies, origin checks and database-backed rate limits.
- Zod server validation, bounded JSON request bodies, honeypots, idempotency keys, optional Turnstile.
- Private R2/S3-compatible object storage. Direct browser uploads, server verification, optimized WebP derivatives and short-lived authorized reads.
- Cloudflare Stream provider interface, direct resumable TUS uploads, verified processing and signed playback tokens.
- Playwright integration tests against an isolated PostgreSQL database and actual S3-compatible object storage.

Business data is **not stored in localStorage**. Only wishlist product IDs remain device-local. Old browser demonstration records are never automatically imported into the business database.

## Installation

Requires Node.js 22+, npm and PostgreSQL. Docker is optional for a local database.

```bash
npm ci
```

Create `.env.local` using `.env.example`. Configure `DATABASE_URL` and `APP_URL`. Environment files with credentials are gitignored; `.env.example` is safe to commit.

For local PostgreSQL with Docker Compose v2:

```bash
docker compose --env-file .env.local up -d postgres
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev -- --hostname 0.0.0.0 --port 3001
```

The supplied `compose.yml` binds PostgreSQL to localhost:5438 and uses a named volume. Set `DATABASE_URL` to the matching user/password, database `rkluxmnl`, port 5438. On this workspace, the database is already provisioned in container `rk-luxmnl-postgres` using persistent volume `rk-luxmnl-postgres`.

Open **http://localhost:3001**. Port forwarding is needed when accessing a remote workspace. Database access is required at runtime; a missing database does not silently enable fake data.

### Migrations and initial content

```bash
npm run db:migrate -- --name meaningful_change  # development only
npm run db:deploy                            # apply committed migrations
npm run db:seed                              # approved defaults and categories
```

The seed creates the six initial categories and supplied business/contact/viewing information. It creates **no products, prices, availability slots, reviews, certifications or policies beyond the known viewing arrangements**. Existing unverified product illustrations are editorial assets, not published inventory. Publish real items through administration after owner approval.

Migrations:

1. `20261119184014_production_foundation`: products, categories, sessions, requests, appointments, live associations, Reels, media and settings.
2. `20261119185830_upload_capabilities`: scoped customer upload authorization.
3. `20261120035831_optimized_media`: WebP derivative references and image dimensions.
4. `20261120042713_production_indexes`: media/relation/maintenance lookup indexes.
5. `20261120053810_demo_catalog`: explicit demo-record classification for optional local test inventory.
6. `20261127000000_sparkle_stories`: published client feedback with platform and optional source URL.

Restart development after regenerating Prisma Client to avoid a stale client in the hot-reload process.

## Optional local demo inventory for testing

Set `ENABLE_DEMO_CATALOG=true` in `.env.local` and run `npm run db:seed:demo`, then rebuild/restart the application. This restores the original eight illustrative products in PostgreSQL, with sample prices and working local image galleries. The records are explicitly marked as demo inventory; real products and customer requests are not overwritten. Rerunning the command preserves existing demo edits and restores visibility.

Demo products are editable through the authenticated dashboard and can be used in product inquiries, viewing requests and live-session associations. They use bundled test imagery without requiring production storage credentials. Set `ENABLE_DEMO_CATALOG=false` and rebuild/restart to hide them throughout the public site. Demo products are excluded from the sitemap and product structured data, and indexing is disabled while demo mode is enabled. Approved real inventory continues to require owner confirmation and actual uploaded media.

## Administrator account

There is no default password, public registration or pretend login.

Set `ADMIN_EMAIL` to the operator's real email and `ADMIN_PASSWORD` to a unique 14–200 character password in a private environment, then run:

```bash
npm run admin:setup
```

Remove the password from the environment after provisioning. The same command resets that administrator's password and revokes their existing sessions. Business account provisioning requires the real operator's chosen credentials; test accounts are confined to the isolated test database.

Sign in at **`/admin/login`**. **`/admin`** and all administrative APIs validate server sessions. Public APIs cannot read customer requests. Session expiry is 12 hours; logout revokes the current session. Serve production over HTTPS so Secure cookies work correctly.

## Features

- Published-only catalog with search, category filtering, PHP prices, dual-handle price range, numeric bounds, sorting, reset and load more.
- `/products/[slug]`: gallery thumbnails, arrows, touch swipe, fullscreen/zoom, videos, optional approved specifications and certificates, product inquiry, related products and accessible animated accordions.
- Product media: multi-select upload queues with per-file progress/retry/cancel and mixed photo/video ordering. Customers see a five-second photo slideshow with muted video autoplay and next-item advancement on video completion, with pause controls and reduced-motion/visibility handling. Existing `ProductMedia.position` records provide the shared order; no schema migration is required for this gallery upgrade.
- `/shop/[slug]` redirects corresponding published records to their canonical product page. Missing, archived and unpublished products return 404.
- Policies inherit **product override → approved shared default → hidden if unavailable**. Blank optional payment/return/installment sections do not imply business policies.
- Customer inquiries persist with product IDs and contact preferences. Instagram/Facebook links and prepared-message copying are available; social DMs are **not automatically sent**.
- Appointment requests use configured Manila slots, blocked dates and transactional capacity checks. Pending and Confirmed requests occupy capacity; cancellation releases it. Requests are never automatically confirmed.
- Customization requests store private, persistent reference images. Public attachment capabilities are scoped, expire and are consumed on submission.
- `/live-selling`: Manila-date calendar, scheduled/live/completed/cancelled states, live Instagram and/or Facebook redirects, ready-only recording playback and shared featured jewelry records with optional seek timestamps.
- `/reels`: Instagram URL entries, uploaded original videos, linked products, and explicit download permission. No Instagram scraping or arbitrary Reel downloading.
- `/stories-of-sparkle`: published client feedback from Instagram or Facebook with an optional link to the original post. Draft stories stay private.
- Related products are ranked by title, description, category, specifications, price proximity and carat title matches rather than showing only recent products in the same category.
- Administration: real overview counts, product publication/archive, categories, request search/statuses, slot/date management, live sessions, Reels, Stories of Sparkle, ordered media, certificates, website contacts/logo and approved policies. Load more retrieves older management records.
- Canonical product SEO, valid optional Product/Offer structured data, sitemap, robots and Google verification support. Private routes and APIs have indexing restrictions.

## Storage setup

Configure a **private** R2/S3 bucket using `S3_*` variables. Do not make customer reference images publicly readable. Allow browser uploads with bucket CORS for the exact production origin:

```json
[
  {
    "AllowedOrigins": ["https://YOUR-DOMAIN"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Use bucket-scoped object read/write/delete credentials. Direct uploads are authorized for a declared format and size; completion verifies object metadata and file signatures. Images are decoded with pixel limits and converted to display/thumbnail WebP files. Original files are retained; customer references and drafts require authentication to read. Published attachments are resolved through permission-checked, expiring URLs. Revoking publication prevents new URLs; previously issued URLs may remain usable for up to five minutes.

For this workspace's localhost application, `.env.local` now connects to a separate private `rk-local-media` bucket in the persistent RustFS Docker service. Product uploads therefore work locally without pretending that Cloudflare R2 is connected. The isolated integration suite continues to use `rk-test-media`; neither bucket is production Cloudflare verification. Use actual private R2/S3 credentials and final-domain CORS before deployment.

Product images, certificate files, reference images and authorized original Reels are stored in the bucket, **not** frontend assets or database blobs. The original downloadable Reel preserves the uploaded bytes. Storage, bandwidth and duration limits depend on the provider/subscription. The workspace's RustFS container and `rk-test-media` bucket are **test infrastructure**, not Cloudflare R2 verification or production hosting.

## Cloudflare Stream and four-hour recordings

Set the account ID and an account-scoped Stream API token on the server. Configure the account's supported byte/duration reservation limits and sufficient purchased storage minutes. Do not expose API tokens through `NEXT_PUBLIC_*` variables.

In Cloudflare, register **`https://YOUR-DOMAIN/api/stream/webhook`** as the account webhook and store the returned signing secret in `CLOUDFLARE_STREAM_WEBHOOK_SECRET`. Signatures and timestamp freshness are verified; the server then rechecks provider status. A webhook needs a reachable HTTPS deployment or a correctly configured test tunnel, not localhost.

Videos over 200 MB use TUS. The administrator selects a supported MP4/WebM recording in Live Selling; the backend authorizes a direct provider upload without receiving the recording body. The client uses 50 MiB chunks, progress, pause/resume and automatic network retries. Reselecting the identical file in the same browser tab can recover an unexpired authorization after a reload; temporary upload capability metadata is stored in sessionStorage, not API credentials or business records. Upload URL expiry requires a new authorization. Keep original recordings backed up outside the application.

Cloudflare's documented default upload-size limit is 30 GB and uploads are also constrained by purchased storage capacity. The configured duration reservation defaults to six hours and is adjustable to the account's supported limits (the documented direct-upload API maximum is ten hours); there is **no hardcoded four-hour prohibition**. If the browser cannot inspect an input codec/duration, Stream uses the configured maximum reservation and performs the authoritative format/duration validation during processing. Provider errors and missing configuration are shown as failures, never simulated successes.

Processing is checked through authenticated polling, Media Library refresh and verified webhooks. A completed session with an attached unready recording cannot be published. A completed session without a recording can be published with **“Replay not available yet.”** Stream uses its adaptive CDN player with signed access, controls, seeking and fullscreen. A token can last six hours to cover a long viewing session.

**Real Cloudflare credentials, an actual long recording, interrupted-upload recovery, processing, signed playback and timestamp seeking must be verified against the client's account before launch. A four-hour recording has not been uploaded or tested in this workspace.**

## Environment variables

| Variable                                                 | Purpose                                                                                                                   |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                           | PostgreSQL runtime/migration connection                                                                                   |
| `ENABLE_DEMO_CATALOG`                                    | Optional local testing mode; defaults false. Enables explicitly marked demo records without confirming them as real stock |
| `APP_URL`                                                | Exact canonical origin and CSRF origin                                                                                    |
| `ADDITIONAL_ALLOWED_ORIGINS`                             | Optional additional exact origins for a temporary/local preview                                                           |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`                          | One-time private provisioning/reset                                                                                       |
| `LOCAL_DB_PASSWORD`                                      | Optional local Compose database password                                                                                  |
| `S3_ENDPOINT`, `S3_REGION`, `S3_FORCE_PATH_STYLE`        | Object storage connection                                                                                                 |
| `S3_PUBLIC_ENDPOINT`                                     | Optional publicly reachable S3-compatible gateway used to sign browser upload/read URLs                                   |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`  | Private bucket credentials/name                                                                                           |
| `IMAGE_MAX_FILE_BYTES`, `REEL_MAX_FILE_BYTES`            | Small-media upload limits                                                                                                 |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_STREAM_API_TOKEN`   | Stream server authorization                                                                                               |
| `CLOUDFLARE_STREAM_WEBHOOK_SECRET`                       | Webhook signature validation                                                                                              |
| `CLOUDFLARE_STREAM_DELIVERY_HOST`                        | Optional `customer-<code>.cloudflarestream.com` player host; otherwise the universal signed player is used                |
| `STREAM_MAX_FILE_BYTES`, `STREAM_MAX_DURATION_SECONDS`   | Configured account upload limits/reservation                                                                              |
| `TRUST_PROXY`                                            | Use proxy-provided IPs only when the proxy replaces spoofable client headers                                              |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Optional paired spam-verification configuration                                                                           |
| `GOOGLE_SITE_VERIFICATION`                               | Search Console meta verification                                                                                          |

Public business contacts, social links, logo and policies are managed in Website Settings. The supplied Instagram and Facebook profiles are initial defaults, not secrets.

## Verification

```bash
npm run lint
npm run typecheck
npm run db:deploy
npm run build
npm audit
```

Browser/integration tests require a running **separate** app on port 3002, an isolated PostgreSQL database whose name ends `_test`, and private S3-compatible test storage. Configure `.env.test.local`. The test suite refuses to truncate a database without that suffix. Never point it at business data.

```bash
npx dotenv -e .env.test.local -- prisma migrate deploy
npx playwright install chromium
npx playwright install-deps chromium
npx dotenv -e .env.test.local -- npm run dev -- --port 3002
# In another terminal:
npm run test:e2e
```

The suite checks real database persistence and actual object uploads/downloads, native short-video playback, authentication/CSRF, publication guards, product zoom/accordions, filters, inquiries, booking concurrency, private references, live-calendar links and policy inheritance. Unconfigured Stream is tested for an honest 503 response. This does **not** prove Cloudflare end-to-end operation or four-hour upload performance.

In this restricted Linux workspace, Chromium's missing shared libraries were extracted outside the project; tests can use `LD_LIBRARY_PATH=/tmp/opencode/browser-libs/usr/lib/x86_64-linux-gnu`. Reinstall system browser dependencies if that temporary directory is cleared.

## Deployment, operation and remaining activation

For a free temporary client-sharing link backed by this running computer, see [docs/CLIENT_PREVIEW.md](docs/CLIENT_PREVIEW.md). This is separate from an always-on hosted deployment.

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for hosting, DNS, HTTPS, migrations, backups and recovery. See **[docs/ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md)** for Ms. Kyla's daily workflows.

Before a business launch, connect production PostgreSQL, R2 and Stream; provision the real administrator; set the real domain and policies; upload approved actual inventory; and complete credential-backed media verification. No payment or delivery/returns/financing terms have been invented. Automated email/SMS notifications are not implemented; requests are received in the protected dashboard and require staff follow-up.
