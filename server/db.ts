import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(path.join(DATA_DIR, "felic.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  rooms TEXT NOT NULL DEFAULT '[]',
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  accepted_at TEXT
);

CREATE TABLE IF NOT EXISTS room_access (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room TEXT NOT NULL,
  PRIMARY KEY (user_id, room)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Finance
CREATE TABLE IF NOT EXISTS fin_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT NOT NULL DEFAULT '',
  amount REAL NOT NULL,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Documents / assets
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'document',
  category TEXT NOT NULL DEFAULT 'general',
  url TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- HR
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  salary REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  check_in TEXT,
  check_out TEXT,
  UNIQUE (user_id, date)
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee TEXT NOT NULL,
  from_date TEXT NOT NULL,
  to_date TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  owner TEXT NOT NULL DEFAULT '',
  deadline TEXT NOT NULL DEFAULT '',
  progress INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  assignee TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  due TEXT NOT NULL DEFAULT ''
);

-- Workflow
CREATE TABLE IF NOT EXISTS workflows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  stages TEXT NOT NULL DEFAULT '["Intake","In Progress","Review","Done"]'
);

CREATE TABLE IF NOT EXISTS workflow_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'Intake',
  assignee TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- CRM
CREATE TABLE IF NOT EXISTS crm_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'lead',
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS crm_deals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER REFERENCES crm_contacts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  value REAL NOT NULL DEFAULT 0,
  stage TEXT NOT NULL DEFAULT 'new',
  close_date TEXT NOT NULL DEFAULT ''
);

-- Games
CREATE TABLE IF NOT EXISTS game_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game TEXT NOT NULL,
  score REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

export function getSetting(key: string): string | null {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string) {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value);
}

const ROOMS = ["finance", "documents", "hr", "projects", "workflow", "crm", "games"];

export function userRooms(userId: number, isAdmin: boolean): string[] {
  if (isAdmin) return ROOMS;
  return (db.prepare("SELECT room FROM room_access WHERE user_id = ?").all(userId) as { room: string }[]).map(
    (r) => r.room
  );
}

export function setUserRooms(userId: number, rooms: string[]) {
  const del = db.prepare("DELETE FROM room_access WHERE user_id = ?");
  const ins = db.prepare("INSERT OR IGNORE INTO room_access (user_id, room) VALUES (?, ?)");
  const tx = db.transaction(() => {
    del.run(userId);
    for (const room of rooms) if (ROOMS.includes(room)) ins.run(userId, room);
  });
  tx();
}

