# Free temporary client preview

A Cloudflare Quick Tunnel shares the locally running application over HTTPS without a paid host or Cloudflare account. This is temporary access, not an always-on production deployment.

## Current preview

- Website: https://antiques-herb-contributors-avatar.trycloudflare.com
- Admin: https://antiques-herb-contributors-avatar.trycloudflare.com/admin/login
- Storage gateway: https://per-distant-grove-breakfast.trycloudflare.com (private S3 API; objects still require signed authorization)

The public website and media tunnels, local Next.js server, PostgreSQL and RustFS must remain running. The computer must stay powered on, awake and connected. Restarting a Quick Tunnel normally generates a different URL; the old address then stops working. No uptime guarantee or permanent domain is provided.

## How it is wired

`APP_URL` is the website's public HTTPS origin. `ADDITIONAL_ALLOWED_ORIGINS=http://localhost:3001` also keeps local form submissions working with exact-origin checks. Authentication is still required for administration; no login bypass is enabled.

The browser must not receive `localhost:9000` storage links, because a client's localhost is their own computer. `S3_PUBLIC_ENDPOINT` is the HTTPS storage tunnel used to sign browser upload/read/download URLs. `S3_ENDPOINT` remains the private local endpoint for server-side verification, image optimization and deletion. Bucket CORS allows only the public website origin and localhost. The bucket remains private; the storage management console is not tunneled.

Ordinary native-video uploads are temporarily limited to 95 MB to stay below the free proxy request-size limit. This does not change Cloudflare Stream's separate direct-upload limits; Stream still requires its own account credentials.

## Starting again

Start the local services and app, then keep these commands running in separate terminals:

```bash
docker start rk-luxmnl-postgres rk-luxmnl-storage
npm run start -- --hostname 0.0.0.0 --port 3001
cloudflared tunnel --no-autoupdate --protocol http2 --url http://localhost:3001
cloudflared tunnel --no-autoupdate --protocol http2 --url http://localhost:9000
```

Read the new tunnel URLs from their output. Update `APP_URL`, `S3_PUBLIC_ENDPOINT`, and the bucket's allowed CORS origins. Rebuild/restart the app after changing preview settings so generated metadata uses the correct origin. Continue sharing only the website URL with the client.

For a permanent deployment, replace the temporary origins with the real HTTPS domain and a hosted private storage endpoint, then remove the preview-only extra origin and native-upload cap as appropriate for the production providers. See `DEPLOYMENT.md` for database, hosting and media setup.

## Ending the preview and returning to local-only use

Stop only the two Quick Tunnel processes created for this preview. Restore `APP_URL=http://localhost:3001`, clear `S3_PUBLIC_ENDPOINT` and `ADDITIONAL_ALLOWED_ORIGINS`, and restore the normal native upload size if desired. Rebuild/restart the app. This prevents local media links from depending on a stopped temporary tunnel. Existing products, uploaded files and customer records stay in their persistent database/storage.

## Verified

The public HTTPS address was retrieved successfully from an external web fetch. The catalog and gallery images loaded without localhost URLs. Public form-origin validation accepted the preview and configured local origin while rejecting an unrelated origin. Unauthenticated admin requests remained blocked. Existing administrator login, private signed upload CORS, an actual upload, backend processing and remote image retrieval were verified through the public endpoints. The temporary verification file was deleted and its test login session was signed out.
