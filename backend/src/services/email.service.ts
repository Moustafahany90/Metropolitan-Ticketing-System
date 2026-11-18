import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env";
import { prisma } from "../prisma/client";

const GRAPH_SCOPE = "https://graph.microsoft.com/.default";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const GRAPH_LOGIN_BASE = "https://login.microsoftonline.com";

function graphSender(): string | null {
  const { MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_SENDER_EMAIL } = env;
  if (MICROSOFT_TENANT_ID && MICROSOFT_CLIENT_ID && MICROSOFT_CLIENT_SECRET && MICROSOFT_SENDER_EMAIL) {
    return MICROSOFT_SENDER_EMAIL;
  }
  return null;
}

function smtpSender(): string | null {
  if (env.SMTP_HOST && env.MAIL_FROM) return env.MAIL_FROM;
  return null;
}

export function emailEnabled(): boolean {
  return Boolean(graphSender() ?? smtpSender());
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

interface CachedGraphToken {
  token: string;
  expiresAt: number;
}

let cachedGraphToken: CachedGraphToken | null = null;

async function getGraphToken(): Promise<string> {
  if (cachedGraphToken && cachedGraphToken.expiresAt > Date.now() + 60_000) {
    return cachedGraphToken.token;
  }
  const body = new URLSearchParams({
    client_id: env.MICROSOFT_CLIENT_ID!,
    client_secret: env.MICROSOFT_CLIENT_SECRET!,
    scope: GRAPH_SCOPE,
    grant_type: "client_credentials",
  });
  const res = await fetch(`${GRAPH_LOGIN_BASE}/${env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Graph token request failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedGraphToken = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedGraphToken.token;
}

async function sendViaGraph(sender: string, to: string[], subject: string, text: string): Promise<void> {
  const token = await getGraphToken();
  const res = await fetch(`${GRAPH_BASE}/users/${encodeURIComponent(sender)}/sendMail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: "Text", content: text },
        toRecipients: to.map((address) => ({ emailAddress: { address } })),
      },
      saveToSentItems: false,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Graph sendMail failed (${res.status}): ${detail.slice(0, 300)}`);
  }
}

async function sendViaSmtp(sender: string, to: string[], subject: string, text: string): Promise<void> {
  await getTransporter().sendMail({ from: sender, to: to.join(", "), subject, text });
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
    const graph = graphSender();
    if (graph) {
      await sendViaGraph(graph, recipients, subject, text);
    } else {
      const smtp = smtpSender();
      if (!smtp) return;
      await sendViaSmtp(smtp, recipients, subject, text);
    }
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