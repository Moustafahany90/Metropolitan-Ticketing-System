import type { Request, Response, NextFunction } from "express";
import * as ticketService from "../services/ticket.service";
import { AppError } from "../utils/errors";
import { listTicketsQuerySchema } from "../schemas/ticket.schema";
import type { CreateTicketInput } from "../schemas/ticket.schema";
import type { TicketStatus } from "@prisma/client";

export async function createTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError(401, "Authentication required.");
    const data = req.body as CreateTicketInput;
    const ticket = await ticketService.createTicket(req.user.userId, data);
    res.status(201).json({ ticket });
  } catch (err) {
    next(err);
  }
}

export async function listTickets(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError(401, "Authentication required.");
    const query = listTicketsQuerySchema.parse(req.query);
    const result = await ticketService.listTickets(req.user.userId, req.user.role, query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getTicketById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError(401, "Authentication required.");
    const { id } = req.params as { id: string };
    const ticket = await ticketService.getTicketById(req.user.userId, req.user.role, Number(id));
    res.json({ ticket });
  } catch (err) {
    next(err);
  }
}

export async function updateTicketStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError(401, "Authentication required.");
    const { id } = req.params as { id: string };
    const { status } = req.body as { status: TicketStatus };
    const ticket = await ticketService.updateTicketStatus(Number(id), status);
    res.json({ ticket });
  } catch (err) {
    next(err);
  }
}

export async function assignTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError(401, "Authentication required.");
    const { id } = req.params as { id: string };
    const { technicianId } = req.body as { technicianId: number };
    const ticket = await ticketService.assignTicket(Number(id), technicianId);
    res.json({ ticket });
  } catch (err) {
    next(err);
  }
}
