import { api } from "./api";
import type {
  AssignableWorker,
  MaintenanceCategory,
  MaintenanceDepartment,
  MaintenancePrincipal,
  MaintenanceRequest,
  MaintenanceRequestFilters,
  MaintenanceStats,
  RequestComment,
  SparePart,
} from "@/types/maintenance";

interface Envelope<T> {
  success: boolean;
  data: T;
  message?: string;
  count?: number;
}

const BASE = "/maintenance";

export async function getCategories(): Promise<MaintenanceCategory[]> {
  const { data } = await api.get<Envelope<MaintenanceCategory[]>>(`${BASE}/categories`);
  return data.data;
}

export async function getDepartments(): Promise<MaintenanceDepartment[]> {
  const { data } = await api.get<Envelope<MaintenanceDepartment[]>>(`${BASE}/departments`);
  return data.data;
}

export async function getStats(): Promise<MaintenanceStats> {
  const { data } = await api.get<Envelope<MaintenanceStats>>(`${BASE}/stats`);
  return data.data;
}

export async function getRequests(
  filters: MaintenanceRequestFilters = {}
): Promise<MaintenanceRequest[]> {
  const params = new URLSearchParams();
  if (filters.status) params.append("status", filters.status);
  if (filters.categoryId) params.append("categoryId", String(filters.categoryId));
  if (filters.priority) params.append("priority", filters.priority);
  if (filters.search) params.append("search", filters.search);

  const query = params.toString();
  const { data } = await api.get<Envelope<MaintenanceRequest[]>>(
    `${BASE}${query ? `?${query}` : ""}`
  );
  return data.data;
}

export async function getRequestById(id: number | string): Promise<MaintenanceRequest> {
  const { data } = await api.get<Envelope<MaintenanceRequest>>(`${BASE}/${id}`);
  return data.data;
}

export async function createRequest(formData: FormData): Promise<MaintenanceRequest> {
  const { data } = await api.post<Envelope<MaintenanceRequest>>(BASE, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.data;
}

export async function addComment(requestId: number | string, comment: string): Promise<RequestComment> {
  const { data } = await api.post<Envelope<RequestComment>>(`${BASE}/${requestId}/comments`, {
    comment,
  });
  return data.data;
}

export async function getAssignableWorkers(): Promise<AssignableWorker[]> {
  const { data } = await api.get<Envelope<AssignableWorker[]>>(`${BASE}/workers`);
  return data.data;
}

export async function assignWorker(
  requestId: number | string,
  params: { workerId: number; expectedCurrentStatus: string }
): Promise<MaintenanceRequest> {
  const { data } = await api.post<Envelope<MaintenanceRequest>>(
    `${BASE}/${requestId}/assign`,
    params
  );
  return data.data;
}

export async function rejectRequest(
  requestId: number | string,
  payload: { reason: string; expectedCurrentStatus: string }
): Promise<MaintenanceRequest> {
  const { data } = await api.post<Envelope<MaintenanceRequest>>(
    `${BASE}/${requestId}/reject`,
    payload
  );
  return data.data;
}

export async function receiveRequest(id: number | string): Promise<MaintenanceRequest> {
  const { data } = await api.post<Envelope<MaintenanceRequest>>(`${BASE}/${id}/receive`);
  return data.data;
}

export async function startWork(
  id: number | string,
  expectedCurrentStatus: string
): Promise<MaintenanceRequest> {
  const { data } = await api.post<Envelope<MaintenanceRequest>>(`${BASE}/${id}/start-work`, {
    expectedCurrentStatus,
  });
  return data.data;
}

export interface CompleteWorkInput {
  actionTaken: string;
  maintenanceTime: number | null;
  finalReport?: string;
  expectedCurrentStatus: string;
}

export async function completeWork(
  id: number | string,
  payload: CompleteWorkInput
): Promise<MaintenanceRequest> {
  const { data } = await api.post<Envelope<MaintenanceRequest>>(`${BASE}/${id}/complete`, payload);
  return data.data;
}

export interface SparePartInput {
  partName: string;
  quantity: number;
  notes?: string;
}

export async function requestSparePart(
  id: number | string,
  payload: SparePartInput
): Promise<SparePart> {
  const { data } = await api.post<Envelope<SparePart>>(`${BASE}/${id}/spare-parts`, payload);
  return data.data;
}

export async function getSpareParts(
  filters: { status?: string; requestId?: string | number } = {}
): Promise<SparePart[]> {
  const params = new URLSearchParams();
  if (filters.status) params.append("status", filters.status);
  if (filters.requestId) params.append("requestId", String(filters.requestId));
  const query = params.toString();
  const { data } = await api.get<Envelope<SparePart[]>>(
    `${BASE}/spare-parts${query ? `?${query}` : ""}`
  );
  return data.data;
}

export async function releaseSparePart(
  partId: number | string,
  payload: { notes?: string } = {}
): Promise<SparePart> {
  const { data } = await api.post<Envelope<SparePart>>(
    `${BASE}/spare-parts/${partId}/release`,
    payload
  );
  return data.data;
}

export async function downloadAttachment(filename: string): Promise<Blob> {
  const { data } = await api.get(`${BASE}/attachments/${encodeURIComponent(filename)}`, {
    responseType: "blob",
  });
  return data as Blob;
}

export type { MaintenancePrincipal };
