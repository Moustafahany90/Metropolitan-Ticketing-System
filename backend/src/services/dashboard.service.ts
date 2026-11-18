import type { Prisma, TicketStatus, Priority } from "@prisma/client";
import { prisma } from "../prisma/client";

const STATUS_ORDER: TicketStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const PRIORITY_ORDER: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

const recentInclude = {
  department: true,
  category: true,
  employee: { select: { id: true, name: true, username: true } },
  technician: { select: { id: true, name: true, username: true } },
} as const;

export async function getDashboard(userId: number, role: string) {
  const where: Prisma.TicketWhereInput = role === "EMPLOYEE" ? { employeeId: userId } : {};

  const [summary, recent] = await Promise.all([
    prisma.ticket.findMany({
      where,
      select: {
        status: true,
        priority: true,
        category: { select: { name: true } },
        department: { select: { name: true } },
        technician: { select: { name: true } },
      },
    }),
    prisma.ticket.findMany({
      where,
      include: recentInclude,
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const statusCounts: Record<TicketStatus, number> = {
    OPEN: 0,
    IN_PROGRESS: 0,
    RESOLVED: 0,
    CLOSED: 0,
  };
  const priorityCounts: Record<Priority, number> = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    URGENT: 0,
  };
  const categoryCounts = new Map<string, number>();
  const departmentCounts = new Map<string, number>();
  const technicianCounts = new Map<string, number>();

  for (const ticket of summary) {
    statusCounts[ticket.status]++;
    priorityCounts[ticket.priority]++;
    categoryCounts.set(
      ticket.category.name,
      (categoryCounts.get(ticket.category.name) ?? 0) + 1
    );
    departmentCounts.set(
      ticket.department.name,
      (departmentCounts.get(ticket.department.name) ?? 0) + 1
    );
    if (ticket.technician) {
      technicianCounts.set(
        ticket.technician.name,
        (technicianCounts.get(ticket.technician.name) ?? 0) + 1
      );
    }
  }

  const toNamed = (map: Map<string, number>) =>
    [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

  const base = {
    totals: {
      total: summary.length,
      open: statusCounts.OPEN,
      inProgress: statusCounts.IN_PROGRESS,
      resolved: statusCounts.RESOLVED,
      closed: statusCounts.CLOSED,
    },
    byStatus: STATUS_ORDER.map((status) => ({ status, count: statusCounts[status] })),
    byPriority: PRIORITY_ORDER.map((priority) => ({ priority, count: priorityCounts[priority] })),
    recent,
  };

  if (role === "TECHNICIAN") {
    return {
      ...base,
      role: "TECHNICIAN" as const,
      byCategory: toNamed(categoryCounts),
      byDepartment: toNamed(departmentCounts),
      byTechnician: toNamed(technicianCounts),
    };
  }

  return { ...base, role: "EMPLOYEE" as const };
}
