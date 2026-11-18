import { z } from "zod";
import { Priority, TicketStatus } from "@prisma/client";

export const idParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const createTicketSchema = z.object({
  title: z.string().min(1, "Title is required.").max(200, "Title is too long."),
  description: z.string().min(1, "Description is required.").max(5000, "Description is too long."),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  departmentId: z.number().int().positive(),
  categoryId: z.number().int().positive(),
});

export const updateStatusSchema = z.object({
  status: z.nativeEnum(TicketStatus),
});

export const listTicketsQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;
