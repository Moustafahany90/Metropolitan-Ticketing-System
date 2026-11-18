import React, { useState, useEffect } from 'react';
import { requestService } from '../services/requestService';
import {
  X,
  UploadCloud,
  FileText,
  Trash2,
  AlertCircle,
  MapPin,
  CheckCircle,
  Tag,
  AlertTriangle,
} from 'lucide-react';

export default function CreateRequestModal({ isOpen, onClose, onRequestCreated }) {
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState('Normal');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadCategories();
      // Reset fields
      setPriority('Normal');
      setLocation('');
      setDescription('');
      setFiles([]);
      setError('');
    }
  }, [isOpen]);

  const loadCategories = async () => {
    try {
      const res = await requestService.getCategories();
      if (res.success && res.data) {
        setCategories(res.data);
        if (res.data.length > 0 && !categoryId) {
          setCategoryId(res.data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  };

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      const validFiles = [];
      let sizeError = false;

      selected.forEach((file) => {
        if (file.size > 5 * 1024 * 1024) {
          sizeError = true;
        } else {
          validFiles.push(file);
        }
      });

      if (sizeError) {
        setError('One or more files exceeded the 5MB size limit and were omitted.');
      } else {
        setError('');
      }

      setFiles((prev) => [...prev, ...validFiles].slice(0, 5));
    }
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('Please provide a description of the maintenance issue.');
      return;
    }
    if (!categoryId) {
      setError('Please select a maintenance category.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('categoryId', categoryId);
      formData.append('priority', priority);
      formData.append('location', location);
      formData.append('description', description);

      files.forEach((file) => {
        formData.append('attachments', file);
      });

      const res = await requestService.createRequest(formData);
      if (res.success) {
        onRequestCreated(res.data);
        onClose();
      } else {
        setError(res.error?.message || 'Failed to submit request');
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Error communicating with server');
    } finally {
      setIsSubmitting(false);
    }
  };

  const priorityChipCls = (p) => {
    const base =
      'flex-1 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-mms-primary/20 disabled:opacity-60';
    if (priority !== p) {
      return `${base} border-mms-border bg-white text-mms-ink-muted hover:bg-mms-surface hover:text-mms-ink`;
    }
    if (p === 'Normal') return `${base} border-slate-500 bg-slate-100 text-slate-700`;
    if (p === 'High')
      return `${base} border-priority-high-fg/60 bg-priority-high-bg text-priority-high-fg`;
    return `${base} border-priority-urgent-fg/60 bg-priority-urgent-bg text-priority-urgent-fg`;
  };

  return (
    <div className="fixed inset-0 z-[100] flex animate-fade-in items-center justify-center bg-mms-ink/40 p-6 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-mms-border bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-mms-border px-6 py-5">
          <div>
            <h2 className="font-display text-xl font-bold text-mms-ink">
              New maintenance request
            </h2>
            <p className="mt-0.5 text-xs text-mms-ink-muted">
              Report a facility, electrical, plumbing, or classroom problem
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-mms-ink-muted transition-colors duration-150 hover:bg-mms-surface hover:text-mms-ink focus:outline-none focus:ring-2 focus:ring-mms-primary/20"
            aria-label="Close dialog"
            disabled={isSubmitting}
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mx-6 mt-4 flex items-start gap-2.5 rounded-lg border border-red-700/30 bg-red-50 px-3.5 py-3 text-sm text-red-700"
          >
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 overflow-y-auto p-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            {/* Category */}
            <div className="flex-1">
              <label htmlFor="req-category" className="mms-label flex items-center gap-1.5">
                <Tag size={14} className="text-mms-ink-muted" />
                <span>Maintenance category *</span>
              </label>
              <select
                id="req-category"
                className="mms-input cursor-pointer"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                disabled={isSubmitting}
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div className="flex-1">
              <span className="mms-label flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-mms-ink-muted" />
                <span>Priority level</span>
              </span>
              <div className="flex gap-2">
                {['Normal', 'High', 'Urgent'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={priorityChipCls(p)}
                    onClick={() => setPriority(p)}
                    disabled={isSubmitting}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Location */}
          <div>
            <label htmlFor="req-location" className="mms-label flex items-center gap-1.5">
              <MapPin size={14} className="text-mms-ink-muted" />
              <span>Location / room / area</span>
            </label>
            <input
              id="req-location"
              type="text"
              className="mms-input"
              placeholder="e.g. Building A, Floor 2, Classroom 204 or Girls Gymnasium"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="req-desc" className="mms-label flex items-center gap-1.5">
              <FileText size={14} className="text-mms-ink-muted" />
              <span>Issue description *</span>
            </label>
            <textarea
              id="req-desc"
              rows={4}
              className="mms-input resize-y"
              placeholder="Describe the maintenance requirement in detail (e.g. water dripping from AC vent, sparking socket, broken door lock)..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          {/* File Uploads */}
          <div>
            <span className="mms-label flex items-center gap-1.5">
              <UploadCloud size={14} className="text-mms-ink-muted" />
              <span>Attachments (photos / documents — max 5 files, 5MB each)</span>
            </span>

            <label className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed border-mms-border bg-mms-surface px-6 py-6 text-center transition-colors duration-150 hover:border-mms-primary hover:bg-mms-primary-soft/40 focus-within:border-mms-primary">
              <UploadCloud size={24} className="mb-1 text-mms-primary" />
              <span className="text-sm font-medium text-mms-ink">
                Click to attach photos or files of the issue
              </span>
              <span className="text-xs text-mms-ink-muted">PNG, JPG, PDF up to 5MB</span>
              <input
                type="file"
                multiple
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                disabled={isSubmitting}
                style={{ display: 'none' }}
              />
            </label>

            {files.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {files.map((file, idx) => (
                  <div
                    key={idx}
                    className="inline-flex items-center gap-1.5 rounded-md border border-mms-border bg-mms-surface px-2.5 py-1 text-xs text-mms-ink"
                  >
                    <span>{file.name}</span>
                    <span className="text-mms-ink-muted">({(file.size / 1024).toFixed(1)} KB)</span>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="text-mms-ink-muted transition-colors duration-150 hover:text-mms-ink"
                      aria-label={`Remove ${file.name}`}
                      disabled={isSubmitting}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t border-mms-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-outline h-10"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary btn-lg" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <CheckCircle size={17} />
                  <span>Submit request</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
