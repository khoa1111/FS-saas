import { Hono } from "hono";
import type { Context, Next } from "hono";
import { hashPassword, signJwt, verifyJwt, verifyPassword } from "./auth";
import {
  ensureReady, getSetting, setSetting, sessionUser, setUserRooms, userRooms, type DbUser
} from "./db";
import { jwtSecret, type Env } from "./env";
import { RESOURCES } from "./modules";
import { pullRows, pushRows, sheetsConfigured } from "./sheets";

export { OfficeRoom } from "./office";

interface AuthedUser {
  id: number;
  email: string;
  name: string;
  color: string;
  isAdmin: boolean;
}

type Vars = { user: AuthedUser };
const app = new Hono<{ Bindings: Env; Variables: Vars }>().basePath("/api");

app.use("*", async (c, next) => {
  await ensureReady(c.env);
  await next();
});

// ---------- auth middleware ----------

async function requireAuth(c: Context<{ Bindings: Env; Variables: Vars }>, next: Next) {
  const header = c.req.header("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const payload = token ? await verifyJwt(token, jwtSecret(c.env)) : null;
  const uid = payload && typeof payload.uid === "number" ? payload.uid : null;
  if (!uid) return c.json({ error: "Not authenticated" }, 401);
  const row = await c.env.DB.prepare("SELECT id, email, name, color, is_admin FROM users WHERE id = ?")
    .bind(uid).first<DbUser>();
  if (!row) return c.json({ error: "Not authenticated" }, 401);
  c.set("user", { id: row.id, email: row.email, name: row.name, color: row.color, isAdmin: !!row.is_admin });
  await next();
}

async function requireAdmin(c: Context<{ Bindings: Env; Variables: Vars }>, next: Next) {
  if (!c.get("user")?.isAdmin) return c.json({ error: "Admin only" }, 403);
  await next();
}

function requireRoom(room: string) {
  return async (c: Context<{ Bindings: Env; Variables: Vars }>, next: Next) => {
    const user = c.get("user");
    if (!user.isAdmin) {
      const rooms = await userRooms(c.env, user.id, false);
      if (!rooms.includes(room)) return c.json({ error: `No access to ${room}` }, 403);
    }
    await next();
  };
}

function safeColor(x: unknown): string {
  return typeof x === "string" && /^#[0-9a-fA-F]{6}$/.test(x) ? x : "#3b82f6";
}

// ---------- auth ----------

app.post("/auth/login", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = String(body.email || "").toLowerCase().trim();
  const row = await c.env.DB.prepare("SELECT * FROM users WHERE email = ?")
    .bind(email).first<DbUser & { password_hash: string }>();
  if (!row || !(await verifyPassword(String(body.password || ""), row.password_hash))) {
    return c.json({ error: "Wrong email or password" }, 401);
  }
  return c.json({ token: await signJwt({ uid: row.id }, jwtSecret(c.env)), user: await sessionUser(c.env, row.id) });
});

app.get("/auth/me", requireAuth, async (c) => {
  return c.json({ user: await sessionUser(c.env, c.get("user").id) });
});

app.get("/auth/invite/:token", async (c) => {
  const inv = await c.env.DB.prepare("SELECT email, accepted_at FROM invites WHERE token = ?")
    .bind(c.req.param("token")).first<{ email: string; accepted_at: string | null }>();
  if (!inv) return c.json({ error: "Invite not found" }, 404);
  if (inv.accepted_at) return c.json({ error: "Invite already used" }, 410);
  return c.json({ email: inv.email });
});

app.post("/auth/invite/:token/accept", async (c) => {
  const inv = await c.env.DB.prepare("SELECT * FROM invites WHERE token = ?")
    .bind(c.req.param("token"))
    .first<{ id: number; email: string; rooms: string; is_admin: number; accepted_at: string | null }>();
  if (!inv) return c.json({ error: "Invite not found" }, 404);
  if (inv.accepted_at) return c.json({ error: "Invite already used" }, 410);

  const body = await c.req.json().catch(() => ({}));
  const { name, password, color } = body;
  if (!name || String(password || "").length < 6) {
    return c.json({ error: "Name required and password must be at least 6 characters" }, 400);
  }
  const existing = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(inv.email).first();
  if (existing) return c.json({ error: "An account with this email already exists" }, 409);

  const hash = await hashPassword(String(password));
  const res = await c.env.DB.prepare("INSERT INTO users (email, name, password_hash, color, is_admin) VALUES (?,?,?,?,?)")
    .bind(inv.email, String(name).slice(0, 60), hash, safeColor(color), inv.is_admin).run();
  const userId = Number(res.meta.last_row_id);
  await setUserRooms(c.env, userId, JSON.parse(inv.rooms || "[]"));
  await c.env.DB.prepare("UPDATE invites SET accepted_at = datetime('now') WHERE id = ?").bind(inv.id).run();
  return c.json({ token: await signJwt({ uid: userId }, jwtSecret(c.env)), user: await sessionUser(c.env, userId) });
});

