import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  X,
  UploadCloud,
  FileText,
  AlertCircle,
  MapPin,
  Tag,
  Paperclip,
  CheckCircle,
} from "lucide-react";
import { createRequest, getCategories } from "@/services/maintenance";
import { errorMessage } from "@/services/api";
import type {
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceRequest,
} from "@/types/maintenance";

interface CreateRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestCreated?: (request: MaintenanceRequest) => void;
}

export default function CreateRequestModal({
  isOpen,
  onClose,
  onRequestCreated,
}: CreateRequestModalProps) {
  const [categories, setCategories] = useState<MaintenanceCategory[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");
  const [priority, setPriority] = useState<MaintenancePriority>("Normal");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    void (async () => {
      try {
        const list = await getCategories();
        setCategories(list);
        setCategoryId((prev) => prev || (list[0] ? String(list[0].id) : ""));
      } catch (err) {
        console.error("Failed to load categories", err);
      }
    })();
    setPriority("Normal");
    setLocation("");
    setDescription("");
    setFiles([]);
    setError("");
  }, [isOpen]);

  if (!isOpen) return null;

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const selected = Array.from(e.target.files);
    const validFiles: File[] = [];
    let sizeError = false;

    selected.forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        sizeError = true;
      } else {
        validFiles.push(file);
      }
    });

    setError(sizeError ? "One or more files exceeded the 5MB size limit and were omitted." : "");
    setFiles((prev) => [...prev, ...validFiles].slice(0, 5));
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!description.trim()) {
      setError("Please provide a description of the maintenance issue.");
      return;
    }
    if (!categoryId) {
      setError("Please select a maintenance category.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("categoryId", categoryId);
      formData.append("priority", priority);
      formData.append("location", location);
      formData.append("description", description);
      files.forEach((file) => formData.append("attachments", file));

      const created = await createRequest(formData);
      onRequestCreated?.(created);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  function priorityChipCls(p: MaintenancePriority) {
    const base =
      "flex-1 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-mms-primary/20 disabled:opacity-60";
    if (priority !== p) {
      return `${base} border-mms-border bg-white text-mms-ink-muted hover:bg-mms-surface hover:text-mms-ink`;
    }
    if (p === "Normal") return `${base} border-slate-500 bg-slate-100 text-slate-700`;
    if (p === "High")
      return `${base} border-priority-high-fg/60 bg-priority-high-bg text-priority-high-fg`;
    return `${base} border-priority-urgent-fg/60 bg-priority-urgent-bg text-priority-urgent-fg`;
  }

  return (
    <div className="fixed inset-0 z-[100] flex animate-fade-in items-center justify-center bg-mms-ink/40 p-6 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-mms-border bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-mms-border px-6 py-5">
          <div>
            <h2 className="font-display text-xl font-bold text-mms-ink">
              New maintenance request
            </h2>
            <p className="mt-0.5 text-xs text-mms-ink-muted">
              Report a facility, electrical, plumbing, or general issue
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

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 overflow-y-auto p-6">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-red-700/30 bg-red-50 px-3.5 py-3 text-sm text-red-700"
            >
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <label htmlFor="mnt-category" className="mms-label flex items-center gap-1.5">
                <Tag size={14} className="text-mms-ink-muted" />
                <span>Category</span>
              </label>
              <select
                id="mnt-category"
                className="mms-input cursor-pointer"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={isSubmitting}
              >
                <option value="" disabled>
                  Select a category
                </option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <span className="mms-label">Priority</span>
              <div className="flex gap-2">
                {(["Normal", "High", "Urgent"] as MaintenancePriority[]).map((p) => (
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

          <div>
            <label htmlFor="mnt-location" className="mms-label flex items-center gap-1.5">
              <MapPin size={14} className="text-mms-ink-muted" />
              <span>Location / room / area</span>
            </label>
            <input
              id="mnt-location"
              type="text"
              className="mms-input"
              placeholder="e.g. Building A, Floor 2, Classroom 204"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="mnt-description" className="mms-label flex items-center gap-1.5">
              <FileText size={14} className="text-mms-ink-muted" />
              <span>Issue description</span>
            </label>
            <textarea
              id="mnt-description"
              rows={4}
              className="mms-input resize-y"
              placeholder="Describe the maintenance requirement in detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          <div>
            <span className="mms-label flex items-center gap-1.5">
              <Paperclip size={14} className="text-mms-ink-muted" />
              <span>Attachments (max 5 files, 5MB each)</span>
            </span>
            <label className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed border-mms-border bg-mms-surface px-6 py-6 text-center transition-colors duration-150 hover:border-mms-primary hover:bg-mms-primary-soft/40">
              <UploadCloud size={24} className="mb-1 text-mms-primary" />
              <span className="text-sm font-medium text-mms-ink">
                Click to attach photos or files
              </span>
              <span className="text-xs text-mms-ink-muted">Up to 5 files, 5MB each</span>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
                disabled={isSubmitting}
              />
            </label>

            {files.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {files.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-2 rounded-lg border border-mms-border bg-mms-surface px-3 py-1.5 text-xs text-mms-ink"
                  >
                    <Paperclip size={13} />
                    <span className="max-w-[180px] truncate">{file.name}</span>
                    <span className="text-mms-ink-muted">
                      {(file.size / 1024).toFixed(0)} KB
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="text-mms-ink-muted transition-colors duration-150 hover:text-status-rejected-fg"
                      aria-label={`Remove ${file.name}`}
                      disabled={isSubmitting}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t border-mms-border pt-4">
            <button type="button" className="btn-outline h-10" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary btn-lg"
              disabled={isSubmitting || !description.trim()}
            >
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
