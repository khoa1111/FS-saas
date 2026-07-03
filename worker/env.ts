export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  OFFICE: DurableObjectNamespace;
  JWT_SECRET?: string;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
}

export function jwtSecret(env: Env): string {
  // Set a real secret in production: `wrangler secret put JWT_SECRET`
  return env.JWT_SECRET || "felic-dev-secret-change-me";
}
