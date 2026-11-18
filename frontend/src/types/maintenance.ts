export type MaintenanceStatus =
  | "SUBMITTED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "REJECTED";

export type MaintenancePriority = "Normal" | "High" | "Urgent";

export type MaintenanceRole =
  | "EMPLOYEE"
  | "SUPERVISOR"
  | "MAINTENANCE_WORKER"
  | "STORE_KEEPER"
  | "ADMIN";

export interface MaintenancePrincipal {
  id: number;
  username: string;
  displayName: string | null;
  role: string;
  department: string | null;
  isActive: boolean;
}

export interface MaintenanceUserRef {
  id: number;
  username: string;
  displayName: string | null;
}

export interface MaintenanceCategory {
  id: number;
  name: string;
}

export interface MaintenanceDepartment {
  id: number;
  name: string;
}

export interface SparePart {
  id: number;
  partName: string;
  quantity: number;
  notes: string | null;
  requestId: number;
  requestedById: number;
  releasedById: number | null;
  releasedAt: string | null;
  createdAt: string;
  requestedBy?: MaintenanceUserRef | null;
  releasedBy?: MaintenanceUserRef | null;
}

export interface RequestAttachment {
  id: number;
  fileName: string;
  filePath: string;
  size: number;
  mimeType?: string | null;
}

export interface RequestComment {
  id: number;
  comment: string;
  createdAt: string;
  user?: {
    id: number;
    username: string;
    displayName: string | null;
    role?: { name: string } | string | null;
  } | null;
}

export interface AuditLog {
  id: number;
  action: string;
  createdAt: string;
  user?: MaintenanceUserRef | null;
}

export interface MaintenanceRequest {
  id: number;
  ticketNumber: string;
  status: MaintenanceStatus;
  priority: MaintenancePriority;
  description: string;
  location: string | null;
  categoryId: number;
  departmentId: number | null;
  requesterId: number;
  assignedToId: number | null;
  createdAt: string;
  updatedAt: string;
  category?: MaintenanceCategory | null;
  department?: MaintenanceDepartment | null;
  requester?: MaintenanceUserRef | null;
  assignedTo?: MaintenanceUserRef | null;
  assignedBy?: MaintenanceUserRef | null;
  assignedAt?: string | null;
  receivedById?: number | null;
  receivedBy?: MaintenanceUserRef | null;
  receivedAt?: string | null;
  startedAt?: string | null;
  startedBy?: MaintenanceUserRef | null;
  completedAt?: string | null;
  completedBy?: MaintenanceUserRef | null;
  maintenanceTime?: number | null;
  actionTaken?: string | null;
  finalReport?: string | null;
  rejectionReason?: string | null;
  rejectedBy?: MaintenanceUserRef | null;
  rejectedAt?: string | null;
  spareParts?: SparePart[];
  attachments?: RequestAttachment[];
  comments?: RequestComment[];
  auditLogs?: AuditLog[];
  _count?: {
    spareParts?: number;
    attachments?: number;
    comments?: number;
  };
}

export interface MaintenanceStats {
  total: number;
  submitted: number;
  assigned: number;
  inProgress: number;
  completed: number;
  rejected?: number;
  aging?: number;
  urgentPending?: number;
  pendingSpareParts?: number;
  releasedSpareParts?: number;
  totalSpareParts?: number;
}

export interface AssignableWorker {
  id: number;
  username: string;
  displayName: string;
  department?: string | null;
  activeTasksCount: number;
}

export interface MaintenanceRequestFilters {
  status?: string;
  categoryId?: string | number;
  priority?: string;
  search?: string;
}
