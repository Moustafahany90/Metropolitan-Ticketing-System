import type { Request, Response, NextFunction } from "express";
import { prisma } from "../prisma/client";

export async function listTechnicians(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const technicians = await prisma.user.findMany({
      where: { role: "TECHNICIAN" },
      select: { id: true, name: true, username: true, roleLabel: true },
      orderBy: { name: "asc" },
    });
    res.json({ technicians });
  } catch (err) {
    next(err);
  }
}
