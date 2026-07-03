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

## Stack

- **Client**: Vite + React + TypeScript, three.js via @react-three/fiber
  (isometric orthographic camera, WASD movement, animated props), zustand.
- **Server**: Express + better-sqlite3 (WAL), JWT auth, `ws` for presence/games,
  Google Sheets REST with a hand-rolled service-account JWT (no SDK).
- **Design**: charts follow a CVD-validated palette (cobalt `#2447f0` /
  orange `#eb6834` on white; `#4d6bff` / `#d95926` on the dark market screens).

## Run it

```bash
npm install
npm run dev        # server :4000 + vite :5173 (proxied)
# or production:
npm run build
npm start          # serves the built client on :4000
```

First boot seeds an admin account — **admin@felic.studio / felic-admin**
(override with `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars; change the password
via your profile after first login). Other env vars: `PORT`, `JWT_SECRET`,
`DATA_DIR` (SQLite location, defaults to `./data`).

## Controls

- **WASD / arrows** — move
- **E** — work at the highlighted room
- **ESC** — close the module window
- chat box (bottom right) — talk to the office
