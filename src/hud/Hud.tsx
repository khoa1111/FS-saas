import { FormEvent, useEffect, useState } from "react";
import { api, setToken } from "../api";
import { useStore } from "../store";
import { send, sendWork, wsDisconnect } from "../ws";
import { ALL_ROOMS, ROOM_LABELS } from "../../shared/types";
import { ROOMS } from "../scene/layout";

interface Summary {
  online: number;
  openTasks: number;
  activeProjects: number;
  balance: number;
  leads: number;
  pendingLeave: number;
  workflowItems: number;
  sheetsConfigured: boolean;
}

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function Hud() {
  const user = useStore((s) => s.user)!;
  const setUser = useStore((s) => s.setUser);
  const players = useStore((s) => s.players);
  const nearRoom = useStore((s) => s.nearRoom);
  const openApp = useStore((s) => s.openApp);
  const setOpenApp = useStore((s) => s.setOpenApp);
  const toast = useStore((s) => s.toast);
  const wsOnline = useStore((s) => s.wsOnline);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [chat, setChat] = useState("");
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    let alive = true;
    const load = () => api.get<Summary>("/summary").then((s) => alive && setSummary(s)).catch(() => {});
    load();
    const iv = setInterval(load, 15000);
    const ck = setInterval(() => setClock(new Date()), 1000);
    return () => {
      alive = false;
      clearInterval(iv);
      clearInterval(ck);
    };
  }, [openApp]);

  function sendChat(e: FormEvent) {
    e.preventDefault();
    const text = chat.trim();
    if (text) send({ t: "chat", text });
    setChat("");
    (document.activeElement as HTMLElement | null)?.blur();
  }

  function logout() {
    wsDisconnect();
    setToken(null);
    setUser(null);
  }

  const online = Object.keys(players).length;
  const near = nearRoom ? ROOMS.find((r) => r.id === nearRoom) : null;
  const nearAllowed = near ? user.isAdmin || user.rooms.includes(near.id) : false;

  return (
    <div className="hud">
      <div className="brandbar">
        <div className="logo">F!</div>
        <div className="name">
          Felic Studio
          <small>STANDARD INDUSTRY OS</small>
        </div>
      </div>

      {/* right: system overview */}
      <div className="panel">
        <h3>SYSTEM OVERVIEW</h3>
        <div className="stat-row">
          <span className="k">Agents active</span>
          <span className="v">{online || 1}</span>
        </div>
        <div className="agents-bar">
          <i style={{ width: `${Math.min(100, (online || 1) * 16)}%` }} />
        </div>
        {summary && (
          <>
            <div className="stat-row">
              <span className="k">Balance</span>
              <span className="v">{money(summary.balance)}</span>
            </div>
            <div className="stat-row">
              <span className="k">Open tasks</span>
              <span className="v">{summary.openTasks}</span>
            </div>
            <div className="stat-row">
              <span className="k">Active projects</span>
              <span className="v">{summary.activeProjects}</span>
            </div>
            <div className="stat-row">
              <span className="k">Flow items</span>
              <span className="v">{summary.workflowItems}</span>
            </div>
            <div className="stat-row">
              <span className="k">Leads</span>
              <span className="v">{summary.leads}</span>
            </div>
            <div className="stat-row">
              <span className="k">Sheets link</span>
              <span className="v" style={{ color: summary.sheetsConfigured ? "#28d17c" : "#8c93ad" }}>
                {summary.sheetsConfigured ? "LINKED" : "OFF"}
              </span>
            </div>
          </>
        )}

        <h3 style={{ marginTop: 16 }}>QUICK OPEN</h3>
        <div className="quick">
          {ALL_ROOMS.map((r) => {
            const allowed = user.isAdmin || user.rooms.includes(r);
            return (
              <button key={r} disabled={!allowed} onClick={() => { setOpenApp(r); sendWork(r); }}>
                <span className={`dot ${allowed ? "blue" : "red"}`} />
                {ROOM_LABELS[r]}
                <span className="sub">{allowed ? "open" : "locked"}</span>
              </button>
            );
          })}
          {user.isAdmin && (
            <button onClick={() => setOpenApp("admin")}>
              <span className="dot orange" />
              Admin Console
              <span className="sub">ctrl</span>
            </button>
          )}
          <button onClick={logout}>
            <span className="dot red" />
            Log out
            <span className="sub">{user.name}</span>
          </button>
        </div>
      </div>

      {/* bottom-left: terminal readout */}
      <div className="term">
        <div className="row"><span className="k">Agent</span><span className="v">{user.name.toLowerCase().replace(/\s+/g, "-")}</span></div>
        <div className="row"><span className="k">Sector</span><span className="v">{openApp ? (openApp === "admin" ? "ADMIN CONSOLE" : ROOM_LABELS[openApp]) : near ? near.label : "Open floor"}</span></div>
        <div className="row"><span className="k">Agents</span><span className="v">{online || 1} online</span></div>
        <div className="row"><span className="k">Clock</span><span className="v">{clock.toTimeString().slice(0, 8)}</span></div>
        <div className="row"><span className="k">Status</span><span className="v live">{wsOnline ? "running" : "reconnecting…"}</span></div>
        <div className="bar"><i /></div>
      </div>

      {/* interact prompt */}
      {!openApp && near && (
        <div className={`prompt ${nearAllowed ? "" : "denied"}`}>
          <kbd>E</kbd>
          {nearAllowed ? `Work in ${near.label}` : `${near.label} — access locked`}
        </div>
      )}
      {!openApp && !near && <div className="hint">WASD / arrows to move · walk to a room and press E</div>}

      {/* chat */}
      <form className="chatbox" onSubmit={sendChat}>
        <input
          value={chat}
          onChange={(e) => setChat(e.target.value)}
          placeholder="Say something to the office…"
          maxLength={200}
        />
      </form>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
