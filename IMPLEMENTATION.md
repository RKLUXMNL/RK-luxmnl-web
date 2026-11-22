# Production conversion checklist

The existing Next.js storefront, typography, palette and responsive components are retained.

- [x] PostgreSQL schema, four applied migrations and tested administrator provisioning command
- [x] Opaque server sessions, password hashing, authorization, CSRF checks and shared rate limits
- [x] Published-only catalog and detailed `/products/[slug]` pages
- [x] Editable specifications, approved policy inheritance, certificates and media ordering
- [x] Database-backed inquiries, customization and capacity-checked Manila appointments
- [x] S3-compatible direct uploads and private reference documents, verified against local object storage
- [x] Cloudflare Stream provider code, resumable uploader, processing checks and ready-only replay guards
- [x] Live calendar and Reels linked to shared product records
- [x] Protected content/settings administration and authorized original-file downloads
- [x] Production metadata, indexing controls, error handling and documentation
- [x] Real database tests, build/lint/type checks and explicit provider verification report

Unverified demonstration inventory must never be automatically published or imported from browser storage. The browser wishlist may retain product IDs only. No cart, checkout or payment collection is included.

## Activation and external verification still required

- [ ] Connect the client's production database/hosting/domain and HTTPS configuration.
- [ ] Provision Ms. Kyla's real chosen administrator account; the business database has no default account/password.
- [ ] Connect production R2 storage credentials and verify final-origin CORS/private reads.
- [ ] Connect the actual Cloudflare Stream account/token/webhook and optional delivery host.
- [ ] Upload a real approximately four-hour recording and verify interruption/resume, processing, webhook delivery, signed playback, seeking and replacement/deletion on that account.
- [ ] Enter actual approved inventory, prices/specifications, availability slots, certificates and optional policies before publishing.

The Stream implementation checkbox above means the **code is implemented**, not that credential-backed uploads or four-hour playback have been verified. See `docs/VERIFICATION.md` for actual results.
