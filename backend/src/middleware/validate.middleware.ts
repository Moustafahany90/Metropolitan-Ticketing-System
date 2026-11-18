import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";

export function validate(schema: ZodSchema, source: "body" | "params" | "query" = "body") {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      res.status(400).json({
        error: {
          message: "Invalid request data.",
          details: result.error.flatten().fieldErrors,
        },
      });
      return;
    }
    (req as Request & Record<string, unknown>)[source] = result.data;
    next();
  };
}
