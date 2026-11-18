import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors";

export function notFound(req: Request, res: Response): void {
  res.status(404).json({ error: { message: `Route not found: ${req.method} ${req.path}` } });
}

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { message: err.message } });
    return;
  }

  const status =
    (err as { status?: number }).status ?? (err as { statusCode?: number }).statusCode;
  if (typeof status === "number" && status >= 400 && status < 500) {
    res.status(status).json({
      error: { message: status === 400 ? "Invalid request body." : (err as Error).message },
    });
    return;
  }

  console.error(err);
  res.status(500).json({ error: { message: "Internal server error." } });
}
