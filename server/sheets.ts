// Google Sheets sync without the heavyweight googleapis SDK: we sign a
// service-account JWT with node:crypto and talk to the Sheets REST API.
//
// Configure via the admin console (stored in the settings table):
//   sheets.service_account — full service-account JSON key
//   sheets.spreadsheet_id  — target spreadsheet id
// The spreadsheet must be shared with the service account's client_email.

import { createSign } from "node:crypto";
import { getSetting } from "./db.ts";

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function accessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600
    })
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const signature = b64url(signer.sign(sa.private_key));
  const jwt = `${header}.${claims}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

function config(): { sa: ServiceAccount; spreadsheetId: string } {
  const saJson = getSetting("sheets.service_account");
  const spreadsheetId = getSetting("sheets.spreadsheet_id");
  if (!saJson || !spreadsheetId) {
    throw new Error("Google Sheets is not configured. Set the service account key and spreadsheet id in Admin → Integrations.");
  }
  let sa: ServiceAccount;
  try {
    sa = JSON.parse(saJson);
  } catch {
    throw new Error("Stored service account key is not valid JSON.");
  }
  if (!sa.client_email || !sa.private_key) throw new Error("Service account key is missing client_email/private_key.");
  return { sa, spreadsheetId };
}

async function api(token: string, spreadsheetId: string, pathAndQuery: string, init?: RequestInit) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}${pathAndQuery}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers || {}) }
  });
  if (!res.ok) throw new Error(`Sheets API error (${res.status}): ${await res.text()}`);
  return res.json();
}

async function ensureTab(token: string, spreadsheetId: string, title: string) {
  const meta = (await api(token, spreadsheetId, "?fields=sheets.properties.title")) as {
    sheets?: { properties: { title: string } }[];
  };
  const exists = meta.sheets?.some((s) => s.properties.title === title);
  if (!exists) {
    await api(token, spreadsheetId, ":batchUpdate", {
      method: "POST",
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] })
    });
  }
}

/** Overwrite the tab named `tab` with header + rows. */
export async function pushRows(tab: string, header: string[], rows: (string | number | null)[][]) {
  const { sa, spreadsheetId } = config();
  const token = await accessToken(sa);
  await ensureTab(token, spreadsheetId, tab);
  await api(token, spreadsheetId, `/values/${encodeURIComponent(tab)}:clear`, { method: "POST", body: "{}" });
  await api(token, spreadsheetId, `/values/${encodeURIComponent(tab)}?valueInputOption=RAW`, {
    method: "PUT",
    body: JSON.stringify({ values: [header, ...rows.map((r) => r.map((v) => (v === null ? "" : v)))] })
  });
  return { rows: rows.length };
}

/** Read all rows from `tab`; first row is treated as the header. */
export async function pullRows(tab: string): Promise<{ header: string[]; rows: string[][] }> {
  const { sa, spreadsheetId } = config();
  const token = await accessToken(sa);
  const data = (await api(token, spreadsheetId, `/values/${encodeURIComponent(tab)}`)) as { values?: string[][] };
  const values = data.values || [];
  if (values.length === 0) return { header: [], rows: [] };
  return { header: values[0], rows: values.slice(1) };
}

export function sheetsConfigured(): boolean {
  return !!(getSetting("sheets.service_account") && getSetting("sheets.spreadsheet_id"));
}
