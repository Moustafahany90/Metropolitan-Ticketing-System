import type { Priority, Prisma, TicketStatus } from "@prisma/client";
import { prisma } from "../prisma/client";
import { AppError } from "../utils/errors";
import type { CreateTicketInput, ListTicketsQuery } from "../schemas/ticket.schema";
import { notifyTicketAssigned, notifyStatusChanged, notifyTicketCreated } from "./email.service";

const ticketInclude = {
  department: true,
  category: true,
  employee: { select: { id: true, name: true, username: true } },
  technician: { select: { id: true, name: true, username: true } },
} as const;

export async function createTicket(userId: number, data: CreateTicketInput) {
  const [department, category] = await Promise.all([
    prisma.department.findUnique({ where: { id: data.departmentId } }),
    prisma.category.findUnique({ where: { id: data.categoryId } }),
  ]);

  if (!department || !category) {
    throw new AppError(400, "Invalid department or category.");
  }

  const ticket = await prisma.ticket.create({
    data: {
      title: data.title,
      description: data.description,
      priority: data.priority,
      departmentId: data.departmentId,
      categoryId: data.categoryId,
      employeeId: userId,
    },
    include: ticketInclude,
  });

  notifyTicketCreated(ticket);

  return ticket;
}

export async function listTickets(userId: number, role: string, query: ListTicketsQuery) {
  const { page, pageSize } = query;
  const where: Prisma.TicketWhereInput = {};

  if (role === "EMPLOYEE") {
    where.employeeId = userId;
  }
  if (query.status) {
    where.status = query.status;
  }
  if (query.priority) {
    where.priority = query.priority;
  }
  if (query.departmentId) {
    where.departmentId = query.departmentId;
  }
  if (query.categoryId) {
    where.categoryId = query.categoryId;
  }

  const search = query.search?.trim();
  if (search) {
    const numericId = /^\d+$/.test(search) ? Number(search) : undefined;
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      ...(numericId ? [{ id: numericId }] : []),
    ];
  }

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: ticketInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.ticket.count({ where }),
  ]);

  return { tickets, total, page, pageSize };
}

export async function getTicketById(userId: number, role: string, ticketId: number) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: ticketInclude,
  });

  if (!ticket) {
    throw new AppError(404, "Ticket not found.");
  }

  if (role === "EMPLOYEE" && ticket.employeeId !== userId) {
    throw new AppError(403, "You do not have permission to view this ticket.");
  }

  return ticket;
}

export async function updateTicketStatus(ticketId: number, status: TicketStatus) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    throw new AppError(404, "Ticket not found.");
  }

  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data: { status },
    include: ticketInclude,
  });

  notifyStatusChanged(updated, status);

  return updated;
}

export async function assignTicket(ticketId: number, technicianId: number) {
  const [ticket, technician] = await Promise.all([
    prisma.ticket.findUnique({ where: { id: ticketId } }),
    prisma.user.findUnique({ where: { id: technicianId } }),
  ]);

  if (!ticket) {
    throw new AppError(404, "Ticket not found.");
  }

  if (!technician) {
    throw new AppError(400, "The selected technician does not exist.");
  }

  if (technician.role !== "TECHNICIAN") {
    throw new AppError(400, "Tickets can only be assigned to a technician.");
  }

  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data: { technicianId },
    include: ticketInclude,
  });

  notifyTicketAssigned(updated);

  return updated;
}
