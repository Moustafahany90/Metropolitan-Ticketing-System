export type Role = "EMPLOYEE" | "TECHNICIAN";

export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface User {
  id: number;
  name: string;
  email: string | null;
  username: string;
  role: Role;
  roleLabel: string;
  departmentId: number | null;
}

export interface Department {
  id: number;
  name: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface TicketUserRef {
  id: number;
  name: string;
  username: string;
}

export interface Comment {
  id: number;
  content: string;
  ticketId: number;
  userId: number;
  createdAt: string;
  user: {
    id: number;
    name: string;
    role: Role;
    roleLabel: string;
  };
}

export interface TechnicianRef {
  id: number;
  name: string;
  username: string;
  roleLabel: string;
}

export interface Ticket {
  id: number;
  title: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  employeeId: number;
  technicianId: number | null;
  departmentId: number;
  categoryId: number;
  createdAt: string;
  updatedAt: string;
  department: Department;
  category: Category;
  employee: TicketUserRef;
  technician: TicketUserRef | null;
}

export interface TicketListResponse {
  tickets: Ticket[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TicketQuery {
  search?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  departmentId?: number;
  categoryId?: number;
  page?: number;
  pageSize?: number;
}

export interface CreateTicketInput {
  title: string;
  description: string;
  priority: TicketPriority;
  departmentId: number;
  categoryId: number;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface ApiError {
  error: {
    message: string;
    details?: Record<string, string[]>;
  };
}

export interface StatusCount {
  status: TicketStatus;
  count: number;
}

export interface PriorityCount {
  priority: TicketPriority;
  count: number;
}

export interface NamedCount {
  name: string;
  count: number;
}

export interface DashboardTotals {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
}

export type DashboardResponse =
  | {
      role: "TECHNICIAN";
      totals: DashboardTotals;
      byStatus: StatusCount[];
      byPriority: PriorityCount[];
      byCategory: NamedCount[];
      byDepartment: NamedCount[];
      byTechnician: NamedCount[];
      recent: Ticket[];
    }
  | {
      role: "EMPLOYEE";
      totals: DashboardTotals;
      byStatus: StatusCount[];
      byPriority: PriorityCount[];
      recent: Ticket[];
    };
