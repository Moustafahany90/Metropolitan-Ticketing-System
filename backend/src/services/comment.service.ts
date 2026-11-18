import { prisma } from "../prisma/client";
import { AppError } from "../utils/errors";
import { notifyCommentAdded } from "./email.service";
import type { CreateCommentInput } from "../schemas/comment.schema";

async function assertTicketAccess(userId: number, role: string, ticketId: number): Promise<void> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, employeeId: true },
  });

  if (!ticket) {
    throw new AppError(404, "Ticket not found.");
  }

  if (role === "EMPLOYEE" && ticket.employeeId !== userId) {
    throw new AppError(403, "You do not have permission to comment on this ticket.");
  }
}

export async function listComments(userId: number, role: string, ticketId: number) {
  await assertTicketAccess(userId, role, ticketId);

  return prisma.comment.findMany({
    where: { ticketId },
    include: {
      user: { select: { id: true, name: true, role: true, roleLabel: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function createComment(
  userId: number,
  role: string,
  ticketId: number,
  data: CreateCommentInput
) {
  await assertTicketAccess(userId, role, ticketId);

  const comment = await prisma.comment.create({
    data: {
      content: data.content,
      ticketId,
      userId,
    },
    include: {
      user: { select: { id: true, name: true, role: true, roleLabel: true } },
    },
  });

  notifyCommentAdded(ticketId, userId);

  return comment;
}
