import { useState } from "react";
import type { FormEvent } from "react";
import { X, XCircle, AlertTriangle, Clock } from "lucide-react";
import { rejectRequest } from "@/services/maintenance";
import { errorMessage } from "@/services/api";
import type { MaintenanceRequest } from "@/types/maintenance";

interface RejectRequestModalProps {
  request: MaintenanceRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onRejected: (updated: MaintenanceRequest) => void;
}

export default function RejectRequestModal({
  request,
  isOpen,
  onClose,
  onRejected,
}: RejectRequestModalProps) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !request) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Please provide a specific reason for rejecting this maintenance request.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const updated = await rejectRequest(request!.id, {
        reason: reason.trim(),
        expectedCurrentStatus: request!.status,
      });
      onRejected(updated);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1100] flex animate-fade-in items-center justify-center bg-mms-ink/40 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-mms-border bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-mms-border px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-status-rejected-fg/30 bg-status-rejected-bg p-2 text-status-rejected-fg">
              <XCircle size={20} />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-mms-ink">Reject request</h2>
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

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-y-auto p-6">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-red-700/30 bg-red-50 px-3.5 py-3 text-sm text-red-700"
            >
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-start gap-2.5 rounded-xl border border-mms-gold/70 bg-mms-gold-soft p-3.5 text-xs leading-relaxed text-mms-ink">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-mms-ink-muted" />
            <div>
              <strong>Irreversible action:</strong> Rejected requests cannot be reopened. The
              requester will be notified of the rejection and the stated reason.
            </div>
          </div>

          <div>
            <label htmlFor="rejection-reason" className="mms-label">
              Rejection reason
            </label>
            <textarea
              id="rejection-reason"
              rows={4}
              className="mms-input resize-y"
              placeholder="Explain clearly why this request cannot be fulfilled..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-mms-border pt-4">
            <button type="button" className="btn-outline h-10" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary h-10"
              disabled={loading || !reason.trim()}
            >
              {loading ? (
                <>
                  <Clock size={16} className="animate-spin" />
                  Rejecting...
                </>
              ) : (
                <>
                  <XCircle size={16} />
                  Confirm rejection
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
