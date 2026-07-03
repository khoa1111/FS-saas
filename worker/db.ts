import { hashPassword } from "./auth";
import type { Env } from "./env";

const SCHEMA = `
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
CREATE TABLE IF NOT EXISTS game_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game TEXT NOT NULL,
  score REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export const ROOMS = ["finance", "documents", "hr", "projects", "workflow", "crm", "games"];

let readyPromise: Promise<void> | null = null;

/** Idempotent schema + seed; runs once per isolate, cheap thereafter. */
export function ensureReady(env: Env): Promise<void> {
  if (!readyPromise) readyPromise = init(env).catch((e) => { readyPromise = null; throw e; });
  return readyPromise;
}

async function init(env: Env) {
  const statements = SCHEMA.split(";").map((s) => s.trim()).filter(Boolean);
  await env.DB.batch(statements.map((s) => env.DB.prepare(s)));
  await seed(env);
}

async function seed(env: Env) {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>();
  if ((row?.n ?? 0) > 0) return;

  const adminEmail = env.ADMIN_EMAIL || "admin@felic.studio";
  const adminPassword = env.ADMIN_PASSWORD || "felic-admin";
  const hash = await hashPassword(adminPassword);
  const res = await env.DB.prepare(
    "INSERT INTO users (email, name, password_hash, color, is_admin) VALUES (?, ?, ?, ?, 1)"
  ).bind(adminEmail, "Admin", hash, "#3b82f6").run();
  const adminId = Number(res.meta.last_row_id);
  await setUserRooms(env, adminId, ROOMS);

  const iso = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  };

  const stmts: D1PreparedStatement[] = [];
  const t = (date: string, type: string, cat: string, desc: string, amt: number) =>
    stmts.push(
      env.DB.prepare(
        "INSERT INTO fin_transactions (date, type, category, description, amount, created_by) VALUES (?,?,?,?,?,'Admin')"
      ).bind(date, type, cat, desc, amt)
    );
  t(iso(24), "income", "client work", "Brand identity — Aurora Foods", 4800);
  t(iso(20), "income", "client work", "Website sprint — Nimbus Tech", 7200);
  t(iso(17), "expense", "software", "Figma team seats", 144);
  t(iso(14), "expense", "office", "Studio rent — monthly", 1500);
  t(iso(9), "income", "retainer", "Monthly retainer — Koto Coffee", 2500);
  t(iso(6), "expense", "hardware", "Wacom tablet", 380);
  t(iso(2), "income", "client work", "Packaging design — Mori Skincare", 3900);

  const d = (name: string, kind: string, cat: string, note: string) =>
    stmts.push(
      env.DB.prepare("INSERT INTO documents (name, kind, category, url, note, owner) VALUES (?,?,?,'',?,'Admin')").bind(
        name, kind, cat, note
      )
    );
  d("Brand guidelines v3.pdf", "document", "brand", "Master brand book");
  d("Client contract template", "document", "legal", "Reviewed by counsel 2026-03");
  d("Cinema camera — FX3", "asset", "equipment", "Serial FX3-0921, kept in locker B");
  d("Font license — GT Walsheim", "asset", "license", "5 seats, renews yearly");

  const e = (name: string, role: string, dept: string, email: string, salary: number) =>
    stmts.push(
      env.DB.prepare("INSERT INTO employees (name, role, department, email, salary, status) VALUES (?,?,?,?,?,'active')").bind(
        name, role, dept, email, salary
      )
    );
  e("Admin", "Studio Lead", "Management", adminEmail, 0);
  e("Mai Tran", "Senior Designer", "Design", "mai@felic.studio", 2800);
  e("Duc Pham", "Motion Designer", "Design", "duc@felic.studio", 2400);
  e("Linh Vo", "Producer", "Production", "linh@felic.studio", 2600);

  stmts.push(
    env.DB.prepare("INSERT INTO leave_requests (employee, from_date, to_date, reason, status) VALUES (?,?,?,?,'pending')").bind(
      "Duc Pham", iso(-7), iso(-9), "Family trip"
    )
  );
  await env.DB.batch(stmts);

  const p1 = Number(
    (await env.DB.prepare("INSERT INTO projects (name, status, owner, deadline, progress) VALUES (?,?,?,?,?)")
      .bind("Aurora Foods rebrand", "active", "Mai Tran", iso(-21), 65).run()).meta.last_row_id
  );
  const p2 = Number(
    (await env.DB.prepare("INSERT INTO projects (name, status, owner, deadline, progress) VALUES (?,?,?,?,?)")
      .bind("Nimbus Tech website", "active", "Linh Vo", iso(-35), 30).run()).meta.last_row_id
  );
  await env.DB.prepare("INSERT INTO projects (name, status, owner, deadline, progress) VALUES (?,?,?,?,?)")
    .bind("Koto Coffee social kit", "done", "Duc Pham", iso(4), 100).run();

  const wf1 = Number(
    (await env.DB.prepare("INSERT INTO workflows (name, stages) VALUES (?, ?)")
      .bind("Design request pipeline", JSON.stringify(["Intake", "Scoping", "In Progress", "Review", "Delivered"]))
      .run()).meta.last_row_id
  );
  const c1 = Number(
    (await env.DB.prepare("INSERT INTO crm_contacts (name, company, email, phone, status, notes) VALUES (?,?,?,?,?,?)")
      .bind("Hana Mori", "Mori Skincare", "hana@mori.jp", "+81 90 1234 5678", "lead", "Met at Design Week")
      .run()).meta.last_row_id
  );
  const c2 = Number(
    (await env.DB.prepare("INSERT INTO crm_contacts (name, company, email, phone, status, notes) VALUES (?,?,?,?,?,?)")
      .bind("Tom Nguyen", "Aurora Foods", "tom@aurorafoods.vn", "+84 90 888 1234", "customer", "")
      .run()).meta.last_row_id
  );

  const stmts2: D1PreparedStatement[] = [];
  const task = (pid: number, title: string, who: string, status: string, prio: string, due: string) =>
    stmts2.push(
      env.DB.prepare("INSERT INTO tasks (project_id, title, assignee, status, priority, due) VALUES (?,?,?,?,?,?)").bind(
        pid, title, who, status, prio, due
      )
    );
  task(p1, "Logo refinement round 2", "Mai Tran", "doing", "high", iso(-3));
  task(p1, "Packaging mockups", "Duc Pham", "todo", "medium", iso(-10));
  task(p1, "Brand book layout", "Mai Tran", "todo", "medium", iso(-14));
  task(p2, "Wireframes — marketing pages", "Linh Vo", "doing", "high", iso(-5));
  task(p2, "Design system tokens", "Mai Tran", "todo", "medium", iso(-12));

  const wi = (title: string, stage: string, who: string) =>
    stmts2.push(
      env.DB.prepare("INSERT INTO workflow_items (workflow_id, title, stage, assignee) VALUES (?,?,?,?)").bind(
        wf1, title, stage, who
      )
    );
  wi("Aurora — menu board artwork", "In Progress", "Mai Tran");
  wi("Nimbus — pitch deck polish", "Scoping", "Linh Vo");
  wi("Koto — loyalty card print files", "Review", "Duc Pham");
  wi("New inquiry — Mori Skincare", "Intake", "");

  stmts2.push(
    env.DB.prepare("INSERT INTO crm_contacts (name, company, email, phone, status, notes) VALUES (?,?,?,?,?,?)").bind(
      "Sara Lim", "Nimbus Tech", "sara@nimbus.io", "+65 8123 4567", "customer", "Prefers async updates"
    )
  );
  stmts2.push(
    env.DB.prepare("INSERT INTO crm_deals (contact_id, title, value, stage, close_date) VALUES (?,?,?,?,?)").bind(
      c1, "Mori packaging system", 6500, "proposal", iso(-20)
    )
  );
  stmts2.push(
    env.DB.prepare("INSERT INTO crm_deals (contact_id, title, value, stage, close_date) VALUES (?,?,?,?,?)").bind(
      c2, "Aurora retail rollout", 12000, "negotiation", iso(-30)
    )
  );
  await env.DB.batch(stmts2);
}

// ---- shared helpers ----

export async function getSetting(env: Env, key: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first<{ value: string }>();
  return row?.value ?? null;
}

export async function setSetting(env: Env, key: string, value: string) {
  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).bind(key, value).run();
}

export async function userRooms(env: Env, userId: number, isAdmin: boolean): Promise<string[]> {
  if (isAdmin) return ROOMS;
  const rows = await env.DB.prepare("SELECT room FROM room_access WHERE user_id = ?").bind(userId).all<{ room: string }>();
  return (rows.results ?? []).map((r) => r.room);
}

export async function setUserRooms(env: Env, userId: number, rooms: string[]) {
  const stmts = [env.DB.prepare("DELETE FROM room_access WHERE user_id = ?").bind(userId)];
  for (const room of rooms) {
    if (ROOMS.includes(room)) {
      stmts.push(env.DB.prepare("INSERT OR IGNORE INTO room_access (user_id, room) VALUES (?, ?)").bind(userId, room));
    }
  }
  await env.DB.batch(stmts);
}

export interface DbUser {
  id: number;
  email: string;
  name: string;
  color: string;
  is_admin: number;
}

export async function sessionUser(env: Env, id: number) {
  const row = await env.DB.prepare("SELECT id, email, name, color, is_admin FROM users WHERE id = ?")
    .bind(id).first<DbUser>();
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    color: row.color,
    isAdmin: !!row.is_admin,
    rooms: await userRooms(env, row.id, !!row.is_admin)
  };
}
