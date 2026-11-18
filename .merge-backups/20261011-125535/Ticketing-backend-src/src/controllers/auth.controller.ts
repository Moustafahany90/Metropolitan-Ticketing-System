import type { Request, Response, NextFunction } from "express";
import * as authService from "../services/auth.service";
import { checkAdReachability } from "../services/ad.service";
import { AppError } from "../utils/errors";

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { username, password } = req.body as { username: string; password: string };
    const result = await authService.login(username, password);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = req.body as { refreshToken: string };
    const result = await authService.refresh(refreshToken);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export function logout(req: Request, res: Response): void {
  res.json({ success: true });
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, "Authentication required.");
    }
    const user = await authService.me(req.user.userId);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

export async function adStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const status = await checkAdReachability();
    res.json(status);
  } catch (err) {
    next(err);
  }
}
