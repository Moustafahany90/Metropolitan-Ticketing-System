import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env";
import { prisma } from "../prisma/client";

export function emailEnabled(): boolean {
  return Boolean(env.SMTP_HOST && env.MAIL_FROM);
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST!,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE ?? false,
      ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } } : {}),
    });
  }
  return transporter;
}

function fire(task: () => Promise<void>): void {
  void (async () => {
    try {
      await task();
    } catch (err) {
      console.error(`[email] notification failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  })();
}

async function sendMail(to: string[], subject: string, text: string): Promise<void> {
  try {
    const recipients = to.filter(Boolean);
    if (recipients.length === 0) return;
    await getTransporter().sendMail({
      from: env.MAIL_FROM,
      to: recipients.join(", "),
      subject,
      text,
    });
    console.log(`[email] sent "${subject}" to ${recipients.join(", ")}`);
  } catch (err) {
    console.error(`[email] failed to send "${subject}": ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function emailsFor(userIds: number[]): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, email: { not: null } },
    select: { email: true },
  });
  return users.map((user) => user.email as string);
}

async function technicianEmails(): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { role: "TECHNICIAN", email: { not: null } },
    select: { email: true },
  });
  return users.map((user) => user.email as string);
}

interface TicketRef {
  id: number;
  title: string;
  employeeId: number;
  technicianId: number | null;
}

async function loadTicketRef(ticketId: number): Promise<TicketRef | null> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, title: true, employeeId: true, technicianId: true },
  });
  return ticket;
}

function ticketLine(ticket: Pick<TicketRef, "id" | "title">): string {
  return `Ticket #${ticket.id}: ${ticket.title}`;
}

export function notifyTicketCreated(ticket: Pick<TicketRef, "id" | "title">): void {
  if (!emailEnabled()) return;
  fire(async () => {
    const to = await technicianEmails();
    await sendMail(
      to,
      `[Metropolitan IT] New ticket #${ticket.id}: ${ticket.title}`,
      `A new IT support ticket has been created.\n\n${ticketLine(ticket)}\n\nLog in to the ticketing system to review and assign it.`
    );
  });
}

export function notifyTicketAssigned(ticket: TicketRef): void {
  if (!emailEnabled()) return;
  fire(async () => {
    const technicianName = ticket.technicianId
      ? (await prisma.user.findUnique({ where: { id: ticket.technicianId }, select: { name: true } }))?.name ??
        `#${ticket.technicianId}`
      : "Unassigned";
    const to = await emailsFor([ticket.employeeId, ...(ticket.technicianId ? [ticket.technicianId] : [])]);
    await sendMail(
      to,
      `[Ticket #${ticket.id}] Assignment update`,
      `The following ticket was updated:\n\n${ticketLine(ticket)}\n\nAssigned technician: ${technicianName}`
    );
  });
}

export function notifyStatusChanged(ticket: Pick<TicketRef, "id" | "title" | "employeeId">, status: string): void {
  if (!emailEnabled()) return;
  fire(async () => {
    const to = await emailsFor([ticket.employeeId]);
    await sendMail(
      to,
      `[Ticket #${ticket.id}] Status changed to ${status}`,
      `The status of your ticket has changed.\n\n${ticketLine(ticket)}\n\nNew status: ${status}`
    );
  });
}

export function notifyCommentAdded(ticketId: number, commenterUserId: number): void {
  if (!emailEnabled()) return;
  fire(async () => {
    const ticket = await loadTicketRef(ticketId);
    if (!ticket) return;
    const to = await emailsFor(
      [ticket.employeeId, ...(ticket.technicianId ? [ticket.technicianId] : [])].filter(
        (id) => id !== commenterUserId
      )
    );
    await sendMail(
      to,
      `[Ticket #${ticket.id}] New comment`,
      `A new comment was added to the following ticket:\n\n${ticketLine(ticket)}\n\nOpen the ticket to view and reply.`
    );
  });
}