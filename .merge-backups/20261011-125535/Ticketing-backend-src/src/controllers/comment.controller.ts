import type { Request, Response, NextFunction } from "express";
import * as commentService from "../services/comment.service";
import { AppError } from "../utils/errors";
import type { CreateCommentInput } from "../schemas/comment.schema";

export async function listComments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError(401, "Authentication required.");
    const { ticketId } = req.params as { ticketId: string };
    const comments = await commentService.listComments(
      req.user.userId,
      req.user.role,
      Number(ticketId)
    );
    res.json({ comments });
  } catch (err) {
    next(err);
  }
}

export async function createComment(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError(401, "Authentication required.");
    const { ticketId } = req.params as { ticketId: string };
    const data = req.body as CreateCommentInput;
    const comment = await commentService.createComment(
      req.user.userId,
      req.user.role,
      Number(ticketId),
      data
    );
    res.status(201).json({ comment });
  } catch (err) {
    next(err);
  }
}
