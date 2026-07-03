# Felic Studio OS

A business management system for Felic Studio, played like a sim game: every
teammate logs in as a controllable robot character in a 3D isometric office.
Walk to a room, press **E**, and the room's real SaaS module opens over the
blurred scene.

![Design language: bold cobalt blue + vivid orange, charcoal glass panels, keycap-white surfaces, heavy uppercase type, techy mono labels.]

## The office

| Room | Signature prop | Module |
|---|---|---|
| Finance Deck | wall of animated market screens | income/expense ledger, cashflow charts |
| The Vault | giant safe with a spinning wheel | documents & asset register |
| HR Check-in | check-in kiosk | team, attendance punch in/out, leave requests |
| Project Gym | treadmills + kanban board | projects, progress, task board |
| Flow Line | conveyor belts with moving crates | custom pipelines with stages |
| Client Lounge | folder shelves | simple CRM: contacts & deals |
| Arcade Corner | glowing game table | realtime tic-tac-toe, reaction race + leaderboard |

Presence is realtime over WebSockets: you see teammates walking around, chat
bubbles above their heads, and a "busy" antenna light when they're working in
a module.

## Features

- **Invite-only accounts** — admins create invites per email; the invite link
  lets the teammate pick a name, password, and character color.
- **Per-room access control** — admins grant/revoke each room per user; locked
  rooms show a red dot in the world and refuse entry (client *and* API).
- **Admin console** — user management, invites, room access matrix, admin
  promotion, Google Sheets integration settings.
- **Google Sheets sync** — every module has ⇡ push / ⇣ pull buttons. Configure
  a service account + spreadsheet id in Admin → Integrations (share the sheet
  with the service account's `client_email`). Push writes the table to a tab
  named after the resource; pull upserts rows back by `id`.
- **Games together** — a shared tic-tac-toe table (two seats, synced over
  WebSockets for everyone in the room) and a reaction-time race with a
  persistent leaderboard.

## Stack (Cloudflare Workers edition)

- **Client**: Vite + React + TypeScript, three.js via @react-three/fiber
  (isometric orthographic camera, WASD movement, animated props), zustand.
  Rendering: procedural environment lighting, contact + blob shadows, and an
  N8AO + bloom + vignette post stack. Typography is bundled (Archivo Black
  display, Space Grotesk UI, JetBrains Mono micro-labels) — no CDN fetches.
- **Server**: Cloudflare Workers — Hono for the REST API, **D1** (SQLite) for
  data, a **Durable Object** (`OfficeRoom`) for realtime presence/chat/games
  over WebSockets, WebCrypto for JWT (HS256) + PBKDF2 password hashing, and
  Google Sheets REST signed with WebCrypto RS256 (no SDK). Static assets are
  served by the Workers assets pipeline with SPA fallback.
- **Design**: charts follow a CVD-validated palette (cobalt `#2447f0` /
  orange `#eb6834` on white; `#4d6bff` / `#d95926` on the dark market screens).

## Run it locally

```bash
npm install
npm run dev        # vite build + wrangler dev on http://localhost:8787
# UI hot-reload while wrangler dev runs: npm run dev:ui (vite :5173, proxied)
```

`wrangler dev` runs everything locally (miniflare: local D1 + Durable
Objects) — no Cloudflare account needed for development.

## Deploy to Cloudflare

```bash
npx wrangler d1 create felic-studio-os   # paste database_id into wrangler.toml
npx wrangler secret put JWT_SECRET       # any long random string
npm run deploy
```

The first request seeds the admin account — **admin@felic.studio /
felic-admin** (change `ADMIN_PASSWORD` in `wrangler.toml` vars, or set a
secret of the same name, before first deploy; change the password via your
profile after first login).

## Controls

- **WASD / arrows** — move
- **E** — work at the highlighted room
- **ESC** — close the module window
- chat box (bottom right) — talk to the office
