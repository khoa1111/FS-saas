import express from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { db, seed, getSetting, setSetting, userRooms, setUserRooms } from "./db.ts";
import { requireAuth, requireAdmin, requireRoom, signToken } from "./auth.ts";
import { RESOURCES } from "./modules.ts";
import { pushRows, pullRows, sheetsConfigured } from "./sheets.ts";
import { attachWs, onlineCount } from "./ws.ts";

seed();

const app = express();
app.use(express.json({ limit: "1mb" }));

const api = express.Router();
app.use("/api", api);

// ---------- Auth ----------

api.post("/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(String(email || "").toLowerCase().trim()) as
    | { id: number; email: string; name: string; password_hash: string; color: string; is_admin: number }
    | undefined;
  if (!row || !bcrypt.compareSync(String(password || ""), row.password_hash)) {
    return res.status(401).json({ error: "Wrong email or password" });
  }
  res.json({ token: signToken(row.id), user: sessionUser(row.id) });
});

api.get("/auth/me", requireAuth, (req, res) => {
  res.json({ user: sessionUser(req.user!.id) });
});

api.get("/auth/invite/:token", (req, res) => {
  const inv = db.prepare("SELECT email, accepted_at FROM invites WHERE token = ?").get(req.params.token) as
    | { email: string; accepted_at: string | null }
    | undefined;
  if (!inv) return res.status(404).json({ error: "Invite not found" });
  if (inv.accepted_at) return res.status(410).json({ error: "Invite already used" });
  res.json({ email: inv.email });
});

api.post("/auth/invite/:token/accept", (req, res) => {
  const inv = db.prepare("SELECT * FROM invites WHERE token = ?").get(req.params.token) as
    | { id: number; email: string; rooms: string; is_admin: number; accepted_at: string | null }
    | undefined;
  if (!inv) return res.status(404).json({ error: "Invite not found" });
  if (inv.accepted_at) return res.status(410).json({ error: "Invite already used" });

  const { name, password, color } = req.body || {};
  if (!name || String(password || "").length < 6) {
    return res.status(400).json({ error: "Name required and password must be at least 6 characters" });
  }
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(inv.email);
  if (existing) return res.status(409).json({ error: "An account with this email already exists" });

  const hash = bcrypt.hashSync(String(password), 10);
  const info = db
    .prepare("INSERT INTO users (email, name, password_hash, color, is_admin) VALUES (?,?,?,?,?)")
    .run(inv.email, String(name).slice(0, 60), hash, safeColor(color), inv.is_admin);
  const userId = Number(info.lastInsertRowid);
  setUserRooms(userId, JSON.parse(inv.rooms || "[]"));
  db.prepare("UPDATE invites SET accepted_at = datetime('now') WHERE id = ?").run(inv.id);
  res.json({ token: signToken(userId), user: sessionUser(userId) });
});

api.post("/auth/profile", requireAuth, (req, res) => {
  const { name, color, password } = req.body || {};
  if (name) db.prepare("UPDATE users SET name = ? WHERE id = ?").run(String(name).slice(0, 60), req.user!.id);
  if (color) db.prepare("UPDATE users SET color = ? WHERE id = ?").run(safeColor(color), req.user!.id);
  if (password) {
    if (String(password).length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(bcrypt.hashSync(String(password), 10), req.user!.id);
  }
  res.json({ user: sessionUser(req.user!.id) });
});

function safeColor(c: unknown): string {
  return typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c) ? c : "#3b82f6";
}

function sessionUser(id: number) {
  const row = db.prepare("SELECT id, email, name, color, is_admin FROM users WHERE id = ?").get(id) as {
    id: number; email: string; name: string; color: string; is_admin: number;
  };
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    color: row.color,
    isAdmin: !!row.is_admin,
    rooms: userRooms(row.id, !!row.is_admin)
  };
}

// ---------- Admin ----------

