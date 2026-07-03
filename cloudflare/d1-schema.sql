-- Felic Studio OS Cloudflare D1 bootstrap schema.
-- Mirrors the local SQLite schema used by server/db.ts, with D1-friendly types.

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
