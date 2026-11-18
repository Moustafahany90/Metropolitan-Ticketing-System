import { Fragment, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  X,
  Clock,
  MapPin,
  Tag,
  Paperclip,
  MessageSquare,
  Send,
  User,
  CheckCircle,
  Download,
  UserCheck,
  XCircle,
  Eye,
  Shield,
  Wrench,
  Play,
  PackagePlus,
  CheckCheck,
} from "lucide-react";
import {
  addComment,
  downloadAttachment,
  getRequestById,
  receiveRequest,
  releaseSparePart,
  startWork,
} from "@/services/maintenance";
import { errorMessage } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import AssignWorkerModal from "./AssignWorkerModal";
import RejectRequestModal from "./RejectRequestModal";
import RequestSparePartModal from "./RequestSparePartModal";
import CompleteWorkModal from "./CompleteWorkModal";
import { PriorityBadge, RoleBadge, StatusBadge } from "./Badge";
import type { MaintenanceRequest } from "@/types/maintenance";

const SECTION_TITLE =
  "mb-3 flex items-center gap-2 font-display text-[15px] font-semibold text-mms-ink";

interface RequestDetailModalProps {
  requestId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onRequestUpdated?: (updated: MaintenanceRequest) => void;
}

function roleNameOf(role: unknown): string | undefined {
  if (!role) return undefined;
  if (typeof role === "string") return role;
  if (typeof role === "object" && "name" in (role as Record<string, unknown>)) {
    const name = (role as { name?: unknown }).name;
    return typeof name === "string" ? name : undefined;
  }
  return undefined;
}

