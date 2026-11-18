import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import { getTicket, updateTicketStatus, assignTicket } from "@/services/tickets";
import { createComment, listComments, listTechnicians } from "@/services/comments";
import { errorMessage } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import StatusBadge from "@/components/StatusBadge";
import PriorityBadge from "@/components/PriorityBadge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Comment, TechnicianRef, Ticket, TicketStatus } from "@/types";

const statusOptions: TicketStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

function formatDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedStatus, setSelectedStatus] = useState<TicketStatus | "">("");
  const [statusError, setStatusError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [selectedTechnician, setSelectedTechnician] = useState("");
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const [commentText, setCommentText] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const isTechnician = user?.role === "TECHNICIAN";

  useEffect(() => {
    if (!id) return;
    const ticketId = Number(id);
    getTicket(ticketId)
      .then((t) => {
        setTicket(t);
        setSelectedStatus(t.status);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));

    listComments(ticketId)
      .then(setComments)
      .catch(() => undefined);

    if (user?.role === "TECHNICIAN") {
      listTechnicians().then(setTechnicians).catch(() => undefined);
    }
  }, [id, user?.role]);

  async function handleStatusChange() {
    if (!ticket || !selectedStatus || selectedStatus === ticket.status) return;
    setStatusError(null);
    setSaving(true);
    try {
      const updated = await updateTicketStatus(ticket.id, selectedStatus);
      setTicket(updated);
    } catch (err) {
      setStatusError(errorMessage(err));
      setSelectedStatus(ticket.status);
    } finally {
      setSaving(false);
    }
  }

  async function handleAssign() {
    if (!ticket || !selectedTechnician) return;
    setAssignError(null);
    setAssigning(true);
    try {
      const updated = await assignTicket(ticket.id, Number(selectedTechnician));
      setTicket(updated);
    } catch (err) {
      setAssignError(errorMessage(err));
    } finally {
      setAssigning(false);
    }
  }

  async function handleComment(e: FormEvent) {
    e.preventDefault();
    if (!ticket || !commentText.trim()) return;
    setCommentError(null);
    setPosting(true);
    try {
      const comment = await createComment(ticket.id, commentText.trim());
      setComments((prev) => [...prev, comment]);
      setCommentText("");
    } catch (err) {
      setCommentError(errorMessage(err));
    } finally {
      setPosting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-ink-muted">Loading ticket…</p>;
  }

  if (error || !ticket) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/tickets")} aria-label="Back to tickets">
          <ArrowLeft />
        </Button>
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error ?? "Ticket not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/tickets")} aria-label="Back to tickets">
          <ArrowLeft />
        </Button>
        <h1 className="text-2xl font-bold text-ink">Ticket #{ticket.id}</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="flex-1">{ticket.title}</CardTitle>
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{ticket.description}</p>

          <dl className="grid gap-3 rounded-lg bg-surface p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-ink-muted">Reported by</dt>
              <dd className="font-medium text-ink">{ticket.employee.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Department</dt>
              <dd className="font-medium text-ink">{ticket.department.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Category</dt>
              <dd className="font-medium text-ink">{ticket.category.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Created</dt>
              <dd className="font-medium text-ink">{formatDate(ticket.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Assigned technician</dt>
              <dd className="font-medium text-ink">
                {ticket.technician ? ticket.technician.name : "Not assigned yet"}
              </dd>
            </div>
          </dl>

          {isTechnician && (
            <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border-soft p-4">
              <div className="space-y-1">
                <Label htmlFor="status">Change status</Label>
                <Select
                  id="status"
                  className="w-44"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as TicketStatus)}
                >
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {s.replace("_", " ")}
                    </option>
                  ))}
                </Select>
              </div>
              <Button onClick={handleStatusChange} disabled={saving || selectedStatus === ticket.status}>
                {saving ? "Saving…" : "Update status"}
              </Button>
              {statusError && <p className="text-sm text-red-700">{statusError}</p>}
            </div>
          )}

          {isTechnician && (
            <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border-soft p-4">
              <div className="space-y-1">
                <Label htmlFor="technician">Assign technician</Label>
                <Select
                  id="technician"
                  className="w-56"
                  value={selectedTechnician}
                  onChange={(e) => setSelectedTechnician(e.target.value)}
                >
                  <option value="" disabled>
                    Select technician…
                  </option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {ticket.technician?.id === t.id ? " (current)" : ""}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                variant="outline"
                onClick={handleAssign}
                disabled={assigning || !selectedTechnician || Number(selectedTechnician) === ticket.technicianId}
              >
                {assigning ? "Saving…" : ticket.technician ? "Reassign" : "Assign"}
              </Button>
              {assignError && <p className="text-sm text-red-700">{assignError}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conversation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {comments.length === 0 && (
            <p className="rounded-lg bg-surface p-6 text-center text-sm text-ink-muted">
              No comments yet. Start the conversation below.
            </p>
          )}

          <div className="space-y-3">
            {comments.map((comment) => (
              <div key={comment.id} className="rounded-lg border border-border-soft p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink">{comment.user.name}</span>
                    <span
                      className={
                        comment.user.role === "TECHNICIAN"
                          ? "rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary"
                          : "rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-ink-muted ring-1 ring-inset ring-border-soft"
                      }
                    >
                      {comment.user.role === "TECHNICIAN" ? comment.user.roleLabel || "Staff" : "Employee"}
                    </span>
                  </div>
                  <span className="text-xs text-ink-muted">{formatDate(comment.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-ink">{comment.content}</p>
              </div>
            ))}
          </div>

          <form onSubmit={handleComment} className="space-y-2 border-t border-border-soft pt-4">
            <Textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment…"
              rows={3}
              maxLength={2000}
              required
            />
            {commentError && <p className="text-sm text-red-700">{commentError}</p>}
            <div className="flex justify-end">
              <Button type="submit" disabled={posting || !commentText.trim()}>
                <Send /> {posting ? "Posting…" : "Post comment"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
