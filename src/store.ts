import { create } from "zustand";
import type { PresencePlayer, RoomId, SessionUser, TttState } from "../shared/types";

export type OpenApp = RoomId | "admin" | null;

interface ChatMsg {
  id: number;
  name: string;
  color: string;
  text: string;
  ts: number;
}

interface State {
  user: SessionUser | null;
  setUser: (u: SessionUser | null) => void;

  players: Record<number, PresencePlayer>;
  setPlayers: (list: PresencePlayer[]) => void;
  upsertPlayer: (p: PresencePlayer) => void;
  movePlayer: (id: number, x: number, z: number, ry: number) => void;
  setPlayerRoom: (id: number, room: RoomId | null) => void;
  removePlayer: (id: number) => void;

  bubbles: Record<number, ChatMsg>;
  chatLog: ChatMsg[];
  addChat: (m: ChatMsg) => void;

  ttt: TttState | null;
  setTtt: (t: TttState) => void;

  openApp: OpenApp;
  setOpenApp: (r: OpenApp) => void;

  nearRoom: RoomId | null;
  setNearRoom: (r: RoomId | null) => void;

  toast: string | null;
  showToast: (msg: string) => void;

  wsOnline: boolean;
  setWsOnline: (b: boolean) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useStore = create<State>((set, get) => ({
  user: null,
  setUser: (user) => set({ user }),

  players: {},
  setPlayers: (list) => set({ players: Object.fromEntries(list.map((p) => [p.id, p])) }),
  upsertPlayer: (p) => set((s) => ({ players: { ...s.players, [p.id]: p } })),
  movePlayer: (id, x, z, ry) =>
    set((s) => {
      const p = s.players[id];
      if (!p) return s;
      return { players: { ...s.players, [id]: { ...p, x, z, ry } } };
    }),
  setPlayerRoom: (id, room) =>
    set((s) => {
      const p = s.players[id];
      if (!p) return s;
      return { players: { ...s.players, [id]: { ...p, room } } };
    }),
  removePlayer: (id) =>
    set((s) => {
      const players = { ...s.players };
      delete players[id];
      return { players };
    }),

  bubbles: {},
  chatLog: [],
  addChat: (m) => {
    set((s) => ({
      chatLog: [...s.chatLog.slice(-49), m],
      bubbles: { ...s.bubbles, [m.id]: m }
    }));
    setTimeout(() => {
      const cur = get().bubbles[m.id];
      if (cur && cur.ts === m.ts) {
        set((s) => {
          const bubbles = { ...s.bubbles };
          delete bubbles[m.id];
          return { bubbles };
        });
      }
    }, 5000);
  },

  ttt: null,
  setTtt: (ttt) => set({ ttt }),

  openApp: null,
  setOpenApp: (openApp) => set({ openApp }),

  nearRoom: null,
  setNearRoom: (nearRoom) => set({ nearRoom }),

  toast: null,
  showToast: (msg) => {
    clearTimeout(toastTimer);
    set({ toast: msg });
    toastTimer = setTimeout(() => set({ toast: null }), 2600);
  },

  wsOnline: false,
  setWsOnline: (wsOnline) => set({ wsOnline })
}));
