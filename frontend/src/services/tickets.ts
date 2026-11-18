import { api } from "./api";
import type {
  Category,
  CreateTicketInput,
  Department,
  Ticket,
  TicketListResponse,
  TicketQuery,
  TicketStatus,
} from "@/types";

export async function listTickets(params?: TicketQuery): Promise<TicketListResponse> {
  const { data } = await api.get<{ tickets: Ticket[]; total: number; page: number; pageSize: number }>(
    "/tickets",
    { params }
  );
  return { tickets: data.tickets, total: data.total, page: data.page, pageSize: data.pageSize };
}

export async function getTicket(id: number): Promise<Ticket> {
  const { data } = await api.get<{ ticket: Ticket }>(`/tickets/${id}`);
  return data.ticket;
}

export async function createTicket(input: CreateTicketInput): Promise<Ticket> {
  const { data } = await api.post<{ ticket: Ticket }>("/tickets", input);
  return data.ticket;
}

export async function updateTicketStatus(id: number, status: TicketStatus): Promise<Ticket> {
  const { data } = await api.patch<{ ticket: Ticket }>(`/tickets/${id}/status`, { status });
  return data.ticket;
}

export async function assignTicket(id: number, technicianId: number): Promise<Ticket> {
  const { data } = await api.patch<{ ticket: Ticket }>(`/tickets/${id}/assign`, { technicianId });
  return data.ticket;
}

export async function listDepartments(): Promise<Department[]> {
  const { data } = await api.get<{ departments: Department[] }>("/departments");
  return data.departments;
}

export async function listCategories(): Promise<Category[]> {
  const { data } = await api.get<{ categories: Category[] }>("/categories");
  return data.categories;
}
