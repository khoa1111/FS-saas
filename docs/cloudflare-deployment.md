# Cloudflare deployment plan

Felic Studio OS is designed as a sim-office SaaS: Vite/React renders the 3D office, while API routes manage finance, documents, HR, projects, workflow, CRM, games, invites, access control, and Google Sheets sync.

## Current deployable surface

- `wrangler.toml` keeps the Pages build safe and static: build with `npm run build`, output `dist`.
- `cloudflare/d1-schema.sql` mirrors the local SQLite schema so the business data model is ready for Cloudflare D1.
- R2 is reserved for uploaded documents and production creative assets; add the `ASSETS_BUCKET` binding after the bucket exists.

## Cloudflare target architecture

| Concern | Local implementation | Cloudflare service target |
|---|---|---|
| Frontend | Vite static files | Pages / Workers Assets |
| Business data | SQLite via `better-sqlite3` | D1 using `DB` binding |
| Documents/assets | URL register today | R2 via `ASSETS_BUCKET` binding |
| Realtime presence/games | Node `ws` server | Durable Objects with WebSocket hibernation |
| Secrets | environment variables/settings table | Wrangler secrets + D1 settings rows |
| Google Sheets | REST service-account JWT | Worker `fetch` + secrets for private key |

## Cloudflare Pages build settings

Use these settings in Cloudflare Pages:

- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: repository root

Do not add D1/R2 setup commands to the Pages build command. They are one-time provisioning operations and are not idempotent (`d1 create` and `r2 bucket create` fail after resources already exist).

## One-time Cloudflare setup

Run these commands locally or in an authenticated admin terminal, not in the Pages build command:

```bash
npx wrangler d1 create felic-studio-os
npx wrangler d1 execute felic-studio-os --file cloudflare/d1-schema.sql --remote
npx wrangler r2 bucket create felic-studio-assets
```

After creating D1/R2, configure the real D1 and R2 bindings in the Cloudflare dashboard or extend `wrangler.toml` with actual resource IDs. Store sensitive values with Wrangler secrets rather than committing them:

```bash
npx wrangler secret put JWT_SECRET
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON
```

## Backend migration checklist

1. Port `server/db.ts` calls to a Worker repository layer using prepared D1 statements.
2. Move Express routes in `server/index.ts` into Worker `fetch` handlers under `/api/*`.
3. Replace local WebSocket server state in `server/ws.ts` with one Durable Object per office instance.
4. Store uploaded files in R2 and write document metadata back to D1.
5. Keep Google Sheets push/pull payloads identical so the existing SaaS windows do not need UI changes.
