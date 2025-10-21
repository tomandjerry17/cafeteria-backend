import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../db"; // ✅ to fetch the user if needed

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

// Extend Express Request to include a full user object
export interface AuthRequest extends Request {
  user?: any;
}

// ✅ Verify JWT and attach user info
export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // "Bearer TOKEN"

  if (!token) return res.status(401).json({ error: "Access denied. No token provided." });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };

    // Option A: minimal info
    req.user = { id: decoded.userId, role: decoded.role };

    // Option B (optional): fetch more user data from DB
    // const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    // if (!user) return res.status(401).json({ error: "User not found" });
    // req.user = { id: user.id, role: user.role, fullName: user.fullName };

    next();
  } catch (err) {
    console.error("JWT verification error:", err);
    return res.status(403).json({ error: "Invalid token" });
  }
}

// ✅ Role check
export function requireRole(roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden: insufficient role" });
    }
    next();
  };
}
