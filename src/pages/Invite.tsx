import { FormEvent, useEffect, useState } from "react";
import { api, setToken } from "../api";
import { useStore } from "../store";
import type { SessionUser } from "../../shared/types";

const COLORS = ["#2447f0", "#f2661f", "#17b26a", "#7b5cff", "#e8b114", "#e05299", "#17b0a0", "#e03c3c"];

export default function Invite({ token }: { token: string }) {
  const setUser = useStore((s) => s.setUser);
  const [email, setEmail] = useState<string | null>(null);
  const [invalid, setInvalid] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [color, setColor] = useState(COLORS[1]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<{ email: string }>(`/auth/invite/${token}`)
      .then((r) => setEmail(r.email))
      .catch((e) => setInvalid(e instanceof Error ? e.message : "Invite not found"));
  }, [token]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const r = await api.post<{ token: string; user: SessionUser }>(`/auth/invite/${token}/accept`, {
        name,
        password,
        color
      });
      setToken(r.token);
      setUser(r.user);
      history.replaceState(null, "", "/");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-hero">
        <span className="mlabel">FELIC STUDIO — CREW ONBOARDING</span>
        <h2>
          JOIN THE<br />
          <em>CREW.</em>
        </h2>
      </div>
      <form className="auth-card" onSubmit={submit}>
        <div className="brandbar" style={{ position: "static" }}>
          <div className="logo">F!</div>
        </div>
        <h1>You're invited</h1>
        {invalid ? (
          <div className="err">{invalid}</div>
        ) : (
          <>
            <p className="sub">{email ? `Creating an account for ${email}` : "Checking invite…"}</p>
            <div className="field">
              <label>Display name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mai Tran" required autoFocus />
            </div>
            <div className="field">
              <label>Password (min 6 chars)</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
            </div>
            <div className="field">
              <label>Character color</label>
              <div className="swatches">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={c === color ? "on" : ""}
                    style={{ background: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
            {err && <div className="err">{err}</div>}
            <button className="btn orange full" disabled={busy || !email}>
              {busy ? "Creating…" : "Create account & enter"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