app.post("/auth/profile", requireAuth, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const uid = c.get("user").id;
  if (body.name) {
    await c.env.DB.prepare("UPDATE users SET name = ? WHERE id = ?").bind(String(body.name).slice(0, 60), uid).run();
  }
  if (body.color) {
    await c.env.DB.prepare("UPDATE users SET color = ? WHERE id = ?").bind(safeColor(body.color), uid).run();
  }
  if (body.password) {
    if (String(body.password).length < 6) return c.json({ error: "Password must be at least 6 characters" }, 400);
    await c.env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?")
      .bind(await hashPassword(String(body.password)), uid).run();
  }
  return c.json({ user: await sessionUser(c.env, uid) });
});

// ---------- admin ----------

app.get("/admin/users", requireAuth, requireAdmin, async (c) => {
  const rows = await c.env.DB.prepare("SELECT id, email, name, color, is_admin, created_at FROM users ORDER BY id")
    .all<DbUser & { created_at: string }>();
  const users = [];
  for (const u of rows.results ?? []) {
    users.push({
      id: u.id, email: u.email, name: u.name, color: u.color, isAdmin: !!u.is_admin,
      createdAt: u.created_at, rooms: await userRooms(c.env, u.id, !!u.is_admin)
    });
  }
  return c.json({ users });
});

app.post("/admin/users/:id/rooms", requireAuth, requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  await setUserRooms(c.env, Number(c.req.param("id")), Array.isArray(body.rooms) ? body.rooms : []);
  return c.json({ ok: true });
});

app.post("/admin/users/:id/admin", requireAuth, requireAdmin, async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json().catch(() => ({}));
  if (id === c.get("user").id && !body.isAdmin) {
    return c.json({ error: "You cannot remove your own admin role" }, 400);
  }
  await c.env.DB.prepare("UPDATE users SET is_admin = ? WHERE id = ?").bind(body.isAdmin ? 1 : 0, id).run();
  return c.json({ ok: true });
});

app.delete("/admin/users/:id", requireAuth, requireAdmin, async (c) => {
  const id = Number(c.req.param("id"));
  if (id === c.get("user").id) return c.json({ error: "You cannot delete yourself" }, 400);
  await c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});

app.get("/admin/invites", requireAuth, requireAdmin, async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT id, email, token, rooms, is_admin, created_at, accepted_at FROM invites ORDER BY id DESC"
  ).all();
  return c.json({ invites: rows.results ?? [] });
});

app.post("/admin/invites", requireAuth, requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = String(body.email || "").toLowerCase().trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return c.json({ error: "Valid email required" }, 400);
  if (await c.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first()) {
    return c.json({ error: "This email already has an account" }, 409);
  }
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const rooms = JSON.stringify(Array.isArray(body.rooms) ? body.rooms : []);
  await c.env.DB.prepare("INSERT INTO invites (email, token, rooms, is_admin, created_by) VALUES (?,?,?,?,?)")
    .bind(email, token, rooms, body.isAdmin ? 1 : 0, c.get("user").id).run();
  return c.json({ token, link: `/invite/${token}` });
});

app.delete("/admin/invites/:id", requireAuth, requireAdmin, async (c) => {
  await c.env.DB.prepare("DELETE FROM invites WHERE id = ? AND accepted_at IS NULL")
    .bind(Number(c.req.param("id"))).run();
  return c.json({ ok: true });
});

app.get("/admin/integrations", requireAuth, requireAdmin, async (c) => {
  let serviceAccountEmail = "";
  try {
    serviceAccountEmail = JSON.parse((await getSetting(c.env, "sheets.service_account")) || "{}").client_email || "";
  } catch {
    /* unset */
  }
  return c.json({
    sheets: {
      configured: await sheetsConfigured(c.env),
      spreadsheetId: (await getSetting(c.env, "sheets.spreadsheet_id")) || "",
      serviceAccountEmail
    }
  });
});

app.post("/admin/integrations/sheets", requireAuth, requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (body.spreadsheetId !== undefined) await setSetting(c.env, "sheets.spreadsheet_id", String(body.spreadsheetId).trim());
  if (body.serviceAccountJson) {
    try {
      const parsed = JSON.parse(String(body.serviceAccountJson));
      if (!parsed.client_email || !parsed.private_key) throw new Error("missing fields");
      await setSetting(c.env, "sheets.service_account", JSON.stringify(parsed));
    } catch {
      return c.json({ error: "Service account JSON is invalid (needs client_email and private_key)" }, 400);
    }
  }
  return c.json({ ok: true, configured: await sheetsConfigured(c.env) });
});

