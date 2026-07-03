import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { db, userRooms } from "./db.ts";

export const JWT_SECRET = process.env.JWT_SECRET || "felic-dev-secret-change-me";

export interface AuthedUser {
  id: number;
  email: string;
  name: string;
  color: string;
  isAdmin: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

export function signToken(userId: number): string {
  return jwt.sign({ uid: userId }, JWT_SECRET, { expiresIn: "7d" });
}

export function userFromToken(token: string): AuthedUser | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { uid: number };
    const row = db
      .prepare("SELECT id, email, name, color, is_admin FROM users WHERE id = ?")
      .get(payload.uid) as { id: number; email: string; name: string; color: string; is_admin: number } | undefined;
    if (!row) return null;
    return { id: row.id, email: row.email, name: row.name, color: row.color, isAdmin: !!row.is_admin };
  } catch {
    return null;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const user = userFromToken(token);
  if (!user) return res.status(401).json({ error: "Not authenticated" });
  req.user = user;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.isAdmin) return res.status(403).json({ error: "Admin only" });
  next();
}

export function requireRoom(room: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user!;
    if (user.isAdmin) return next();
    const rooms = userRooms(user.id, false);
    if (!rooms.includes(room)) return res.status(403).json({ error: `No access to ${room}` });
    next();
  };
}
