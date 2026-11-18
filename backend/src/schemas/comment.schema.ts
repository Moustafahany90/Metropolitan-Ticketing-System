import { z } from "zod";

export const ticketIdParamsSchema = z.object({
  ticketId: z.coerce.number().int().positive(),
});

export const createCommentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty.").max(2000, "Comment is too long."),
});

export const assignSchema = z.object({
  technicianId: z.number().int().positive(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type AssignInput = z.infer<typeof assignSchema>;
