import { getToken } from "./api";
import { useStore } from "./store";
import type { ClientMsg, RoomId, ServerMsg } from "../shared/types";

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let myId = 0;

export function wsConnect() {
  const token = getToken();
  if (!token) return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}/ws`);

  ws.onopen = () => {
    send({ t: "hello", token });
  };

  ws.onmessage = (ev) => {
    let msg: ServerMsg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    const s = useStore.getState();
    switch (msg.t) {
      case "welcome":
        myId = msg.you;
        s.setPlayers(msg.players);
        s.setTtt(msg.ttt);
        s.setWsOnline(true);
        break;
      case "join":
        s.upsertPlayer(msg.player);
        break;
      case "leave":
        s.removePlayer(msg.id);
        break;
      case "move":
        s.movePlayer(msg.id, msg.x, msg.z, msg.ry);
        break;
      case "work":
        s.setPlayerRoom(msg.id, msg.room);
        break;
      case "chat":
        s.addChat({ id: msg.id, name: msg.name, color: msg.color, text: msg.text, ts: Date.now() });
        break;
      case "ttt":
        s.setTtt(msg.ttt);
        break;
      case "error":
        s.showToast(msg.message);
        break;
    }
  };

  ws.onclose = () => {
    useStore.getState().setWsOnline(false);
    clearTimeout(reconnectTimer);
    if (getToken()) reconnectTimer = setTimeout(wsConnect, 2000);
  };
}

export function wsDisconnect() {
  clearTimeout(reconnectTimer);
  ws?.close();
  ws = null;
}

export function send(msg: ClientMsg) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

export function myPlayerId() {
  return myId;
}

let lastMoveSent = 0;
export function sendMove(x: number, z: number, ry: number) {
  const now = performance.now();
  if (now - lastMoveSent < 90) return; // ~11/s
  lastMoveSent = now;
  send({ t: "move", x: Number(x.toFixed(2)), z: Number(z.toFixed(2)), ry: Number(ry.toFixed(2)) });
}

export function sendWork(room: RoomId | null) {
  send({ t: "work", room });
}
