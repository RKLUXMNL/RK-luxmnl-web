# Deployment and operations

## Recommended services

Use a Node-compatible Next.js host (managed Next hosting or a Node server), managed PostgreSQL with backups, a private Cloudflare R2 bucket, and Cloudflare Stream. The application requires Node runtime APIs; do not deploy it as a static export. The local Docker database/test object store are not production hosting.

## Build and release

1. Put server secrets in the hosting platform's encrypted environment configuration. Never commit populated environment files or place API credentials in public variables.
2. Set `APP_URL` to the exact canonical HTTPS origin.
3. Install dependencies with `npm ci`, including build tools.
4. Run `npm run db:generate`, `npm run lint`, `npm run typecheck`, `npm run db:deploy`, `npm run db:seed` and `npm run build`. Migration deployment must succeed before releasing application code that needs the new columns.
5. Provision the real administrator privately with `npm run admin:setup`. Remove provisioning passwords afterward.
6. Start with `npm run start -- --hostname 0.0.0.0 --port 3001`, or use the platform's managed Next runtime. Place a TLS reverse proxy/load balancer in front of a self-hosted server. Do not expose PostgreSQL publicly.
7. Perform production-origin smoke tests, including sign-in, a real inquiry, a viewing request, a private upload and publishing/unpublishing an approved product.

Prisma CLI is a build/deployment tool. Run migrations in a job that has build dependencies installed. Use the PostgreSQL provider's connection-pooling recommendations for the web application and a direct migration connection when required. Set appropriate pool/connection limits for the hosting plan. Image processing needs adequate function memory and execution time for the configured image size/pixel limits.

`TRUST_PROXY=true` is appropriate only when the front proxy replaces incoming `CF-Connecting-IP`/`X-Forwarded-For` values with trusted client addresses and direct access to the app is restricted. Otherwise leave it false; the safe fallback uses shared rate limits. Configure Turnstile's site and secret keys together for additional public-form protection.

## Domain, DNS and HTTPS

- Add the client-owned domain in the hosting platform and create the instructed A/AAAA/CNAME records with the DNS provider. No domain has been invented or registered by this implementation.
- Choose one canonical origin, redirect alternate `www`/apex and HTTP traffic to it, and set `APP_URL` accordingly.
- Enable valid TLS before production login. Production cookies are Secure, HttpOnly and SameSite Strict.
- Update bucket CORS and provider playback/origin settings to the real HTTPS origin. The application allows Cloudflare player frames; any additional host-level CSP must allow Stream, Turnstile when used, and direct bucket/upload connections.
- Configure the Stream webhook at `/api/stream/webhook` and verify delivery/signatures on the real origin.
- If the host supplies a Content Security Policy, product-gallery Stream controls require `https://embed.cloudflarestream.com` in script sources as well as the configured Stream player domain in frame sources.

## Media permissions and delivery

Local development now uses a separate private `rk-local-media` bucket in the RustFS Docker volume for ordinary product photos and short clips. Before moving that catalog to a hosted deployment, copy any retained originals and generated derivatives to the production private bucket while preserving their object keys, then update the `S3_*` configuration. A database migration alone does not copy media files. Long live-session recordings continue to use Cloudflare Stream; there is no local-file fallback for Stream uploads.

- Keep the object bucket private. Public photos, approved certificates and original Reel files are exposed only through application checks and short-lived signed reads. Customer references and unpublished attachments stay protected.
- Use bucket-scoped credentials with object read/write/delete permissions. Configure exact-origin CORS for PUT/GET/HEAD; avoid a production wildcard origin.
- Stream recordings use private/signed playback and Cloudflare's adaptive streaming CDN. Raw multi-hour recordings never pass through the Next server or reside in its `public/` directory.
- Native authorized Reel downloads use original object bytes and attachment-safe filenames. Publication/download revocation blocks new URLs immediately, with up to five minutes of validity for previously issued object URLs.
- Clean up unused uploads through the protected media library. Do not delete provider media that is still referenced in database records.

## SEO and indexing

Set `GOOGLE_SITE_VERIFICATION`, verify the actual domain in Search Console and submit `/sitemap.xml`. Product routes include canonical metadata and Product structured data with Offer data only when an actual published numeric price exists. Never add invented ratings or certificates. Admin/login/wishlist pages are noindex; APIs carry noindex headers; unpublished products return 404 and do not enter the sitemap.

Keep business contact details and policies current in Website Settings. Check real product images and sharing previews after the domain is active.

## Database backups and recovery

Use the managed PostgreSQL provider's encrypted automated backups/PITR and retain independent backups according to the client's retention requirements. Restrict backup access because requests contain personal information.

Example manual backup to a secure operator-controlled location:

```bash
pg_dump "$DATABASE_URL" --format=custom --file=rkluxmnl-backup.dump
```

Test restoration into a **separate empty database**:

```bash
pg_restore --no-owner --no-privileges --dbname="$RESTORE_DATABASE_URL" rkluxmnl-backup.dump
DATABASE_URL="$RESTORE_DATABASE_URL" npm run db:deploy
```

Verify product/media references, admin access, private customer records, appointments and live associations before switching traffic. Never run a destructive restore against the live database casually. A database dump contains metadata, not image/video binaries: preserve object-store data separately using provider versioning/backups or a controlled copy policy. Retain original long recordings in an independent business-owned archive; Cloudflare Stream is the delivery/encoding service.

For schema rollback, prefer a tested forward fix. Restore from a verified snapshot only with an operational recovery plan. Rehearse backup restoration before relying on a backup policy.

## Maintenance

- Run `npm run maintenance` daily to remove expired sessions and rate-limit records. This command does not delete customer requests or media.
- Review dependency updates and run `npm audit`, lint, type checks, migrations, builds and isolated integration tests before releases.
- Monitor application/provider errors, database capacity, Stream stored minutes/encoding state, bucket growth, failed uploads and backups.
- Rotate provider tokens and revoke/reset administrator sessions when needed. Remove unused provisioning credentials.
- Maintain a client-approved privacy/retention policy for inquiry/contact data; no arbitrary public return, financing, payment or delivery policy is generated by the app.

## Provider acceptance test before launch

With the actual client account, upload a supported real recording of approximately four hours within purchased limits. Test interruption/resume, expired authorization retry, provider processing failure, webhook delivery, signed playback on mobile/desktop, seeking/fullscreen, featured-product timestamps and replacement/deletion. Verify R2 CORS/private links and authorized original Reel downloads on the final domain.

Those credential-backed Stream/R2 account checks and a real four-hour test have **not** been completed merely by passing local PostgreSQL/S3-compatible integration tests. Record their actual results before describing long-video delivery as verified.
