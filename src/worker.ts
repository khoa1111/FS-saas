const ALL_ROOMS = ["finance", "documents", "hr", "projects", "workflow", "crm", "games"] as const;

type RoomId = (typeof ALL_ROOMS)[number];

interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
  JWT_SECRET?: string;
}

interface SessionUser {
  id: number;
  email: string;
  name: string;
  color: string;
  isAdmin: boolean;
  rooms: RoomId[];
}

const json = (body: unknown, init: ResponseInit = {}) =>
  Response.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...(init.headers || {})
    }
  });

const notReady = (feature: string) =>
  json(
    {
      error: "API_NOT_MIGRATED_TO_WORKERS",
      message: `${feature} is not migrated to Cloudflare Workers yet. The static office is deployed; full SaaS data, realtime presence, invites, and admin CRUD still require the Express server until the D1/Durable Objects migration is completed.`
    },
    { status: 501 }
  );

function adminUser(env: Env): SessionUser {
  const email = (env.ADMIN_EMAIL || "admin@felic.studio").toLowerCase();
  const name = email.split("@")[0]?.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Admin";
  return {
    id: 1,
    email,
    name,
    color: "#3b82f6",
    isAdmin: true,
    rooms: [...ALL_ROOMS]
  };
}

function base64Url(bytes: ArrayBuffer | Uint8Array) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return base64Url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

function getAuthSecret(env: Env) {
  return env.JWT_SECRET || env.ADMIN_PASSWORD || null;
}

async function makeToken(user: SessionUser, env: Env) {
  const secret = getAuthSecret(env);
  if (!secret) throw new Error("ADMIN_PASSWORD is required for Worker authentication");
  const payload = base64Url(new TextEncoder().encode(JSON.stringify({ sub: user.id, email: user.email, iat: Date.now() })));
  const sig = await sign(payload, secret);
  return `${payload}.${sig}`;
}

async function verifyToken(request: Request, env: Env) {
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const secret = getAuthSecret(env);
  if (!secret) return null;
  const expected = await sign(payload, secret);
  if (sig !== expected) return null;
  try {
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { email?: string };
    const user = adminUser(env);
    return decoded.email?.toLowerCase() === user.email ? user : null;
  } catch {
    return null;
  }
}

async function handleApi(request: Request, env: Env) {
  const url = new URL(request.url);
  const path = url.pathname.slice("/api".length) || "/";

  if (request.method === "OPTIONS") return new Response(null, { status: 204 });

  if (path === "/auth/login" && request.method === "POST") {
    const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string };
    const expectedEmail = (env.ADMIN_EMAIL || "admin@felic.studio").toLowerCase().trim();
    const expectedPassword = env.ADMIN_PASSWORD;
    if (!expectedPassword) {
      return json({ error: "ADMIN_PASSWORD is required for Worker login" }, { status: 503 });
    }
    if ((body.email || "").toLowerCase().trim() !== expectedEmail || body.password !== expectedPassword) {
      return json({ error: "Wrong email or password" }, { status: 401 });
    }
    const user = adminUser(env);
    return json({ token: await makeToken(user, env), user });
  }

  if (path === "/auth/me" && request.method === "GET") {
    const user = await verifyToken(request, env);
    return user ? json({ user }) : json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await verifyToken(request, env);
  if (!user) return json({ error: "Unauthorized" }, { status: 401 });

  if (path === "/summary" && request.method === "GET") {
    return json({
      online: 1,
      openTasks: 0,
      activeProjects: 0,
      balance: 0,
      leads: 0,
      pendingLeave: 0,
      workflowItems: 0,
      sheetsConfigured: false
    });
  }

  if (request.method === "GET" && /^\/(finance|documents|employees|attendance|leave-requests|projects|tasks|workflows|workflow-items|crm-contacts|crm-deals|games\/leaderboard\/[^/]+)$/.test(path)) {
    return json({ items: [], scores: [] });
  }

  return notReady(`API route ${request.method} ${path}`);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) return handleApi(request, env);

    if (url.pathname === "/ws") {
      return notReady("Realtime WebSocket presence");
    }

    return env.ASSETS.fetch(request);
  }
};
