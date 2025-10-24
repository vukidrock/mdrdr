import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "change-me";

export type JwtUser = { id: number; display_name: string; avatar_url?: string };

export function issueToken(user: JwtUser) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "90d" });
}

export function requireAuth(req: Request & { user?: JwtUser }, res: Response, next: NextFunction) {
  const token = (req as any).cookies?.token;
  if (!token) return res.status(401).json({ ok:false, error:"UNAUTHENTICATED" });
  try {
    (req as any).user = jwt.verify(token, JWT_SECRET) as JwtUser;
    next();
  } catch {
    return res.status(401).json({ ok:false, error:"INVALID_TOKEN" });
  }
}

export function requireAuthOptional(req: Request & { user?: JwtUser }, _res: Response, next: NextFunction) {
  const token = (req as any).cookies?.token;
  if (token) { try { (req as any).user = jwt.verify(token, JWT_SECRET) as JwtUser; } catch {} }
  next();
}
