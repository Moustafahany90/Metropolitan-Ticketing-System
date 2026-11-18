import { useState } from "react";
import type { FormEvent } from "react";
import { X, AlertCircle, Clock, FileText, CheckCircle2 } from "lucide-react";
import { completeWork } from "@/services/maintenance";
import { errorMessage } from "@/services/api";
import type { MaintenanceRequest } from "@/types/maintenance";

interface CompleteWorkModalProps {
  request: MaintenanceRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onWorkCompleted: (updated: MaintenanceRequest) => void;
}

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

export default function CompleteWorkModal({
  request,
  isOpen,
  onClose,
  onWorkCompleted,
}: CompleteWorkModalProps) {
  const [actionTaken, setActionTaken] = useState("");
  const [maintenanceTime, setMaintenanceTime] = useState(30);
  const [finalReport, setFinalReport] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !request) return null;

  const activeRequest = request;

  function handleClose() {
    setActionTaken("");
    setMaintenanceTime(30);
    setFinalReport("");
    setError("");
    onClose();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!actionTaken.trim()) {
      setError("Please provide details on what action was taken to resolve the issue");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const updated = await completeWork(activeRequest.id, {
        actionTaken: actionTaken.trim(),
        maintenanceTime: maintenanceTime || null,
        finalReport: finalReport.trim() || undefined,
        expectedCurrentStatus: activeRequest.status,
      });
      onWorkCompleted(updated);
      handleClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function chipCls(active: boolean) {
    const base =
      "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-mms-primary/20 disabled:opacity-60";
    return active
      ? `${base} border-mms-primary bg-mms-primary-soft text-mms-primary-dark`
      : `${base} border-mms-border bg-white text-mms-ink-muted hover:bg-mms-surface hover:text-mms-ink`;
  }

  return (
    <div className="fixed inset-0 z-[1100] flex animate-fade-in items-center justify-center bg-mms-ink/40 p-6 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-mms-border bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-mms-border px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-status-completed-fg/30 bg-status-completed-bg p-2 text-status-completed-fg">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-mms-ink">
                Complete maintenance work
              </h2>
              <p className="mt-0.5 text-xs text-mms-ink-muted">
                Document the resolution for{" "}
                <strong className="font-mono font-semibold text-mms-ink">
                  {request.ticketNumber}
                </strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-md p-1.5 text-mms-ink-muted transition-colors duration-150 hover:bg-mms-surface hover:text-mms-ink focus:outline-none focus:ring-2 focus:ring-mms-primary/20"
            onClick={handleClose}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 overflow-y-auto p-6">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-red-700/30 bg-red-50 px-3.5 py-3 text-sm text-red-700"
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="complete-action" className="mms-label">
              Action taken / resolution summary
            </label>
            <textarea
              id="complete-action"
              rows={4}
              className="mms-input resize-y"
              placeholder="Detail the work performed, parts replaced, or repairs executed..."
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <span className="mms-label flex items-center gap-1.5">
              <Clock size={14} className="text-mms-ink-muted" />
              <span>Time spent (minutes)</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {DURATION_PRESETS.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  className={chipCls(maintenanceTime === mins)}
                  onClick={() => setMaintenanceTime(mins)}
                  disabled={loading}
                >
                  {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                </button>
              ))}
            </div>
            <div className="mt-2">
              <input
                type="number"
                min={1}
                max={9999}
                className="mms-input"
                placeholder="Or enter a custom duration in minutes"
                value={maintenanceTime}
                onChange={(e) =>
                  setMaintenanceTime(Math.max(1, parseInt(e.target.value, 10) || 0))
                }
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label htmlFor="complete-report" className="mms-label flex items-center gap-1.5">
              <FileText size={14} className="text-mms-ink-muted" />
              <span>Final report / verification notes (optional)</span>
            </label>
            <textarea
              id="complete-report"
              rows={3}
              className="mms-input resize-y"
              placeholder="Note any preventative recommendations or follow-up needed..."
              value={finalReport}
              onChange={(e) => setFinalReport(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-mms-border pt-4">
            <button type="button" className="btn-outline h-10" onClick={handleClose} disabled={loading}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary btn-lg"
              disabled={loading || !actionTaken.trim()}
            >
              <CheckCircle2 size={16} />
              <span>{loading ? "Submitting..." : "Sign off & complete"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
