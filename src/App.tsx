import { useEffect, useState } from "react";
import { api, getToken, setToken } from "./api";
import { useStore } from "./store";
import { wsConnect, wsDisconnect } from "./ws";
import Login from "./pages/Login";
import Invite from "./pages/Invite";
import Office from "./Office";
import type { SessionUser } from "../shared/types";

export default function App() {
  const user = useStore((s) => s.user);
  const setUser = useStore((s) => s.setUser);
  const [booting, setBooting] = useState(true);
  const inviteToken = location.pathname.startsWith("/invite/")
    ? location.pathname.slice("/invite/".length)
    : null;

  useEffect(() => {
    if (!getToken()) {
      setBooting(false);
      return;
    }
    api
      .get<{ user: SessionUser }>("/auth/me")
      .then((r) => setUser(r.user))
      .catch(() => setToken(null))
      .finally(() => setBooting(false));
  }, [setUser]);

  useEffect(() => {
    if (user) {
      wsConnect();
      return () => wsDisconnect();
    }
  }, [user]);

  if (booting) {
    return (
      <div className="auth-wrap">
        <div className="mlabel" style={{ color: "#7d89c8" }}>BOOTING FELIC STUDIO OS…</div>
      </div>
    );
  }

  if (!user && inviteToken) return <Invite token={inviteToken} />;
  if (!user) return <Login />;
  return <Office />;
}
