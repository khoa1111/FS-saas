import type { RoomId } from "../../shared/types";

export interface RoomDef {
  id: RoomId;
  label: string;
  sub: string;
  center: [number, number]; // x, z of floor plate
  size: [number, number];
  interact: [number, number]; // where the interactable prop sits
  tint: string; // carpet tint
  accent: string; // glow rail / identity color
}

export const ROOMS: RoomDef[] = [
  {
    id: "finance",
    label: "Finance Deck",
    sub: "live market wall",
    center: [-15, -8.5],
    size: [8.5, 8],
    interact: [-15, -9],
    tint: "#cdd9f6",
    accent: "#4d6bff"
  },
  {
    id: "documents",
    label: "The Vault",
    sub: "docs & assets",
    center: [-15, 7],
    size: [8.5, 7.5],
    interact: [-15.5, 6.5],
    tint: "#dcd4f4",
    accent: "#7b5cff"
  },
  {
    id: "hr",
    label: "HR Check-in",
    sub: "people ops",
    center: [-5.5, -11],
    size: [8, 5.5],
    interact: [-5.5, -11.5],
    tint: "#c9ead9",
    accent: "#16b26a"
  },
  {
    id: "projects",
    label: "Project Gym",
    sub: "treadmill sprints",
    center: [5.5, -11],
    size: [8, 5.5],
    interact: [4.2, -11.2],
    tint: "#fadcc7",
    accent: "#f2661f"
  },
  {
    id: "workflow",
    label: "Flow Line",
    sub: "conveyor pipeline",
    center: [15, -8.5],
    size: [8.5, 8],
    interact: [15, -8.5],
    tint: "#cfdaf3",
    accent: "#2447f0"
  },
  {
    id: "crm",
    label: "Client Lounge",
    sub: "folders & files",
    center: [15, 7],
    size: [8.5, 7.5],
    interact: [15.5, 6.5],
    tint: "#f9e3b9",
    accent: "#f5a623"
  },
  {
    id: "games",
    label: "Arcade Corner",
    sub: "play together",
    center: [0, 11],
    size: [9, 5.5],
    interact: [0, 11],
    tint: "#e6d3f4",
    accent: "#d551d9"
  }
];

export const BOUNDS = { minX: -18.5, maxX: 18.5, minZ: -13.8, maxZ: 13.2 };
export const SPAWN: [number, number] = [0, 3];
export const INTERACT_RADIUS = 2.6;

export function nearestRoom(x: number, z: number): RoomId | null {
  let best: RoomId | null = null;
  let bestD = INTERACT_RADIUS;
  for (const r of ROOMS) {
    const d = Math.hypot(x - r.interact[0], z - r.interact[1]);
    if (d < bestD) {
      bestD = d;
      best = r.id;
    }
  }
  return best;
}
