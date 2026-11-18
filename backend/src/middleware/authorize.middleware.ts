import type { Request, Response, NextFunction } from "express";
import type { Role } from "@prisma/client";

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: { message: "Authentication required." } });
      return;
    }
    if (!roles.includes(req.user.role as Role)) {
      res.status(403).json({ error: { message: "You do not have permission to perform this action." } });
      return;
    }
    next();
  };
}
