import { api } from "./api";
import type { Comment, TechnicianRef } from "@/types";

export async function listComments(ticketId: number): Promise<Comment[]> {
  const { data } = await api.get<{ comments: Comment[] }>(`/tickets/${ticketId}/comments`);
  return data.comments;
}

export async function createComment(ticketId: number, content: string): Promise<Comment> {
  const { data } = await api.post<{ comment: Comment }>(`/tickets/${ticketId}/comments`, {
    content,
  });
  return data.comment;
}

export async function listTechnicians(): Promise<TechnicianRef[]> {
  const { data } = await api.get<{ technicians: TechnicianRef[] }>("/users/technicians");
  return data.technicians;
}