api.get("/admin/users", requireAuth, requireAdmin, (_req, res) => {
  const users = (db.prepare("SELECT id, email, name, color, is_admin, created_at FROM users ORDER BY id").all() as {
    id: number; email: string; name: string; color: string; is_admin: number; created_at: string;
  }[]).map((u) => ({
    id: u.id, email: u.email, name: u.name, color: u.color, isAdmin: !!u.is_admin,
    createdAt: u.created_at, rooms: userRooms(u.id, !!u.is_admin)
  }));
  res.json({ users });
});

api.post("/admin/users/:id/rooms", requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  setUserRooms(id, Array.isArray(req.body?.rooms) ? req.body.rooms : []);
  res.json({ ok: true });
});

api.post("/admin/users/:id/admin", requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user!.id && !req.body?.isAdmin) {
    return res.status(400).json({ error: "You cannot remove your own admin role" });
  }
  db.prepare("UPDATE users SET is_admin = ? WHERE id = ?").run(req.body?.isAdmin ? 1 : 0, id);
  res.json({ ok: true });
});

api.delete("/admin/users/:id", requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user!.id) return res.status(400).json({ error: "You cannot delete yourself" });
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
  res.json({ ok: true });
});

api.get("/admin/invites", requireAuth, requireAdmin, (_req, res) => {
  res.json({
    invites: db.prepare("SELECT id, email, token, rooms, is_admin, created_at, accepted_at FROM invites ORDER BY id DESC").all()
  });
});

api.post("/admin/invites", requireAuth, requireAdmin, (req, res) => {
  const email = String(req.body?.email || "").toLowerCase().trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: "Valid email required" });
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) {
    return res.status(409).json({ error: "This email already has an account" });
  }
  const token = crypto.randomBytes(24).toString("base64url");
  const rooms = JSON.stringify(Array.isArray(req.body?.rooms) ? req.body.rooms : []);
  db.prepare("INSERT INTO invites (email, token, rooms, is_admin, created_by) VALUES (?,?,?,?,?)").run(
    email, token, rooms, req.body?.isAdmin ? 1 : 0, req.user!.id
  );
  res.json({ token, link: `/invite/${token}` });
});

api.delete("/admin/invites/:id", requireAuth, requireAdmin, (req, res) => {
  db.prepare("DELETE FROM invites WHERE id = ? AND accepted_at IS NULL").run(Number(req.params.id));
  res.json({ ok: true });
});

// Integrations (Google Sheets)
api.get("/admin/integrations", requireAuth, requireAdmin, (_req, res) => {
  res.json({
    sheets: {
      configured: sheetsConfigured(),
      spreadsheetId: getSetting("sheets.spreadsheet_id") || "",
      serviceAccountEmail: (() => {
        try { return JSON.parse(getSetting("sheets.service_account") || "{}").client_email || ""; }
        catch { return ""; }
      })()
    }
  });
});

api.post("/admin/integrations/sheets", requireAuth, requireAdmin, (req, res) => {
  const { spreadsheetId, serviceAccountJson } = req.body || {};
  if (spreadsheetId !== undefined) setSetting("sheets.spreadsheet_id", String(spreadsheetId).trim());
  if (serviceAccountJson) {
    try {
      const parsed = JSON.parse(String(serviceAccountJson));
      if (!parsed.client_email || !parsed.private_key) throw new Error("missing fields");
      setSetting("sheets.service_account", JSON.stringify(parsed));
    } catch {
      return res.status(400).json({ error: "Service account JSON is invalid (needs client_email and private_key)" });
    }
  }
  res.json({ ok: true, configured: sheetsConfigured() });
});

// ---------- Google Sheets push / pull per resource ----------

