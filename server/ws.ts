// Realtime hub: player presence in the isometric office, lightweight chat,
// and the shared arcade tic-tac-toe table.

import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "node:http";
import { userFromToken } from "./auth.ts";
import type { ClientMsg, PresencePlayer, ServerMsg, TttState } from "../shared/types.ts";

interface Conn {
  ws: WebSocket;
  player: PresencePlayer;
}

const conns = new Map<number, Conn>(); // one connection per user (last wins)

const ttt: TttState = {
  board: Array(9).fill(null),
  turn: "X",
  seats: { X: null, O: null },
  winner: null
};

const WINS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

function tttWinner(): TttState["winner"] {
  for (const [a, b, c] of WINS) {
    if (ttt.board[a] && ttt.board[a] === ttt.board[b] && ttt.board[a] === ttt.board[c]) return ttt.board[a];
  }
  return ttt.board.every(Boolean) ? "draw" : null;
}

function broadcast(msg: ServerMsg, except?: number) {
  const raw = JSON.stringify(msg);
  for (const [id, c] of conns) {
    if (id === except) continue;
    if (c.ws.readyState === WebSocket.OPEN) c.ws.send(raw);
  }
}

function send(ws: WebSocket, msg: ServerMsg) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

export function onlineCount() {
  return conns.size;
}

export function attachWs(httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws) => {
    let userId: number | null = null;

    ws.on("message", (raw) => {
      let msg: ClientMsg;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }

      if (msg.t === "hello") {
        const user = userFromToken(msg.token);
        if (!user) {
          send(ws, { t: "error", message: "Invalid session" });
          ws.close();
          return;
        }
        // Replace any previous connection for this user.
        const prev = conns.get(user.id);
        if (prev && prev.ws !== ws) prev.ws.close();

        userId = user.id;
        const player: PresencePlayer = {
          id: user.id,
          name: user.name,
          color: user.color,
          x: 0,
          z: 6,
          ry: 0,
          room: null
        };
        conns.set(user.id, { ws, player });
        send(ws, { t: "welcome", you: user.id, players: [...conns.values()].map((c) => c.player), ttt });
        broadcast({ t: "join", player }, user.id);
        return;
      }

      if (userId === null) return;
      const conn = conns.get(userId);
      if (!conn || conn.ws !== ws) return;

      switch (msg.t) {
        case "move": {
          conn.player.x = msg.x;
          conn.player.z = msg.z;
          conn.player.ry = msg.ry;
          broadcast({ t: "move", id: userId, x: msg.x, z: msg.z, ry: msg.ry }, userId);
          break;
        }
        case "work": {
          conn.player.room = msg.room;
          broadcast({ t: "work", id: userId, room: msg.room });
          break;
        }
        case "chat": {
          const text = String(msg.text || "").slice(0, 200).trim();
          if (text) broadcast({ t: "chat", id: userId, name: conn.player.name, color: conn.player.color, text });
          break;
        }
        case "ttt.sit": {
          const seat = msg.seat;
          if (ttt.seats[seat] && ttt.seats[seat]!.id !== userId) break; // taken
          // Leave the other seat if switching.
          const other = seat === "X" ? "O" : "X";
          if (ttt.seats[other]?.id === userId) ttt.seats[other] = null;
          ttt.seats[seat] = ttt.seats[seat]?.id === userId ? null : { id: userId, name: conn.player.name };
          broadcast({ t: "ttt", ttt });
          break;
        }
        case "ttt.move": {
          const seat = ttt.seats.X?.id === userId ? "X" : ttt.seats.O?.id === userId ? "O" : null;
          if (!seat || ttt.winner || ttt.turn !== seat) break;
          if (msg.cell < 0 || msg.cell > 8 || ttt.board[msg.cell]) break;
          if (!ttt.seats.X || !ttt.seats.O) break; // need both players
          ttt.board[msg.cell] = seat;
          ttt.winner = tttWinner();
          if (!ttt.winner) ttt.turn = seat === "X" ? "O" : "X";
          broadcast({ t: "ttt", ttt });
          break;
        }
        case "ttt.reset": {
          ttt.board = Array(9).fill(null);
          ttt.turn = "X";
          ttt.winner = null;
          broadcast({ t: "ttt", ttt });
          break;
        }
      }
    });

    ws.on("close", () => {
      if (userId === null) return;
      const conn = conns.get(userId);
      if (conn?.ws === ws) {
        conns.delete(userId);
        // Free up any arcade seat they held.
        if (ttt.seats.X?.id === userId) ttt.seats.X = null;
        if (ttt.seats.O?.id === userId) ttt.seats.O = null;
        broadcast({ t: "leave", id: userId });
        broadcast({ t: "ttt", ttt });
      }
    });
  });
}
