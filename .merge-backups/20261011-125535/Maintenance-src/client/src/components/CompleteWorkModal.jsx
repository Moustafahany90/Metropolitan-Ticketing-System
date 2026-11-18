import React, { useState } from 'react';
import { X, CheckCircle2, AlertCircle, Clock, FileText, CheckCheck } from 'lucide-react';
import { requestService } from '../services/requestService';

export default function CompleteWorkModal({ request, isOpen, onClose, onWorkCompleted }) {
  const [actionTaken, setActionTaken] = useState('');
  const [maintenanceTime, setMaintenanceTime] = useState(30);
  const [finalReport, setFinalReport] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !request) return null;

  const durationPresets = [15, 30, 45, 60, 90, 120];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!actionTaken.trim()) {
      setError('Please provide details on what action was taken to resolve the issue');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await requestService.completeWork(request.id, {
        actionTaken: actionTaken.trim(),
        maintenanceTime: parseInt(maintenanceTime, 10) || null,
        finalReport: finalReport.trim() || undefined,
        expectedCurrentStatus: request.status,
      });

      if (res.success) {
        onWorkCompleted?.(res.data);
        handleClose();
      }
    } catch (err) {
      if (err.response?.status === 409) {
        setError('This request was updated by another user. Please refresh and try again.');
      } else {
        setError(err.response?.data?.error?.message || 'Failed to complete maintenance work');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setActionTaken('');
    setMaintenanceTime(30);
    setFinalReport('');
    setError('');
    onClose();
  };

  const chipCls = (active) => {
    const base =
      'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-mms-primary/20 disabled:opacity-60';
    return active
      ? `${base} border-mms-primary bg-mms-primary-soft text-mms-primary-dark`
      : `${base} border-mms-border bg-white text-mms-ink-muted hover:bg-mms-surface hover:text-mms-ink`;
  };

  return (
    <div className="fixed inset-0 z-[1100] flex animate-fade-in items-center justify-center bg-mms-ink/40 p-6 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-mms-border bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-mms-border px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-status-completed-fg/30 bg-status-completed-bg p-2 text-status-completed-fg">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h3 className="font-display text-xl font-bold text-mms-ink">
                Complete maintenance work
              </h3>
              <p className="mt-0.5 text-xs text-mms-ink-muted">
                Document the resolution and close{' '}
                <strong className="font-mono font-semibold text-mms-ink">
                  {request.ticketNumber}
                </strong>
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="rounded-md p-1.5 text-mms-ink-muted transition-colors duration-150 hover:bg-mms-surface hover:text-mms-ink focus:outline-none focus:ring-2 focus:ring-mms-primary/20"
            aria-label="Close dialog"
            disabled={loading}
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
            <label htmlFor="action-taken" className="mms-label">
              Action taken / resolution summary <span className="text-mms-primary">*</span>
            </label>
            <textarea
              id="action-taken"
              className="mms-input resize-y"
              rows={4}
              placeholder="Detail exactly what work was performed, parts replaced, adjustments made, or repairs executed..."
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
              disabled={loading}
              required
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="maintenance-time" className="mms-label flex items-center gap-1.5">
              <Clock size={14} className="text-mms-ink-muted" />
              <span>Time spent on repair (minutes)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {durationPresets.map((mins) => (
                <button
                  type="button"
                  key={mins}
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
                id="maintenance-time"
                type="number"
                min="1"
                max="9999"
                className="mms-input"
                placeholder="Or enter a custom duration in minutes"
                value={maintenanceTime}
                onChange={(e) => setMaintenanceTime(Math.max(1, parseInt(e.target.value, 10) || 0))}
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label htmlFor="final-report" className="mms-label flex items-center gap-1.5">
              <FileText size={14} className="text-mms-ink-muted" />
              <span>Final report / verification notes (optional)</span>
            </label>
            <textarea
              id="final-report"
              className="mms-input resize-y"
              rows={3}
              placeholder="Note any preventative recommendations, sign-off observations, or follow-up needed..."
              value={finalReport}
              onChange={(e) => setFinalReport(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-mms-border pt-4">
            <button
              type="button"
              className="btn-outline h-10"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary btn-lg"
              disabled={loading || !actionTaken.trim()}
            >
              <CheckCheck size={16} />
              <span>{loading ? 'Submitting...' : 'Sign off & complete'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
