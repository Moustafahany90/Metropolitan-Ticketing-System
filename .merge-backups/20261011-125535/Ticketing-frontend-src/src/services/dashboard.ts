import { api } from "./api";
import type { DashboardResponse } from "@/types";

export async function getDashboard(): Promise<DashboardResponse> {
  const { data } = await api.get<{ dashboard: DashboardResponse }>("/dashboard");
  return data.dashboard;
}
