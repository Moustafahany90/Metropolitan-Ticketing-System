import type { Request, Response, NextFunction } from "express";
import { prisma } from "../prisma/client";

export async function listCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
    });
    res.json({ categories });
  } catch (err) {
    next(err);
  }
}
