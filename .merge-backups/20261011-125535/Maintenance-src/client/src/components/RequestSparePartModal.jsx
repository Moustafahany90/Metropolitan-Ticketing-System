import React, { useState } from 'react';
import { X, PackagePlus, AlertCircle } from 'lucide-react';
import { requestService } from '../services/requestService';

export default function RequestSparePartModal({ request, isOpen, onClose, onSparePartAdded }) {
  const [partName, setPartName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !request) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!partName.trim()) {
      setError('Please specify the spare part name');
      return;
    }
    if (quantity < 1) {
      setError('Quantity must be at least 1');
      return;
    }

    setLoading(false);
    setError('');
    try {
      setLoading(true);
      const res = await requestService.requestSparePart(request.id, {
        partName: partName.trim(),
        quantity: parseInt(quantity, 10),
        notes: notes.trim() || undefined,
      });

      if (res.success) {
        // Refresh full request data
        const freshRes = await requestService.getRequestById(request.id);
        if (freshRes.success) {
          onSparePartAdded?.(freshRes.data);
        }
        handleClose();
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to submit spare part request');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPartName('');
    setQuantity(1);
    setNotes('');
    setError('');
    onClose();
  };

  const qtyBtnCls =
    'flex h-10 w-10 items-center justify-center rounded-lg border border-mms-border bg-white text-lg font-bold text-mms-ink transition-colors duration-150 hover:bg-mms-surface focus:outline-none focus:ring-2 focus:ring-mms-primary/20 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div className="fixed inset-0 z-[1100] flex animate-fade-in items-center justify-center bg-mms-ink/40 p-6 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-mms-border bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-mms-border px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-mms-primary/30 bg-mms-primary-soft p-2 text-mms-primary">
              <PackagePlus size={20} />
            </div>
            <div>
              <h3 className="font-display text-xl font-bold text-mms-ink">Request spare parts</h3>
              <p className="mt-0.5 text-xs text-mms-ink-muted">
                Order materials from the storekeeper for{' '}
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
            <label htmlFor="part-name" className="mms-label">
              Spare part name / specification <span className="text-mms-primary">*</span>
            </label>
            <input
              id="part-name"
              type="text"
              className="mms-input"
              placeholder="e.g. HDMI cable 5m, LED tube 18W, door lock cylinder"
              value={partName}
              onChange={(e) => setPartName(e.target.value)}
              disabled={loading}
              required
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="part-qty" className="mms-label">
              Quantity required <span className="text-mms-primary">*</span>
            </label>
            <div className="flex max-w-[180px] items-center gap-2">
              <button
                type="button"
                className={qtyBtnCls}
                onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                disabled={loading || quantity <= 1}
                aria-label="Decrease quantity"
              >
                −
              </button>
              <input
                id="part-qty"
                type="number"
                min="1"
                max="1000"
                className="mms-input text-center font-bold tabular-nums"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                disabled={loading}
              />
              <button
                type="button"
                className={qtyBtnCls}
                onClick={() => setQuantity((prev) => prev + 1)}
                disabled={loading}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="part-notes" className="mms-label">
              Notes / justification (optional)
            </label>
            <textarea
              id="part-notes"
              className="mms-input resize-y"
              rows={3}
              placeholder="Provide reason, urgency, or specific brand/model requirement..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
              className="btn-primary h-10"
              disabled={loading || !partName.trim()}
            >
              <PackagePlus size={16} />
              <span>{loading ? 'Submitting...' : 'Submit part request'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
