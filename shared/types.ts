// Shared contracts between the Felic Studio OS client and server.

export type RoomId =
  | "finance"
  | "documents"
  | "hr"
  | "projects"
  | "workflow"
  | "crm"
  | "games";

export const ALL_ROOMS: RoomId[] = [
  "finance",
  "documents",
  "hr",
  "projects",
  "workflow",
  "crm",
  "games"
];

export const ROOM_LABELS: Record<RoomId, string> = {
  finance: "Finance Deck",
  documents: "The Vault",
  hr: "HR Check-in",
  projects: "Project Gym",
  workflow: "Flow Line",
  crm: "Client Lounge",
  games: "Arcade Corner"
};

export interface SessionUser {
  id: number;
  email: string;
  name: string;
  color: string;
  isAdmin: boolean;
  rooms: RoomId[];
}

export interface PresencePlayer {
  id: number;
  name: string;
  color: string;
  x: number;
  z: number;
  ry: number;
  room: RoomId | null; // room the player is currently working in (window open)
}

// ---- WebSocket protocol ----

export type ClientMsg =
  | { t: "hello"; token: string }
  | { t: "move"; x: number; z: number; ry: number }
  | { t: "work"; room: RoomId | null }
  | { t: "chat"; text: string }
  | { t: "ttt.sit"; seat: "X" | "O" }
  | { t: "ttt.move"; cell: number }
  | { t: "ttt.reset" };

export interface TttState {
  board: (null | "X" | "O")[];
  turn: "X" | "O";
  seats: { X: { id: number; name: string } | null; O: { id: number; name: string } | null };
  winner: null | "X" | "O" | "draw";
}

export type ServerMsg =
  | { t: "welcome"; you: number; players: PresencePlayer[]; ttt: TttState }
  | { t: "join"; player: PresencePlayer }
  | { t: "leave"; id: number }
  | { t: "move"; id: number; x: number; z: number; ry: number }
  | { t: "work"; id: number; room: RoomId | null }
  | { t: "chat"; id: number; name: string; color: string; text: string }
  | { t: "ttt"; ttt: TttState }
  | { t: "error"; message: string };
