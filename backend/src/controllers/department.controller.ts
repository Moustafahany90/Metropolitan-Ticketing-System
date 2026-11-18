import type { Request, Response, NextFunction } from "express";
import { prisma } from "../prisma/client";

export async function listDepartments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const departments = await prisma.department.findMany({
      orderBy: { name: "asc" },
    });
    res.json({ departments });
  } catch (err) {
    next(err);
  }
}
