import { FormEvent, useState } from "react";
import { api, setToken } from "../api";
import { useStore } from "../store";
import type { SessionUser } from "../../shared/types";

export default function Login() {
  const setUser = useStore((s) => s.setUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const r = await api.post<{ token: string; user: SessionUser }>("/auth/login", { email, password });
      setToken(r.token);
      setUser(r.user);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-hero">
        <span className="mlabel">FELIC STUDIO — STANDARD INDUSTRY OS</span>
        <h2>
          RUN THE<br />
          <em>STUDIO.</em>
        </h2>
      </div>
      <form className="auth-card" onSubmit={submit}>
        <div className="brandbar" style={{ position: "static" }}>
          <div className="logo">F!</div>
        </div>
        <h1>Sign in</h1>
        <p className="sub">Accounts are created by invitation from your admin.</p>
        <div className="field">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@felic.studio"
            autoFocus
            required
          />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {err && <div className="err">{err}</div>}
        <button className="btn orange full" disabled={busy}>
          {busy ? "Entering…" : "Enter the office"}
        </button>
      </form>
    </div>
  );
}
