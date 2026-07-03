import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import { useStore } from "../store";
import { ALL_ROOMS, ROOM_LABELS, type RoomId } from "../../shared/types";

interface AdminUser {
  id: number; email: string; name: string; color: string; isAdmin: boolean; createdAt: string; rooms: RoomId[];
}
interface InviteRow {
  id: number; email: string; token: string; rooms: string; is_admin: number; created_at: string; accepted_at: string | null;
}
interface Integrations {
  sheets: { configured: boolean; spreadsheetId: string; serviceAccountEmail: string };
}

export default function AdminApp() {
  const me = useStore((s) => s.user)!;
  const showToast = useStore((s) => s.showToast);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [integrations, setIntegrations] = useState<Integrations | null>(null);

  const [invEmail, setInvEmail] = useState("");
  const [invRooms, setInvRooms] = useState<RoomId[]>([...ALL_ROOMS]);
  const [invAdmin, setInvAdmin] = useState(false);
  const [lastLink, setLastLink] = useState("");

  const [sheetId, setSheetId] = useState("");
  const [saJson, setSaJson] = useState("");

  const load = () => {
    api.get<{ users: AdminUser[] }>("/admin/users").then((r) => setUsers(r.users)).catch(() => {});
    api.get<{ invites: InviteRow[] }>("/admin/invites").then((r) => setInvites(r.invites)).catch(() => {});
    api.get<Integrations>("/admin/integrations").then((r) => {
      setIntegrations(r);
      setSheetId(r.sheets.spreadsheetId);
    }).catch(() => {});
  };
  useEffect(load, []);

  async function toggleRoom(u: AdminUser, room: RoomId) {
    const rooms = u.rooms.includes(room) ? u.rooms.filter((r) => r !== room) : [...u.rooms, room];
    try {
      await api.post(`/admin/users/${u.id}/rooms`, { rooms });
      load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed");
    }
  }

  async function toggleAdmin(u: AdminUser) {
    try {
      await api.post(`/admin/users/${u.id}/admin`, { isAdmin: !u.isAdmin });
      load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed");
    }
  }

  async function deleteUser(u: AdminUser) {
    if (!confirm(`Remove ${u.name} (${u.email})? This deletes their account.`)) return;
    try {
      await api.del(`/admin/users/${u.id}`);
      load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed");
    }
  }

  async function createInvite(e: FormEvent) {
    e.preventDefault();
    try {
      const r = await api.post<{ link: string }>("/admin/invites", {
        email: invEmail, rooms: invRooms, isAdmin: invAdmin
      });
      setLastLink(`${location.origin}${r.link}`);
      setInvEmail("");
      load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Invite failed");
    }
  }

  async function saveSheets(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post("/admin/integrations/sheets", {
        spreadsheetId: sheetId,
        ...(saJson.trim() ? { serviceAccountJson: saJson } : {})
      });
      setSaJson("");
      showToast("Google Sheets settings saved");
      load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Save failed");
    }
  }

  return (
    <div>
      <div className="section">
        <h4>Crew & room access <span className="mlabel">{users.length} accounts</span></h4>
        <table className="grid">
          <thead><tr><th>Agent</th><th>Email</th><th>Rooms</th><th>Admin</th><th /></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                  <span className="dot" style={{ background: u.color, marginRight: 6 }} />
                  {u.name}
                </td>
                <td style={{ color: "var(--ink-2)" }}>{u.email}</td>
                <td>
                  {u.isAdmin ? (
                    <span className="pill orange">all rooms (admin)</span>
                  ) : (
                    <div className="room-checks">
                      {ALL_ROOMS.map((room) => (
                        <label key={room} className={u.rooms.includes(room) ? "on" : ""}>
                          <input type="checkbox" checked={u.rooms.includes(room)} onChange={() => toggleRoom(u, room)} />
                          {ROOM_LABELS[room]}
                        </label>
                      ))}
                    </div>
                  )}
                </td>
                <td>
                  <button
                    className={`btn sm ${u.isAdmin ? "orange" : "ghost"}`}
                    disabled={u.id === me.id}
                    onClick={() => toggleAdmin(u)}
                  >
                    {u.isAdmin ? "admin" : "member"}
                  </button>
                </td>
                <td>
                  <button className="btn danger sm" disabled={u.id === me.id} onClick={() => deleteUser(u)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h4>Invite a teammate</h4>
        <form onSubmit={createInvite}>
          <div className="formrow">
            <div className="field wide">
              <label>Email to invite</label>
              <input type="email" value={invEmail} onChange={(e) => setInvEmail(e.target.value)} placeholder="new@felic.studio" required />
            </div>
            <div className="field" style={{ flex: 3 }}>
              <label>Room access</label>
              <div className="room-checks">
                {ALL_ROOMS.map((room) => (
                  <label key={room} className={invRooms.includes(room) ? "on" : ""}>
                    <input
                      type="checkbox"
                      checked={invRooms.includes(room)}
                      onChange={() =>
                        setInvRooms(invRooms.includes(room) ? invRooms.filter((r) => r !== room) : [...invRooms, room])
                      }
                    />
                    {ROOM_LABELS[room]}
                  </label>
                ))}
                <label className={invAdmin ? "on" : ""}>
                  <input type="checkbox" checked={invAdmin} onChange={() => setInvAdmin(!invAdmin)} />
                  ★ admin
                </label>
              </div>
            </div>
            <button className="btn orange">Create invite</button>
          </div>
        </form>
        {lastLink && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="invite-link">{lastLink}</span>
            <button className="btn ghost sm" onClick={() => { navigator.clipboard.writeText(lastLink); showToast("Invite link copied"); }}>
              Copy
            </button>
          </div>
        )}
        {invites.filter((i) => !i.accepted_at).length > 0 && (
          <table className="grid" style={{ marginTop: 12 }}>
            <thead><tr><th>Pending invite</th><th>Link</th><th>Created</th><th /></tr></thead>
            <tbody>
              {invites.filter((i) => !i.accepted_at).map((i) => (
                <tr key={i.id}>
                  <td style={{ fontWeight: 700 }}>{i.email}{i.is_admin ? " ★" : ""}</td>
                  <td>
                    <button
                      className="btn ghost sm"
                      onClick={() => { navigator.clipboard.writeText(`${location.origin}/invite/${i.token}`); showToast("Link copied"); }}
                    >
                      Copy link
                    </button>
                  </td>
                  <td style={{ color: "var(--muted)" }}>{i.created_at.slice(0, 10)}</td>
                  <td>
                    <button className="btn danger sm" onClick={async () => { await api.del(`/admin/invites/${i.id}`); load(); }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="section">
        <h4>
          Google Sheets integration
          <span className="mlabel" style={{ color: integrations?.sheets.configured ? "var(--good)" : undefined }}>
            {integrations?.sheets.configured ? `LINKED · ${integrations.sheets.serviceAccountEmail}` : "NOT CONFIGURED"}
          </span>
        </h4>
        <p style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 0 }}>
          Create a Google Cloud service account with the Sheets API enabled, share your spreadsheet with its
          <code> client_email</code>, then paste the JSON key below. Every module gets ⇡ push / ⇣ pull buttons.
        </p>
        <form onSubmit={saveSheets}>
          <div className="field">
            <label>Spreadsheet ID (from the sheet URL)</label>
            <input value={sheetId} onChange={(e) => setSheetId(e.target.value)} placeholder="1AbC…xyz" />
          </div>
          <div className="field">
            <label>Service account JSON key {integrations?.sheets.configured ? "(leave empty to keep current)" : ""}</label>
            <textarea
              value={saJson}
              onChange={(e) => setSaJson(e.target.value)}
              rows={4}
              placeholder='{"type":"service_account","client_email":"…","private_key":"…"}'
              style={{ width: "100%", fontFamily: "var(--mono)", fontSize: 11 }}
            />
          </div>
          <button className="btn">Save integration</button>
        </form>
      </div>
    </div>
  );
}