export function seed() {
  const userCount = (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
  if (userCount > 0) return;

  const adminEmail = process.env.ADMIN_EMAIL || "admin@felic.studio";
  const adminPassword = process.env.ADMIN_PASSWORD || "felic-admin";
  const hash = bcrypt.hashSync(adminPassword, 10);
  const info = db
    .prepare("INSERT INTO users (email, name, password_hash, color, is_admin) VALUES (?, ?, ?, ?, 1)")
    .run(adminEmail, "Admin", hash, "#3b82f6");
  const adminId = Number(info.lastInsertRowid);
  setUserRooms(adminId, ROOMS);

  // Demo content so every room has something on screen.
  const t = db.prepare(
    "INSERT INTO fin_transactions (date, type, category, description, amount, created_by) VALUES (?,?,?,?,?,?)"
  );
  const today = new Date();
  const iso = (daysAgo: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  };
  t.run(iso(24), "income", "client work", "Brand identity — Aurora Foods", 4800, "Admin");
  t.run(iso(20), "income", "client work", "Website sprint — Nimbus Tech", 7200, "Admin");
  t.run(iso(17), "expense", "software", "Figma team seats", 144, "Admin");
  t.run(iso(14), "expense", "office", "Studio rent — monthly", 1500, "Admin");
  t.run(iso(9), "income", "retainer", "Monthly retainer — Koto Coffee", 2500, "Admin");
  t.run(iso(6), "expense", "hardware", "Wacom tablet", 380, "Admin");
  t.run(iso(2), "income", "client work", "Packaging design — Mori Skincare", 3900, "Admin");

  const d = db.prepare("INSERT INTO documents (name, kind, category, url, note, owner) VALUES (?,?,?,?,?,?)");
  d.run("Brand guidelines v3.pdf", "document", "brand", "", "Master brand book", "Admin");
  d.run("Client contract template", "document", "legal", "", "Reviewed by counsel 2026-03", "Admin");
  d.run("Cinema camera — FX3", "asset", "equipment", "", "Serial FX3-0921, kept in locker B", "Admin");
  d.run("Font license — GT Walsheim", "asset", "license", "", "5 seats, renews yearly", "Admin");

  const e = db.prepare("INSERT INTO employees (name, role, department, email, salary, status) VALUES (?,?,?,?,?,?)");
  e.run("Admin", "Studio Lead", "Management", adminEmail, 0, "active");
  e.run("Mai Tran", "Senior Designer", "Design", "mai@felic.studio", 2800, "active");
  e.run("Duc Pham", "Motion Designer", "Design", "duc@felic.studio", 2400, "active");
  e.run("Linh Vo", "Producer", "Production", "linh@felic.studio", 2600, "active");

  db.prepare("INSERT INTO leave_requests (employee, from_date, to_date, reason, status) VALUES (?,?,?,?,?)").run(
    "Duc Pham",
    iso(-7),
    iso(-9),
    "Family trip",
    "pending"
  );

  const p = db.prepare("INSERT INTO projects (name, status, owner, deadline, progress) VALUES (?,?,?,?,?)");
  const p1 = Number(p.run("Aurora Foods rebrand", "active", "Mai Tran", iso(-21), 65).lastInsertRowid);
  const p2 = Number(p.run("Nimbus Tech website", "active", "Linh Vo", iso(-35), 30).lastInsertRowid);
  p.run("Koto Coffee social kit", "done", "Duc Pham", iso(4), 100);

  const task = db.prepare("INSERT INTO tasks (project_id, title, assignee, status, priority, due) VALUES (?,?,?,?,?,?)");
  task.run(p1, "Logo refinement round 2", "Mai Tran", "doing", "high", iso(-3));
  task.run(p1, "Packaging mockups", "Duc Pham", "todo", "medium", iso(-10));
  task.run(p1, "Brand book layout", "Mai Tran", "todo", "medium", iso(-14));
  task.run(p2, "Wireframes — marketing pages", "Linh Vo", "doing", "high", iso(-5));
  task.run(p2, "Design system tokens", "Mai Tran", "todo", "medium", iso(-12));

  const wf = db.prepare("INSERT INTO workflows (name, stages) VALUES (?, ?)");
  const wf1 = Number(
    wf.run("Design request pipeline", JSON.stringify(["Intake", "Scoping", "In Progress", "Review", "Delivered"]))
      .lastInsertRowid
  );
  const wi = db.prepare("INSERT INTO workflow_items (workflow_id, title, stage, assignee) VALUES (?,?,?,?)");
  wi.run(wf1, "Aurora — menu board artwork", "In Progress", "Mai Tran");
  wi.run(wf1, "Nimbus — pitch deck polish", "Scoping", "Linh Vo");
  wi.run(wf1, "Koto — loyalty card print files", "Review", "Duc Pham");
  wi.run(wf1, "New inquiry — Mori Skincare", "Intake", "");

  const c = db.prepare("INSERT INTO crm_contacts (name, company, email, phone, status, notes) VALUES (?,?,?,?,?,?)");
  const c1 = Number(c.run("Hana Mori", "Mori Skincare", "hana@mori.jp", "+81 90 1234 5678", "lead", "Met at Design Week").lastInsertRowid);
  const c2 = Number(c.run("Tom Nguyen", "Aurora Foods", "tom@aurorafoods.vn", "+84 90 888 1234", "customer", "").lastInsertRowid);
  c.run("Sara Lim", "Nimbus Tech", "sara@nimbus.io", "+65 8123 4567", "customer", "Prefers async updates");

  const deal = db.prepare("INSERT INTO crm_deals (contact_id, title, value, stage, close_date) VALUES (?,?,?,?,?)");
  deal.run(c1, "Mori packaging system", 6500, "proposal", iso(-20));
  deal.run(c2, "Aurora retail rollout", 12000, "negotiation", iso(-30));

  console.log(`[seed] Created admin account ${adminEmail} (password: ${adminPassword === "felic-admin" ? "felic-admin — change it!" : "from env"})`);
}
