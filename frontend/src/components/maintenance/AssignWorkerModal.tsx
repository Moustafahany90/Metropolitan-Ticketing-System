import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { X, UserCheck, ShieldAlert, CheckCircle, Clock } from "lucide-react";
import { assignWorker, getAssignableWorkers } from "@/services/maintenance";
import { errorMessage } from "@/services/api";
import { PriorityBadge } from "./Badge";
import type { AssignableWorker, MaintenanceRequest } from "@/types/maintenance";

interface AssignWorkerModalProps {
  request: MaintenanceRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onAssigned: (updated: MaintenanceRequest) => void;
}

export default function AssignWorkerModal({
  request,
  isOpen,
  onClose,
  onAssigned,
}: AssignWorkerModalProps) {
  const [workers, setWorkers] = useState<AssignableWorker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingWorkers, setFetchingWorkers] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !request) return;
    void loadWorkers();
    setSelectedWorkerId(request.assignedToId ? String(request.assignedToId) : "");
    setError(null);
  }, [isOpen, request]);

  async function loadWorkers() {
    try {
      setFetchingWorkers(true);
      setError(null);
      const list = await getAssignableWorkers();
      setWorkers(list);
    } catch (err) {
      setError(errorMessage(err) || "Failed to retrieve available workers");
    } finally {
      setFetchingWorkers(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedWorkerId || !request) {
      setError("Please select a maintenance worker to assign.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const updated = await assignWorker(request.id, {
        workerId: Number(selectedWorkerId),
        expectedCurrentStatus: request.status,
      });
      onAssigned(updated);
      onClose();
    } catch (err) {
      setError(errorMessage(err) || "Failed to assign worker. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen || !request) return null;

  function workloadCls(count: number) {
    if (count === 0) return "border-mms-teal/30 bg-mms-teal/10 text-mms-teal";
    if (count < 3) return "border-mms-border bg-mms-surface text-mms-ink-muted";
    return "border-mms-gold/70 bg-mms-gold-soft text-mms-ink";
  }

  return (
    <div
      className="fixed inset-0 z-[1100] flex animate-fade-in items-center justify-center bg-mms-ink/40 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-mms-border bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-mms-border px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-mms-teal/30 bg-mms-teal/10 p-2 text-mms-teal">
              <UserCheck size={20} />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-mms-ink">
                Assign maintenance worker
              </h2>
              <p className="mt-0.5 font-mono text-xs text-mms-ink-muted">
                Request {request.ticketNumber}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-md p-1.5 text-mms-ink-muted transition-colors duration-150 hover:bg-mms-surface hover:text-mms-ink focus:outline-none focus:ring-2 focus:ring-mms-primary/20"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 overflow-y-auto p-6">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-red-700/30 bg-red-50 px-3.5 py-3 text-sm text-red-700"
            >
              <ShieldAlert size={18} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5 rounded-xl border border-mms-border bg-mms-surface p-3.5 text-xs text-mms-ink-muted">
            <div className="flex items-center justify-between gap-2">
              <span>
                Requester:{" "}
                <strong className="font-semibold text-mms-ink">
                  {request.requester?.displayName || request.requester?.username}
                </strong>
              </span>
              <PriorityBadge priority={request.priority} />
            </div>
            <p className="line-clamp-2 font-medium text-mms-ink">{request.description}</p>
            {request.location && (
              <p className="flex items-center gap-1 text-[11px]">{request.location}</p>
            )}
          </div>

          <div className="space-y-2">
            <span className="mms-label">Select maintenance worker</span>

            {fetchingWorkers ? (
              <div className="flex items-center justify-center gap-2 py-8 text-center text-sm text-mms-ink-muted">
                <Clock className="animate-spin text-mms-primary" size={16} />
                Loading available workers...
              </div>
            ) : workers.length === 0 ? (
              <div className="rounded-lg border border-mms-border bg-mms-surface py-6 text-center text-sm text-mms-ink-muted">
                No active maintenance workers found.
              </div>
            ) : (
              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {workers.map((w) => {
                  const isSelected = selectedWorkerId === String(w.id);
                  return (
                    <label
                      key={w.id}
                      onClick={() => setSelectedWorkerId(String(w.id))}
                      className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-colors duration-150 ${
                        isSelected
                          ? "border-mms-primary bg-mms-primary-soft"
                          : "border-mms-border bg-white hover:border-mms-primary/40 hover:bg-mms-surface"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="worker"
                          value={w.id}
                          checked={isSelected}
                          onChange={() => setSelectedWorkerId(String(w.id))}
                          className="accent-mms-primary"
                        />
                        <div>
                          <div className="text-sm font-semibold text-mms-ink">
                            {w.displayName}
                          </div>
                          <div className="text-xs text-mms-ink-muted">
                            {w.department || "Facilities & Maintenance"}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium ${workloadCls(
                            w.activeTasksCount
                          )}`}
                        >
                          {w.activeTasksCount} active task{w.activeTasksCount === 1 ? "" : "s"}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t border-mms-border pt-4">
            <button type="button" className="btn-outline h-10" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary h-10"
              disabled={loading || !selectedWorkerId || fetchingWorkers}
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Assigning...
                </>
              ) : (
                <>
                  <CheckCircle size={16} />
                  Confirm assignment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