// ---------- Google Sheets push / pull per resource ----------

app.post("/sheets/:resource/push", requireAuth, async (c) => {
  const resource = c.req.param("resource") ?? "";
  const def = RESOURCES[resource];
  if (!def) return c.json({ error: "Unknown resource" }, 404);
  const user = c.get("user");
  if (!user.isAdmin && !(await userRooms(c.env, user.id, false)).includes(def.room)) {
    return c.json({ error: `No access to ${def.room}` }, 403);
  }
  try {
    const rows = await c.env.DB.prepare(`SELECT id, ${def.columns.join(", ")} FROM ${def.table}`)
      .all<Record<string, unknown>>();
    const header = ["id", ...def.columns];
    const values = (rows.results ?? []).map((r) =>
      header.map((col) => (r[col] === null || r[col] === undefined ? "" : (r[col] as string | number)))
    );
    const result = await pushRows(c.env, resource, header, values);
    return c.json({ ok: true, pushed: result.rows });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Sheets push failed" }, 502);
  }
});

app.post("/sheets/:resource/pull", requireAuth, async (c) => {
  const resource = c.req.param("resource") ?? "";
  const def = RESOURCES[resource];
  if (!def) return c.json({ error: "Unknown resource" }, 404);
  const user = c.get("user");
  if (!user.isAdmin && !(await userRooms(c.env, user.id, false)).includes(def.room)) {
    return c.json({ error: `No access to ${def.room}` }, 403);
  }
  try {
    const { header, rows } = await pullRows(c.env, resource);
    if (header[0] !== "id") {
      return c.json({ error: "Sheet tab must have an 'id' column first (push once to create the layout)" }, 400);
    }
    const cols = header.slice(1).filter((col) => def.columns.includes(col));
    let updated = 0;
    let inserted = 0;
    for (const row of rows) {
      const id = Number(row[0]);
      const values = cols.map((col) => row[header.indexOf(col)] ?? "");
      if (id && (await c.env.DB.prepare(`SELECT id FROM ${def.table} WHERE id = ?`).bind(id).first())) {
        await c.env.DB.prepare(`UPDATE ${def.table} SET ${cols.map((col) => `${col} = ?`).join(", ")} WHERE id = ?`)
          .bind(...values, id).run();
        updated++;
      } else if (row.slice(1).some((v) => v !== "" && v !== undefined)) {
        await c.env.DB.prepare(
          `INSERT INTO ${def.table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`
        ).bind(...values).run();
        inserted++;
      }
    }
    return c.json({ ok: true, updated, inserted });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Sheets pull failed" }, 502);
  }
});

// ---------- HR specials: attendance check-in/out ----------

app.get("/hr/attendance", requireAuth, requireRoom("hr"), async (c) => {
  const rows = await c.env.DB.prepare(`
    SELECT a.id, a.user_id, u.name, a.date, a.check_in, a.check_out
    FROM attendance a JOIN users u ON u.id = a.user_id
    ORDER BY a.date DESC, a.check_in DESC LIMIT 100
  `).all();
  return c.json({ items: rows.results ?? [] });
});

app.post("/hr/checkin", requireAuth, async (c) => {
  const uid = c.get("user").id;
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toTimeString().slice(0, 8);
  const existing = await c.env.DB.prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ?")
    .bind(uid, today).first<{ id: number; check_in: string | null; check_out: string | null }>();
  if (!existing) {
    await c.env.DB.prepare("INSERT INTO attendance (user_id, date, check_in) VALUES (?,?,?)").bind(uid, today, now).run();
    return c.json({ action: "checked_in", time: now });
  }
  if (!existing.check_out) {
    await c.env.DB.prepare("UPDATE attendance SET check_out = ? WHERE id = ?").bind(now, existing.id).run();
    return c.json({ action: "checked_out", time: now });
  }
  return c.json({ action: "already_done", checkIn: existing.check_in, checkOut: existing.check_out });
});

app.get("/hr/my-attendance", requireAuth, async (c) => {
  const today = new Date().toISOString().slice(0, 10);
  const row = await c.env.DB.prepare("SELECT date, check_in, check_out FROM attendance WHERE user_id = ? AND date = ?")
    .bind(c.get("user").id, today).first();
  return c.json({ today: row || null });
});

// ---------- games ----------

