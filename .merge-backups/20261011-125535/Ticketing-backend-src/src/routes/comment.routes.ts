import { Router } from "express";
import * as commentController from "../controllers/comment.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { ticketIdParamsSchema, createCommentSchema } from "../schemas/comment.schema";

const router = Router();

router.use(requireAuth);

router.get("/:ticketId/comments", validate(ticketIdParamsSchema, "params"), commentController.listComments);
router.post(
  "/:ticketId/comments",
  validate(ticketIdParamsSchema, "params"),
  validate(createCommentSchema),
  commentController.createComment
);

export default router;