export default function RequestDetailModal({
  requestId,
  isOpen,
  onClose,
  onRequestUpdated,
}: RequestDetailModalProps) {
  const [request, setRequest] = useState<MaintenanceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isSparePartModalOpen, setIsSparePartModalOpen] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const { user } = useAuth();

  const maintenanceRole = user?.maintenance?.role;
  const isSupervisorOrAdmin = maintenanceRole === "SUPERVISOR" || maintenanceRole === "ADMIN";
  const isStoreKeeper = maintenanceRole === "STORE_KEEPER";

  useEffect(() => {
    if (isOpen && requestId) {
      void loadRequestDetails();
    }
  }, [isOpen, requestId]);

  async function loadRequestDetails() {
    if (!requestId) return;
    setLoading(true);
    setError("");
    try {
      setRequest(await getRequestById(requestId));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function refreshParent(updated: MaintenanceRequest) {
    setRequest(updated);
    onRequestUpdated?.(updated);
  }

  async function handleMarkReceived() {
    if (!request) return;
    try {
      setActionLoading(true);
      setActionError("");
      await refreshParent(await receiveRequest(request.id));
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStartWork() {
    if (!request) return;
    try {
      setActionLoading(true);
      setActionError("");
      await refreshParent(await startWork(request.id, request.status));
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReleasePart(partId: number) {
    if (!request) return;
    try {
      setActionLoading(true);
      setActionError("");
      await releaseSparePart(partId);
      await refreshParent(await getRequestById(request.id));
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAttachmentDownload(filename: string, name: string) {
    try {
      const blob = await downloadAttachment(filename);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  async function handleAddComment(e: FormEvent) {
    e.preventDefault();
    if (!commentText.trim() || !request) return;

    setSubmittingComment(true);
    setActionError("");
    try {
      const newComment = await addComment(request.id, commentText.trim());
      setRequest((prev) =>
        prev ? { ...prev, comments: [...(prev.comments ?? []), newComment] } : prev
      );
      setCommentText("");
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setSubmittingComment(false);
    }
  }

  function getStepState(stepKey: string): "done" | "current" | "pending" {
    if (!request) return "pending";
    const order = ["SUBMITTED", "ASSIGNED", "IN_PROGRESS", "COMPLETED"];
    const currentIndex = order.indexOf(request.status);
    const stepIndex = order.indexOf(stepKey);
    if (request.status === "REJECTED") return stepKey === "SUBMITTED" ? "done" : "pending";
    if (stepIndex < currentIndex) return "done";
    if (stepIndex === currentIndex) return "current";
    return "pending";
  }

  function stepCircleCls(state: "done" | "current" | "pending") {
    if (state === "done")
      return "border-status-completed-fg bg-status-completed-fg text-white";
    if (state === "current")
      return "border-mms-primary bg-mms-primary text-white ring-2 ring-mms-primary/25";
    return "border-mms-border bg-white text-mms-ink-muted";
  }

  const canReceive = isSupervisorOrAdmin && !!request && !request.receivedById && request.status === "SUBMITTED";
  const canAssign =
    isSupervisorOrAdmin &&
    !!request &&
    (request.status === "SUBMITTED" || request.status === "ASSIGNED");
  const canReject =
    isSupervisorOrAdmin &&
    !!request &&
    request.status !== "COMPLETED" &&
    request.status !== "REJECTED";

  const isAssignedWorker =
    !!request && (request.assignedToId === user?.maintenance?.id || isSupervisorOrAdmin);
  const canStartWork = isAssignedWorker && request?.status === "ASSIGNED";
  const canExecuteWork = isAssignedWorker && request?.status === "IN_PROGRESS";

  const actionBtnCls =
    "inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-[13px] font-semibold transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-mms-primary/20 disabled:cursor-not-allowed disabled:opacity-50";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex animate-fade-in items-center justify-center bg-mms-ink/40 p-6 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-[780px] flex-col overflow-hidden rounded-xl border border-mms-border bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-mms-border px-6 py-5">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-xl font-bold tabular-nums text-mms-primary">
                {request?.ticketNumber || "Request details"}
              </span>
              {request && <StatusBadge status={request.status} />}
              {request && <PriorityBadge priority={request.priority} />}
            </div>
            <p className="mt-1 text-xs text-mms-ink-muted">
              Submitted on {request?.createdAt ? new Date(request.createdAt).toLocaleString() : ""}
            </p>
          </div>
          <button
            type="button"
            className="rounded-md p-1.5 text-mms-ink-muted transition-colors duration-150 hover:bg-mms-surface hover:text-mms-ink focus:outline-none focus:ring-2 focus:ring-mms-primary/20"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-mms-border border-t-mms-primary" />
          </div>
        ) : error ? (
          <div
            role="alert"
            className="mx-6 mt-4 rounded-lg border border-red-700/30 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        ) : request ? (
          <div className="flex flex-col gap-6 overflow-y-auto p-6">
            {actionError && (
              <div
                role="alert"
                className="rounded-lg border border-red-700/30 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {actionError}
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg border border-mms-border bg-mms-surface px-6 py-4">
              {[
                { key: "SUBMITTED", label: "Submitted" },
                { key: "ASSIGNED", label: "Assigned" },
                { key: "IN_PROGRESS", label: "In Progress" },
                { key: "COMPLETED", label: "Completed" },
              ].map((step, idx, arr) => {
                const state = getStepState(step.key);
                return (
                  <Fragment key={step.key}>
                    <div className="flex flex-col items-center gap-1.5">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold ${stepCircleCls(
                          state
                        )}`}
                      >
                        {idx + 1}
                      </div>
                      <div
                        className={`text-[11px] font-semibold ${
                          state === "current" ? "text-mms-primary" : "text-mms-ink-muted"
                        }`}
                      >
                        {step.label}
                      </div>
                    </div>
                    {idx < arr.length - 1 && (
                      <div className="mx-3 mt-[13px] h-0.5 flex-1 self-start bg-mms-border" />
                    )}
                  </Fragment>
                );
              })}
            </div>

            {isSupervisorOrAdmin && request.status !== "COMPLETED" && request.status !== "REJECTED" && (
              <div className="flex flex-col gap-3 rounded-lg border border-mms-primary/30 bg-mms-primary-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-mms-primary-dark">
                  <Shield size={14} />
                  <span>Supervisor actions</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:w-auto">
                  {canReceive && (
                    <button
                      className={`${actionBtnCls} flex-1 justify-center border-mms-border bg-white text-mms-ink hover:bg-mms-surface sm:flex-none`}
                      onClick={handleMarkReceived}
                      disabled={actionLoading}
                    >
                      <Eye size={15} />
                      <span>{actionLoading ? "Saving..." : "Mark received"}</span>
                    </button>
                  )}
                  {canAssign && (
                    <button
                      className={`${actionBtnCls} flex-1 justify-center border-mms-primary bg-mms-primary text-white hover:bg-mms-primary-dark sm:flex-none`}
                      onClick={() => setIsAssignModalOpen(true)}
                      disabled={actionLoading}
                    >
                      <UserCheck size={15} />
                      <span>Assign worker</span>
                    </button>
                  )}
                  {canReject && (
                    <button
                      className={`${actionBtnCls} flex-1 justify-center border-mms-border bg-white text-mms-ink hover:bg-mms-surface sm:flex-none`}
                      onClick={() => setIsRejectModalOpen(true)}
                      disabled={actionLoading}
                    >
                      <XCircle size={15} />
                      <span>Reject</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {(canStartWork || canExecuteWork) && (
              <div className="flex flex-col gap-3 rounded-lg border border-mms-gold/70 bg-mms-gold-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-mms-ink">
                  <Wrench size={14} />
                  <span>Work execution</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:w-auto">
                  {canStartWork && (
                    <button
                      className={`${actionBtnCls} flex-1 justify-center border-mms-primary bg-mms-primary text-white hover:bg-mms-primary-dark sm:flex-none`}
                      onClick={handleStartWork}
                      disabled={actionLoading}
                    >
                      <Play size={15} />
                      <span>{actionLoading ? "Starting..." : "Start work"}</span>
                    </button>
                  )}
                  {canExecuteWork && (
                    <>
                      <button
                        className={`${actionBtnCls} flex-1 justify-center border-mms-border bg-white text-mms-ink hover:bg-mms-surface sm:flex-none`}
                        onClick={() => setIsSparePartModalOpen(true)}
                        disabled={actionLoading}
                      >
                        <PackagePlus size={15} />
                        <span>Request spare parts</span>
                      </button>
                      <button
                        className={`${actionBtnCls} flex-1 justify-center border-mms-primary bg-mms-primary text-white hover:bg-mms-primary-dark sm:flex-none`}
                        onClick={() => setIsCompleteModalOpen(true)}
                        disabled={actionLoading}
                      >
                        <CheckCheck size={15} />
                        <span>Complete &amp; sign off</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <InfoTile icon={<Tag size={14} />} label="Category">
                {request.category?.name || "General"}
              </InfoTile>
              <InfoTile icon={<MapPin size={14} />} label="Location">
                {request.location || "Not specified"}
              </InfoTile>
              <InfoTile icon={<User size={14} />} label="Requester">
                {request.requester?.displayName || request.requester?.username}
              </InfoTile>
              <InfoTile icon={<Clock size={14} />} label="Department">
                {request.department?.name || "School Staff"}
              </InfoTile>
              {request.assignedTo && (
                <InfoTile icon={<Wrench size={14} />} label="Assigned to">
                  {request.assignedTo.displayName || request.assignedTo.username}
                </InfoTile>
              )}
              {request.assignedBy && (
                <InfoTile icon={<UserCheck size={14} />} label="Assigned by">
                  {request.assignedBy.displayName || request.assignedBy.username}
                  {request.assignedAt ? (
                    <span className="ml-1 text-xs font-normal text-mms-ink-muted">
                      — {new Date(request.assignedAt).toLocaleString()}
                    </span>
                  ) : null}
                </InfoTile>
              )}
              {request.receivedBy && (
                <InfoTile icon={<Eye size={14} />} label="Received by">
                  {request.receivedBy.displayName || request.receivedBy.username}
                  {request.receivedAt ? (
                    <span className="ml-1 text-xs font-normal text-mms-ink-muted">
                      — {new Date(request.receivedAt).toLocaleString()}
                    </span>
                  ) : null}
                </InfoTile>
              )}
            </div>

            <div>
              <h4 className={SECTION_TITLE}>Issue description</h4>
              <div className="whitespace-pre-wrap rounded-lg border border-mms-border bg-mms-surface p-4 text-sm leading-relaxed text-mms-ink">
                {request.description}
              </div>
            </div>

            {(request.startedAt || request.completedAt || request.actionTaken) && (
              <div>
                <h4 className={`${SECTION_TITLE} text-mms-teal`}>
                  <CheckCircle size={16} /> Work execution &amp; resolution
                </h4>
                <div className="rounded-lg border border-mms-teal/30 bg-mms-teal/5 p-5">
                  <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3 border-b border-mms-border pb-3">
                    {request.startedAt && (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] uppercase tracking-wider text-mms-ink-muted">
                          Started
                        </span>
                        <span className="text-sm text-mms-ink">
                          {new Date(request.startedAt).toLocaleString()}
                          {request.startedBy &&
                            ` by ${request.startedBy.displayName || request.startedBy.username}`}
                        </span>
                      </div>
                    )}
                    {request.completedAt && (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] uppercase tracking-wider text-mms-ink-muted">
                          Completed
                        </span>
                        <span className="text-sm text-mms-ink">
                          {new Date(request.completedAt).toLocaleString()}
                          {request.completedBy &&
                            ` by ${request.completedBy.displayName || request.completedBy.username}`}
                        </span>
                      </div>
                    )}
                    {request.maintenanceTime && (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] uppercase tracking-wider text-mms-ink-muted">
                          Time spent
                        </span>
                        <span className="text-sm font-semibold text-mms-ink">
                          {request.maintenanceTime} minutes
                        </span>
                      </div>
                    )}
                  </div>

                  {request.actionTaken && (
                    <div className="mt-3">
                      <div className="mb-1.5 text-[13px] font-semibold text-mms-ink">Action taken</div>
                      <div className="whitespace-pre-wrap rounded-md border border-mms-border bg-white p-3 text-sm leading-relaxed text-mms-ink">
                        {request.actionTaken}
                      </div>
                    </div>
                  )}

                  {request.finalReport && (
                    <div className="mt-3">
                      <div className="mb-1.5 text-[13px] font-semibold text-mms-ink">
                        Final report / recommendations
                      </div>
                      <div className="whitespace-pre-wrap rounded-md border border-mms-border bg-white p-3 text-sm leading-relaxed text-mms-ink">
                        {request.finalReport}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {request.spareParts && request.spareParts.length > 0 && (
              <div>
                <h4 className={SECTION_TITLE}>
                  <PackagePlus size={15} /> Spare parts ({request.spareParts.length})
                </h4>
                <div className="overflow-x-auto rounded-lg border border-mms-border bg-white">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="border-b border-mms-border bg-mms-surface px-3.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-mms-ink-muted">
                          Part
                        </th>
                        <th className="border-b border-mms-border bg-mms-surface px-3.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-mms-ink-muted">
                          Qty
                        </th>
                        <th className="border-b border-mms-border bg-mms-surface px-3.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-mms-ink-muted">
                          Requested by
                        </th>
                        <th className="border-b border-mms-border bg-mms-surface px-3.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-mms-ink-muted">
                          Status
                        </th>
                        {(isStoreKeeper || isSupervisorOrAdmin) && (
                          <th className="border-b border-mms-border bg-mms-surface px-3.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-mms-ink-muted">
                            Action
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {request.spareParts.map((part) => (
                        <tr key={part.id} className="border-b border-mms-border/70 hover:bg-mms-surface">
                          <td className="px-3.5 py-3 align-middle">
                            <div className="font-semibold text-mms-ink">{part.partName}</div>
                            {part.notes && (
                              <div className="mt-0.5 text-xs text-mms-ink-muted">{part.notes}</div>
                            )}
                          </td>
                          <td className="px-3.5 py-3 text-center align-middle font-bold tabular-nums">
                            {part.quantity}
                          </td>
                          <td className="px-3.5 py-3 align-middle">
                            {part.requestedBy?.displayName || part.requestedBy?.username || "Worker"}
                          </td>
                          <td className="px-3.5 py-3 align-middle">
                            {part.releasedAt ? (
                              <span className="badge border-status-completed-fg/30 bg-status-completed-bg text-status-completed-fg">
                                Released{" "}
                                {new Date(part.releasedAt).toLocaleDateString()}
                                {part.releasedBy &&
                                  ` by ${part.releasedBy.displayName || part.releasedBy.username}`}
                              </span>
                            ) : (
                              <span className="badge border-status-progress-fg/30 bg-status-progress-bg text-status-progress-fg">
                                Pending release
                              </span>
                            )}
                          </td>
                          {(isStoreKeeper || isSupervisorOrAdmin) && (
                            <td className="px-3.5 py-3 align-middle">
                              {!part.releasedAt ? (
                                <button
                                  className="btn-primary h-8 px-3 text-xs"
                                  onClick={() => handleReleasePart(part.id)}
                                  disabled={actionLoading}
                                >
                                  Release
                                </button>
                              ) : (
                                <span className="text-xs text-mms-ink-muted">Issued</span>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {request.status === "REJECTED" && request.rejectionReason && (
              <div>
                <h4 className={`${SECTION_TITLE} text-status-rejected-fg`}>
                  <XCircle size={15} /> Rejection details
                </h4>
                <div className="rounded-lg border border-status-rejected-fg/30 bg-status-rejected-bg p-4">
                  <p className="mb-2 text-sm leading-relaxed text-status-rejected-fg">
                    {request.rejectionReason}
                  </p>
                  {request.rejectedBy && (
                    <p className="text-xs text-mms-ink-muted">
                      Rejected by{" "}
                      <strong className="font-semibold text-mms-ink">
                        {request.rejectedBy.displayName || request.rejectedBy.username}
                      </strong>
                      {request.rejectedAt ? ` on ${new Date(request.rejectedAt).toLocaleString()}` : ""}
                    </p>
                  )}
                </div>
              </div>
            )}

            {request.attachments && request.attachments.length > 0 && (
              <div>
                <h4 className={SECTION_TITLE}>
                  <Paperclip size={15} /> Attachments ({request.attachments.length})
                </h4>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
                  {request.attachments.map((att) => (
                    <button
                      key={att.id}
                      type="button"
                      onClick={() => handleAttachmentDownload(att.filePath, att.fileName)}
                      className="flex items-center gap-2.5 rounded-lg border border-mms-border bg-white px-3.5 py-2.5 text-left text-mms-ink transition-colors duration-150 hover:border-mms-primary/50 hover:bg-mms-primary-soft/40"
                    >
                      <Paperclip size={16} className="text-mms-ink-muted" />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">{att.fileName}</span>
                        <span className="text-xs text-mms-ink-muted">
                          {(att.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                      <Download size={14} className="text-mms-primary" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {request.auditLogs && request.auditLogs.length > 0 && (
              <div>
                <h4 className={SECTION_TITLE}>
                  <Shield size={15} /> Audit trail
                </h4>
                <div className="flex flex-col gap-1.5">
                  {request.auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between rounded-md border-l-[3px] border-l-mms-teal bg-mms-surface px-3 py-2.5 transition-colors duration-150 hover:bg-mms-border/40"
                    >
                      <div className="text-[13px] font-semibold capitalize text-mms-ink">
                        {log.action.replace(/_/g, " ")}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-mms-ink-muted">
                        <span>{log.user?.displayName || log.user?.username || "System"}</span>
                        <span>{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className={SECTION_TITLE}>
                <MessageSquare size={15} /> Comments ({request.comments?.length || 0})
              </h4>

              <div className="flex max-h-60 flex-col gap-3 overflow-y-auto pr-1">
                {request.comments && request.comments.length > 0 ? (
                  request.comments.map((cmt) => (
                    <div
                      key={cmt.id}
                      className="rounded-lg border border-mms-border bg-mms-surface p-3.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-mms-ink">
                            {cmt.user?.displayName || cmt.user?.username}
                          </span>
                          <RoleBadge role={roleNameOf(cmt.user?.role)} />
                        </div>
                        <span className="text-xs text-mms-ink-muted">
                          {new Date(cmt.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-1 text-sm leading-relaxed text-mms-ink">{cmt.comment}</div>
                    </div>
                  ))
                ) : (
                  <p className="text-[13px] italic text-mms-ink-muted">
                    No comments on this request yet.
                  </p>
                )}
              </div>

              <form onSubmit={handleAddComment} className="mt-4 flex gap-3">
                <input
                  type="text"
                  className="mms-input flex-1"
                  placeholder="Add a comment or update..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  disabled={submittingComment}
                  aria-label="Add a comment"
                />
                <button
                  type="submit"
                  className="btn-primary h-10 shrink-0"
                  disabled={submittingComment || !commentText.trim()}
                >
                  <Send size={14} />
                  <span>Send</span>
                </button>
              </form>
            </div>
          </div>
        ) : null}
      </div>

      <AssignWorkerModal
        request={request}
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        onAssigned={async (updated) => {
          await refreshParent(updated);
        }}
      />
      <RejectRequestModal
        request={request}
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        onRejected={(updated) => void refreshParent(updated)}
      />
      <RequestSparePartModal
        request={request}
        isOpen={isSparePartModalOpen}
        onClose={() => setIsSparePartModalOpen(false)}
        onSparePartAdded={(updated) => void refreshParent(updated)}
      />
      <CompleteWorkModal
        request={request}
        isOpen={isCompleteModalOpen}
        onClose={() => setIsCompleteModalOpen(false)}
        onWorkCompleted={(updated) => void refreshParent(updated)}
      />
    </div>
  );
}

function InfoTile({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-mms-border bg-mms-surface p-3">
      <span className="flex items-center gap-1.5 text-xs text-mms-ink-muted">
        {icon} {label}
      </span>
      <span className="text-sm font-semibold text-mms-ink">{children}</span>
    </div>
  );
}
