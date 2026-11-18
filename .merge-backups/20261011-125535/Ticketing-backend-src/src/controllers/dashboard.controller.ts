import type { Request, Response, NextFunction } from "express";
import * as dashboardService from "../services/dashboard.service";
import { AppError } from "../utils/errors";

export async function getDashboard(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError(401, "Authentication required.");
    const dashboard = await dashboardService.getDashboard(req.user.userId, req.user.role);
    res.json({ dashboard });
  } catch (err) {
    next(err);
  }
}