api.post("/sheets/:resource/push", requireAuth, async (req, res) => {
  const def = RESOURCES[req.params.resource];
  if (!def) return res.status(404).json({ error: "Unknown resource" });
  if (!req.user!.isAdmin && !userRooms(req.user!.id, false).includes(def.room)) {
    return res.status(403).json({ error: `No access to ${def.room}` });
  }
  try {
    const rows = db.prepare(`SELECT id, ${def.columns.join(", ")} FROM ${def.table}`).all() as Record<string, unknown>[];
    const header = ["id", ...def.columns];
    const values = rows.map((r) => header.map((c) => (r[c] === null || r[c] === undefined ? "" : (r[c] as string | number))));
    const result = await pushRows(req.params.resource, header, values);
    res.json({ ok: true, pushed: result.rows });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Sheets push failed" });
  }
});

api.post("/sheets/:resource/pull", requireAuth, async (req, res) => {
  const def = RESOURCES[req.params.resource];
  if (!def) return res.status(404).json({ error: "Unknown resource" });
  if (!req.user!.isAdmin && !userRooms(req.user!.id, false).includes(def.room)) {
    return res.status(403).json({ error: `No access to ${def.room}` });
  }
  try {
    const { header, rows } = await pullRows(req.params.resource);
    if (header[0] !== "id") return res.status(400).json({ error: "Sheet tab must have an 'id' column first (push once to create the layout)" });
    const cols = header.slice(1).filter((c) => def.columns.includes(c));
    let updated = 0;
    let inserted = 0;
    const tx = db.transaction(() => {
      for (const row of rows) {
        const id = Number(row[0]);
        const values = cols.map((c) => row[header.indexOf(c)] ?? "");
        if (id && db.prepare(`SELECT id FROM ${def.table} WHERE id = ?`).get(id)) {
          db.prepare(`UPDATE ${def.table} SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`).run(...values, id);
          updated++;
        } else if (row.slice(1).some((v) => v !== "" && v !== undefined)) {
          db.prepare(`INSERT INTO ${def.table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`).run(...values);
          inserted++;
        }
      }
    });
    tx();
    res.json({ ok: true, updated, inserted });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Sheets pull failed" });
  }
});

// ---------- HR specials: attendance check-in/out ----------

api.get("/hr/attendance", requireAuth, requireRoom("hr"), (_req, res) => {
  const rows = db.prepare(`
    SELECT a.id, a.user_id, u.name, a.date, a.check_in, a.check_out
    FROM attendance a JOIN users u ON u.id = a.user_id
    ORDER BY a.date DESC, a.check_in DESC LIMIT 100
  `).all();
  res.json({ items: rows });
});

api.post("/hr/checkin", requireAuth, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toTimeString().slice(0, 8);
  const existing = db.prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ?").get(req.user!.id, today) as
    | { id: number; check_in: string | null; check_out: string | null }
    | undefined;
  if (!existing) {
    db.prepare("INSERT INTO attendance (user_id, date, check_in) VALUES (?,?,?)").run(req.user!.id, today, now);
    return res.json({ action: "checked_in", time: now });
  }
  if (!existing.check_out) {
    db.prepare("UPDATE attendance SET check_out = ? WHERE id = ?").run(now, existing.id);
    return res.json({ action: "checked_out", time: now });
  }
  res.json({ action: "already_done", checkIn: existing.check_in, checkOut: existing.check_out });
});

api.get("/hr/my-attendance", requireAuth, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const row = db.prepare("SELECT date, check_in, check_out FROM attendance WHERE user_id = ? AND date = ?").get(req.user!.id, today);
  res.json({ today: row || null });
});

// ---------- Games: leaderboard ----------

api.get("/games/leaderboard/:game", requireAuth, requireRoom("games"), (req, res) => {
  const rows = db.prepare(`
    SELECT u.name, u.color, MAX(s.score) AS best
    FROM game_scores s JOIN users u ON u.id = s.user_id
    WHERE s.game = ? GROUP BY s.user_id ORDER BY best DESC LIMIT 10
  `).all(req.params.game);
  res.json({ scores: rows });
});

