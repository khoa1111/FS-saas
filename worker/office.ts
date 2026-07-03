// The realtime office as a Durable Object: one instance ("main") holds all
// player presence, chat fan-out, and the shared arcade tic-tac-toe table.

import { verifyJwt } from "./auth";
import { jwtSecret, type Env } from "./env";
import type { ClientMsg, PresencePlayer, ServerMsg, TttState } from "../shared/types";

interface Conn {
  ws: WebSocket;
  player: PresencePlayer;
}

const WINS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

export class OfficeRoom {
  private conns = new Map<number, Conn>(); // one connection per user (last wins)
  private ttt: TttState = {
    board: Array(9).fill(null),
    turn: "X",
    seats: { X: null, O: null },
    winner: null
  };

  constructor(private state: DurableObjectState, private env: Env) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/online") {
      return Response.json({ online: this.conns.size });
    }

    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    const pair = new WebSocketPair();
    this.handleSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  private tttWinner(): TttState["winner"] {
    for (const [a, b, c] of WINS) {
      if (this.ttt.board[a] && this.ttt.board[a] === this.ttt.board[b] && this.ttt.board[a] === this.ttt.board[c]) {
        return this.ttt.board[a];
      }
    }
    return this.ttt.board.every(Boolean) ? "draw" : null;
  }

  private broadcast(msg: ServerMsg, except?: number) {
    const raw = JSON.stringify(msg);
    for (const [id, c] of this.conns) {
      if (id === except) continue;
      try {
        c.ws.send(raw);
      } catch {
        /* dropped below on close/error */
      }
    }
  }

  private send(ws: WebSocket, msg: ServerMsg) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      /* ignore */
    }
  }

  private handleSocket(ws: WebSocket) {
    ws.accept();
    let userId: number | null = null;

    ws.addEventListener("message", async (ev) => {
      let msg: ClientMsg;
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }

      if (msg.t === "hello") {
        const payload = await verifyJwt(msg.token, jwtSecret(this.env));
        const uid = payload && typeof payload.uid === "number" ? payload.uid : null;
        if (!uid) {
          this.send(ws, { t: "error", message: "Invalid session" });
          ws.close();
          return;
        }
        const row = await this.env.DB.prepare("SELECT id, name, color FROM users WHERE id = ?")
          .bind(uid)
          .first<{ id: number; name: string; color: string }>();
        if (!row) {
          this.send(ws, { t: "error", message: "Unknown user" });
          ws.close();
          return;
        }
        const prev = this.conns.get(row.id);
        if (prev && prev.ws !== ws) {
          try { prev.ws.close(); } catch { /* ignore */ }
        }
        userId = row.id;
        const player: PresencePlayer = { id: row.id, name: row.name, color: row.color, x: 0, z: 6, ry: 0, room: null };
        this.conns.set(row.id, { ws, player });
        this.send(ws, {
          t: "welcome",
          you: row.id,
          players: [...this.conns.values()].map((c) => c.player),
          ttt: this.ttt
        });
        this.broadcast({ t: "join", player }, row.id);
        return;
      }

      if (userId === null) return;
      const conn = this.conns.get(userId);
      if (!conn || conn.ws !== ws) return;

      switch (msg.t) {
        case "move": {
          conn.player.x = msg.x;
          conn.player.z = msg.z;
          conn.player.ry = msg.ry;
          this.broadcast({ t: "move", id: userId, x: msg.x, z: msg.z, ry: msg.ry }, userId);
          break;
        }
        case "work": {
          conn.player.room = msg.room;
          this.broadcast({ t: "work", id: userId, room: msg.room });
          break;
        }
        case "chat": {
          const text = String(msg.text || "").slice(0, 200).trim();
          if (text) this.broadcast({ t: "chat", id: userId, name: conn.player.name, color: conn.player.color, text });
          break;
        }
        case "ttt.sit": {
          const seat = msg.seat;
          if (this.ttt.seats[seat] && this.ttt.seats[seat]!.id !== userId) break; // taken
          const other = seat === "X" ? "O" : "X";
          if (this.ttt.seats[other]?.id === userId) this.ttt.seats[other] = null;
          this.ttt.seats[seat] =
            this.ttt.seats[seat]?.id === userId ? null : { id: userId, name: conn.player.name };
          this.broadcast({ t: "ttt", ttt: this.ttt });
          break;
        }
        case "ttt.move": {
          const seat = this.ttt.seats.X?.id === userId ? "X" : this.ttt.seats.O?.id === userId ? "O" : null;
          if (!seat || this.ttt.winner || this.ttt.turn !== seat) break;
          if (msg.cell < 0 || msg.cell > 8 || this.ttt.board[msg.cell]) break;
          if (!this.ttt.seats.X || !this.ttt.seats.O) break;
          this.ttt.board[msg.cell] = seat;
          this.ttt.winner = this.tttWinner();
          if (!this.ttt.winner) this.ttt.turn = seat === "X" ? "O" : "X";
          this.broadcast({ t: "ttt", ttt: this.ttt });
          break;
        }
        case "ttt.reset": {
          this.ttt.board = Array(9).fill(null);
          this.ttt.turn = "X";
          this.ttt.winner = null;
          this.broadcast({ t: "ttt", ttt: this.ttt });
          break;
        }
      }
    });

    const cleanup = () => {
      if (userId === null) return;
      const conn = this.conns.get(userId);
      if (conn?.ws === ws) {
        this.conns.delete(userId);
        if (this.ttt.seats.X?.id === userId) this.ttt.seats.X = null;
        if (this.ttt.seats.O?.id === userId) this.ttt.seats.O = null;
        this.broadcast({ t: "leave", id: userId });
        this.broadcast({ t: "ttt", ttt: this.ttt });
      }
    };
    ws.addEventListener("close", cleanup);
    ws.addEventListener("error", cleanup);
  }
}