app.get("/games/leaderboard/:game", requireAuth, requireRoom("games"), async (c) => {
  const rows = await c.env.DB.prepare(`
    SELECT u.name, u.color, MAX(s.score) AS best
    FROM game_scores s JOIN users u ON u.id = s.user_id
    WHERE s.game = ? GROUP BY s.user_id ORDER BY best DESC LIMIT 10
  `).bind(c.req.param("game")).all();
  return c.json({ scores: rows.results ?? [] });
});

app.post("/games/score", requireAuth, requireRoom("games"), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { game, score } = body;
  if (typeof game !== "string" || typeof score !== "number" || !isFinite(score)) {
    return c.json({ error: "game and numeric score required" }, 400);
  }
  await c.env.DB.prepare("INSERT INTO game_scores (user_id, game, score) VALUES (?,?,?)")
    .bind(c.get("user").id, game.slice(0, 30), score).run();
  return c.json({ ok: true });
});

// ---------- dashboard summary ----------

app.get("/summary", requireAuth, async (c) => {
  const num = async (sql: string) => (await c.env.DB.prepare(sql).first<{ n: number }>())?.n ?? 0;
  const income = await num("SELECT COALESCE(SUM(amount),0) AS n FROM fin_transactions WHERE type='income'");
  const expense = await num("SELECT COALESCE(SUM(amount),0) AS n FROM fin_transactions WHERE type='expense'");

  let online = 0;
  try {
    const id = c.env.OFFICE.idFromName("main");
    const res = await c.env.OFFICE.get(id).fetch("https://office/online");
    online = ((await res.json()) as { online: number }).online;
  } catch {
    /* office DO cold */
  }

  return c.json({
    online,
    openTasks: await num("SELECT COUNT(*) AS n FROM tasks WHERE status != 'done'"),
    activeProjects: await num("SELECT COUNT(*) AS n FROM projects WHERE status = 'active'"),
    balance: income - expense,
    leads: await num("SELECT COUNT(*) AS n FROM crm_contacts WHERE status = 'lead'"),
    pendingLeave: await num("SELECT COUNT(*) AS n FROM leave_requests WHERE status = 'pending'"),
    workflowItems: await num("SELECT COUNT(*) AS n FROM workflow_items"),
    sheetsConfigured: await sheetsConfigured(c.env)
  });
});

// ---------- generic module CRUD ----------

for (const [name, def] of Object.entries(RESOURCES)) {
  app.get(`/${name}`, requireAuth, requireRoom(def.room), async (c) => {
    const rows = await c.env.DB.prepare(`SELECT * FROM ${def.table} ORDER BY ${def.orderBy || "id DESC"}`).all();
    return c.json({ items: rows.results ?? [] });
  });

  app.post(`/${name}`, requireAuth, requireRoom(def.room), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const cols = def.columns.filter((col) => body[col] !== undefined);
    if (cols.length === 0) return c.json({ error: "No fields provided" }, 400);
    const res = await c.env.DB.prepare(
      `INSERT INTO ${def.table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`
    ).bind(...cols.map((col) => body[col])).run();
    const row = await c.env.DB.prepare(`SELECT * FROM ${def.table} WHERE id = ?`).bind(res.meta.last_row_id).first();
    return c.json({ item: row });
  });

  app.put(`/${name}/:id`, requireAuth, requireRoom(def.room), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const cols = def.columns.filter((col) => body[col] !== undefined);
    if (cols.length === 0) return c.json({ error: "No fields provided" }, 400);
    const sets = cols.map((col) => `${col} = ?`).join(", ");
    const extra = def.table === "documents" || def.table === "workflow_items" ? ", updated_at = datetime('now')" : "";
    const id = Number(c.req.param("id"));
    await c.env.DB.prepare(`UPDATE ${def.table} SET ${sets}${extra} WHERE id = ?`)
      .bind(...cols.map((col) => body[col]), id).run();
    const row = await c.env.DB.prepare(`SELECT * FROM ${def.table} WHERE id = ?`).bind(id).first();
    return c.json({ item: row });
  });

  app.delete(`/${name}/:id`, requireAuth, requireRoom(def.room), async (c) => {
    await c.env.DB.prepare(`DELETE FROM ${def.table} WHERE id = ?`).bind(Number(c.req.param("id"))).run();
    return c.json({ ok: true });
  });
}

// ---------- worker entry: /api → Hono, /ws → Durable Object ----------

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/ws") {
      await ensureReady(env);
      const id = env.OFFICE.idFromName("main");
      return env.OFFICE.get(id).fetch(request);
    }
    if (url.pathname.startsWith("/api/")) {
      return app.fetch(request, env, ctx);
    }
    // Everything else (when run_worker_first matches broadly) falls back to assets.
    return env.ASSETS.fetch(request);
  }
};
