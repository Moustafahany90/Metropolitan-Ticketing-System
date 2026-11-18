import { api } from "./api";
import type { AuthResponse, User } from "@/types";

export async function login(username: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/auth/login", { username, password });
  return data;
}

export async function logout(): Promise<void> {
  await api.post("/auth/logout").catch(() => undefined);
}

export async function getMe(): Promise<User> {
  const { data } = await api.get<{ user: User }>("/auth/me");
  return data.user;
}

export async function getAdStatus(): Promise<{ reachable: boolean; detail: string }> {
  const { data } = await api.get<{ reachable: boolean; detail: string }>("/auth/ad-status");
  return data;
}