api.post("/games/score", requireAuth, requireRoom("games"), (req, res) => {
  const { game, score } = req.body || {};
  if (typeof game !== "string" || typeof score !== "number" || !isFinite(score)) {
    return res.status(400).json({ error: "game and numeric score required" });
  }
  db.prepare("INSERT INTO game_scores (user_id, game, score) VALUES (?,?,?)").run(req.user!.id, game.slice(0, 30), score);
  res.json({ ok: true });
});

// ---------- Dashboard summary (HUD panel) ----------

api.get("/summary", requireAuth, (_req, res) => {
  const num = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  const income = (db.prepare("SELECT COALESCE(SUM(amount),0) AS n FROM fin_transactions WHERE type='income'").get() as { n: number }).n;
  const expense = (db.prepare("SELECT COALESCE(SUM(amount),0) AS n FROM fin_transactions WHERE type='expense'").get() as { n: number }).n;
  res.json({
    online: onlineCount(),
    openTasks: num("SELECT COUNT(*) AS n FROM tasks WHERE status != 'done'"),
    activeProjects: num("SELECT COUNT(*) AS n FROM projects WHERE status = 'active'"),
    balance: income - expense,
    leads: num("SELECT COUNT(*) AS n FROM crm_contacts WHERE status = 'lead'"),
    pendingLeave: num("SELECT COUNT(*) AS n FROM leave_requests WHERE status = 'pending'"),
    workflowItems: num("SELECT COUNT(*) AS n FROM workflow_items"),
    sheetsConfigured: sheetsConfigured()
  });
});

// ---------- Generic module CRUD ----------

for (const [name, def] of Object.entries(RESOURCES)) {
  const base = `/${name}`;
  api.get(base, requireAuth, requireRoom(def.room), (_req, res) => {
    const rows = db.prepare(`SELECT * FROM ${def.table} ORDER BY ${def.orderBy || "id DESC"}`).all();
    res.json({ items: rows });
  });

  api.post(base, requireAuth, requireRoom(def.room), (req, res) => {
    const cols = def.columns.filter((c) => req.body?.[c] !== undefined);
    if (cols.length === 0) return res.status(400).json({ error: "No fields provided" });
    const info = db
      .prepare(`INSERT INTO ${def.table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`)
      .run(...cols.map((c) => req.body[c]));
    const row = db.prepare(`SELECT * FROM ${def.table} WHERE id = ?`).get(info.lastInsertRowid);
    res.json({ item: row });
  });

  api.put(`${base}/:id`, requireAuth, requireRoom(def.room), (req, res) => {
    const cols = def.columns.filter((c) => req.body?.[c] !== undefined);
    if (cols.length === 0) return res.status(400).json({ error: "No fields provided" });
    const sets = cols.map((c) => `${c} = ?`).join(", ");
    const extra = def.table === "documents" || def.table === "workflow_items" ? ", updated_at = datetime('now')" : "";
    db.prepare(`UPDATE ${def.table} SET ${sets}${extra} WHERE id = ?`).run(...cols.map((c) => req.body[c]), Number(req.params.id));
    const row = db.prepare(`SELECT * FROM ${def.table} WHERE id = ?`).get(Number(req.params.id));
    res.json({ item: row });
  });

  api.delete(`${base}/:id`, requireAuth, requireRoom(def.room), (req, res) => {
    db.prepare(`DELETE FROM ${def.table} WHERE id = ?`).run(Number(req.params.id));
    res.json({ ok: true });
  });
}

// ---------- Static client (production) ----------

const distDir = path.join(process.cwd(), "dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api|\/ws).*/, (_req, res) => res.sendFile(path.join(distDir, "index.html")));
}

const PORT = Number(process.env.PORT || 4000);
const server = http.createServer(app);
attachWs(server);
server.listen(PORT, () => console.log(`[felic] server on :${PORT}`));
