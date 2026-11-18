import React, { useState, useEffect } from 'react';
import { requestService } from '../services/requestService';
import { useAuth } from '../context/AuthContext';
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
  PackageCheck,
} from 'lucide-react';
import AssignWorkerModal from './AssignWorkerModal';
import RejectRequestModal from './RejectRequestModal';
import RequestSparePartModal from './RequestSparePartModal';
import CompleteWorkModal from './CompleteWorkModal';
import { StatusBadge, PriorityBadge, RoleBadge } from './Badge';

const SECTION_TITLE =
  'mb-3 flex items-center gap-2 font-display text-[15px] font-semibold text-mms-ink';

export default function RequestDetailModal({ requestId, isOpen, onClose, onRequestUpdated }) {
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isSparePartModalOpen, setIsSparePartModalOpen] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const { user } = useAuth();

  const isSupervisorOrAdmin = user?.role === 'SUPERVISOR' || user?.role === 'ADMIN';
  const isStoreKeeper = user?.role === 'STORE_KEEPER';

  useEffect(() => {
    if (isOpen && requestId) {
      loadRequestDetails();
    }
  }, [isOpen, requestId]);

  const loadRequestDetails = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await requestService.getRequestById(requestId);
      if (res.success && res.data) {
        setRequest(res.data);
      } else {
        setError('Could not load request details');
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Error fetching request details');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkReceived = async () => {
    if (!request) return;
    try {
      setActionLoading(true);
      const res = await requestService.receiveRequest(request.id);
      if (res.success) {
        setRequest(res.data);
        onRequestUpdated?.(res.data);
      }
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to acknowledge receipt');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartWork = async () => {
    if (!request) return;
    try {
      setActionLoading(true);
      const res = await requestService.startWork(request.id, request.status);
      if (res.success) {
        setRequest(res.data);
        onRequestUpdated?.(res.data);
      }
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to start work');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReleasePart = async (partId) => {
    try {
      setActionLoading(true);
      const res = await requestService.releaseSparePart(partId);
      if (res.success) {
        // Refresh request
        const freshRes = await requestService.getRequestById(request.id);
        if (freshRes.success) {
          setRequest(freshRes.data);
          onRequestUpdated?.(freshRes.data);
        }
      }
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to release spare part');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssigned = (updatedRequest) => {
    setRequest(updatedRequest);
    onRequestUpdated?.(updatedRequest);
  };

  const handleRejected = (updatedRequest) => {
    setRequest(updatedRequest);
    onRequestUpdated?.(updatedRequest);
  };

  const handleWorkCompleted = (updatedRequest) => {
    setRequest(updatedRequest);
    onRequestUpdated?.(updatedRequest);
  };

  const handleSparePartAdded = (updatedRequest) => {
    setRequest(updatedRequest);
    onRequestUpdated?.(updatedRequest);
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setSubmittingComment(true);
    try {
      const res = await requestService.addComment(requestId, commentText.trim());
      if (res.success && res.data) {
        setCommentText('');
        setRequest((prev) => ({
          ...prev,
          comments: [...(prev.comments || []), res.data],
        }));
      }
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to submit comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  if (!isOpen) return null;

  const getStepState = (stepName) => {
    const order = ['SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED'];
    const currentIndex = order.indexOf(request?.status || 'SUBMITTED');
    const stepIndex = order.indexOf(stepName);

    if (request?.status === 'REJECTED') {
      return stepName === 'SUBMITTED' ? 'done' : 'pending';
    }

    if (stepIndex < currentIndex) return 'done';
    if (stepIndex === currentIndex) return 'current';
    return 'pending';
  };

  const stepCircleCls = (state) => {
    if (state === 'done')
      return 'border-status-completed-fg bg-status-completed-fg text-white';
    if (state === 'current')
      return 'border-mms-primary bg-mms-primary text-white ring-2 ring-mms-primary/25';
    return 'border-mms-border bg-white text-mms-ink-muted';
  };

  // Supervisor actions permissions
  const canReceive =
    isSupervisorOrAdmin && request && !request.receivedById && request.status === 'SUBMITTED';
  const canAssign =
    isSupervisorOrAdmin &&
    request &&
    (request.status === 'SUBMITTED' || request.status === 'ASSIGNED');
  const canReject =
    isSupervisorOrAdmin &&
    request &&
    request.status !== 'COMPLETED' &&
    request.status !== 'REJECTED';

  // Worker actions permissions
  const isAssignedWorker = request && (request.assignedToId === user?.id || isSupervisorOrAdmin);
  const canStartWork = isAssignedWorker && request?.status === 'ASSIGNED';
  const canExecuteWork = isAssignedWorker && request?.status === 'IN_PROGRESS';

  const actionBtnCls =
    'inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-[13px] font-semibold transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-mms-primary/20 disabled:cursor-not-allowed disabled:opacity-50';

  const tableThCls =
    'border-b border-mms-border bg-mms-surface px-3.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-mms-ink-muted';

  return (
    <div className="fixed inset-0 z-[100] flex animate-fade-in items-center justify-center bg-mms-ink/40 p-6 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-[780px] flex-col overflow-hidden rounded-xl border border-mms-border bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-mms-border px-6 py-5">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-xl font-bold tabular-nums text-mms-primary">
                {request?.ticketNumber || 'Request details'}
              </span>
              {request && <StatusBadge status={request.status} />}
              {request && <PriorityBadge priority={request.priority} />}
            </div>
            <p className="mt-1 text-xs text-mms-ink-muted">
              Submitted on{' '}
              {request?.createdAt ? new Date(request.createdAt).toLocaleString() : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-mms-ink-muted transition-colors duration-150 hover:bg-mms-surface hover:text-mms-ink focus:outline-none focus:ring-2 focus:ring-mms-primary/20"
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-mms-border border-t-mms-primary"></div>
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
            {/* Workflow Progress Bar */}
            <div className="flex items-center justify-between rounded-lg border border-mms-border bg-mms-surface px-6 py-4">
              {[
                { key: 'SUBMITTED', label: 'Submitted' },
                { key: 'ASSIGNED', label: 'Assigned' },
                { key: 'IN_PROGRESS', label: 'In Progress' },
                { key: 'COMPLETED', label: 'Completed' },
              ].map((step, idx, arr) => {
                const state = getStepState(step.key);
                return (
                  <React.Fragment key={step.key}>
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
                          state === 'current' ? 'text-mms-primary' : 'text-mms-ink-muted'
                        }`}
                      >
                        {step.label}
                      </div>
                    </div>
                    {idx < arr.length - 1 && (
                      <div className="mt-[13px] h-0.5 flex-1 self-start bg-mms-border mx-3"></div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Supervisor Action Bar */}
            {isSupervisorOrAdmin &&
              request.status !== 'COMPLETED' &&
              request.status !== 'REJECTED' && (
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
                        <span>{actionLoading ? 'Processing...' : 'Mark received'}</span>
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

            {/* Worker Execution Action Bar */}
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
                      <span>{actionLoading ? 'Starting...' : 'Start work'}</span>
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

            {/* Request Info Grid */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="flex flex-col gap-1 rounded-lg border border-mms-border bg-mms-surface p-3">
                <span className="flex items-center gap-1.5 text-xs text-mms-ink-muted">
                  <Tag size={14} /> Category
                </span>
                <span className="text-sm font-semibold text-mms-ink">
                  {request.category?.name || 'General'}
                </span>
              </div>
              <div className="flex flex-col gap-1 rounded-lg border border-mms-border bg-mms-surface p-3">
                <span className="flex items-center gap-1.5 text-xs text-mms-ink-muted">
                  <MapPin size={14} /> Location
                </span>
                <span className="text-sm font-semibold text-mms-ink">
                  {request.location || 'Not specified'}
                </span>
              </div>
              <div className="flex flex-col gap-1 rounded-lg border border-mms-border bg-mms-surface p-3">
                <span className="flex items-center gap-1.5 text-xs text-mms-ink-muted">
                  <User size={14} /> Requester
                </span>
                <span className="text-sm font-semibold text-mms-ink">
                  {request.requester?.displayName || request.requester?.username}
                </span>
              </div>
              <div className="flex flex-col gap-1 rounded-lg border border-mms-border bg-mms-surface p-3">
                <span className="flex items-center gap-1.5 text-xs text-mms-ink-muted">
                  <Clock size={14} /> Department
                </span>
                <span className="text-sm font-semibold text-mms-ink">
                  {request.department?.name || 'School Staff'}
                </span>
              </div>
              {/* Show assignment info */}
              {request.assignedTo && (
                <div className="flex flex-col gap-1 rounded-lg border border-mms-border bg-mms-surface p-3">
                  <span className="flex items-center gap-1.5 text-xs text-mms-ink-muted">
                    <Wrench size={14} /> Assigned to
                  </span>
                  <span className="text-sm font-semibold text-mms-ink">
                    {request.assignedTo.displayName || request.assignedTo.username}
                  </span>
                </div>
              )}
              {request.assignedBy && (
                <div className="flex flex-col gap-1 rounded-lg border border-mms-border bg-mms-surface p-3">
                  <span className="flex items-center gap-1.5 text-xs text-mms-ink-muted">
                    <UserCheck size={14} /> Assigned by
                  </span>
                  <span className="text-sm font-semibold text-mms-ink">
                    {request.assignedBy.displayName || request.assignedBy.username}
                    {request.assignedAt && (
                      <span className="ml-1 text-xs font-normal text-mms-ink-muted">
                        — {new Date(request.assignedAt).toLocaleString()}
                      </span>
                    )}
                  </span>
                </div>
              )}
              {request.receivedBy && (
                <div className="flex flex-col gap-1 rounded-lg border border-mms-border bg-mms-surface p-3">
                  <span className="flex items-center gap-1.5 text-xs text-mms-ink-muted">
                    <Eye size={14} /> Received by
                  </span>
                  <span className="text-sm font-semibold text-mms-ink">
                    {request.receivedBy.displayName || request.receivedBy.username}
                    {request.receivedAt && (
                      <span className="ml-1 text-xs font-normal text-mms-ink-muted">
                        — {new Date(request.receivedAt).toLocaleString()}
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <h4 className={SECTION_TITLE}>Issue description</h4>
              <div className="whitespace-pre-wrap rounded-lg border border-mms-border bg-mms-surface p-4 text-sm leading-relaxed text-mms-ink">
                {request.description}
              </div>
            </div>

            {/* Work Execution Details Section (when work started or completed) */}
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
                      <div className="mb-1.5 text-[13px] font-semibold text-mms-ink">
                        Action taken
                      </div>
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

            {/* Spare Parts Section */}
            {request.spareParts && request.spareParts.length > 0 && (
              <div>
                <h4 className={SECTION_TITLE}>
                  <PackageCheck size={16} /> Requested spare parts ({request.spareParts.length})
                </h4>
                <div className="overflow-x-auto rounded-lg border border-mms-border bg-white">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className={tableThCls}>Part specification</th>
                        <th className={tableThCls}>Qty</th>
                        <th className={tableThCls}>Requested by</th>
                        <th className={tableThCls}>Status</th>
                        {(isStoreKeeper || isSupervisorOrAdmin) && (
                          <th className={tableThCls}>Action</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {request.spareParts.map((part) => (
                        <tr
                          key={part.id}
                          className="border-b border-mms-border/70 hover:bg-mms-surface"
                        >
                          <td className="px-3.5 py-3 align-middle">
                            <div className="font-semibold text-mms-ink">{part.partName}</div>
                            {part.notes && (
                              <div className="mt-0.5 text-xs text-mms-ink-muted">
                                {part.notes}
                              </div>
                            )}
                          </td>
                          <td className="px-3.5 py-3 text-center font-bold tabular-nums align-middle">
                            {part.quantity}
                          </td>
                          <td className="px-3.5 py-3 align-middle">
                            {part.requestedBy?.displayName ||
                              part.requestedBy?.username ||
                              'Worker'}
                          </td>
                          <td className="px-3.5 py-3 align-middle">
                            {part.releasedAt ? (
                              <span className="badge border-status-completed-fg/30 bg-status-completed-bg text-status-completed-fg">
                                Released {new Date(part.releasedAt).toLocaleDateString()}
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

            {/* Rejection Info */}
            {request.status === 'REJECTED' && request.rejectionReason && (
              <div>
                <h4 className={`${SECTION_TITLE} text-priority-urgent-fg`}>
                  <XCircle size={15} /> Rejection details
                </h4>
                <div className="rounded-lg border border-status-rejected-fg/30 bg-status-rejected-bg p-4">
                  <p className="mb-2 text-sm leading-relaxed text-status-rejected-fg">
                    {request.rejectionReason}
                  </p>
                  {request.rejectedBy && (
                    <p className="text-xs text-mms-ink-muted">
                      Rejected by{' '}
                      <strong className="font-semibold text-mms-ink">
                        {request.rejectedBy.displayName || request.rejectedBy.username}
                      </strong>
                      {request.rejectedAt && ` on ${new Date(request.rejectedAt).toLocaleString()}`}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Attachments */}
            {request.attachments && request.attachments.length > 0 && (
              <div>
                <h4 className={SECTION_TITLE}>
                  <Paperclip size={15} /> Attachments ({request.attachments.length})
                </h4>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
                  {request.attachments.map((att) => (
                    <a
                      key={att.id}
                      href={`/api/requests/attachments/${att.filePath}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 rounded-lg border border-mms-border bg-white px-3.5 py-2.5 text-mms-ink no-underline transition-colors duration-150 hover:border-mms-primary/50 hover:bg-mms-primary-soft/40"
                    >
                      <Paperclip size={16} className="text-mms-ink-muted" />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">{att.fileName}</span>
                        <span className="text-xs text-mms-ink-muted">
                          ({(att.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <Download size={14} className="text-mms-primary" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Audit Trail */}
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
                        {log.action.replace(/_/g, ' ')}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-mms-ink-muted">
                        <span>{log.user?.displayName || log.user?.username || 'System'}</span>
                        <span>{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Comments Thread */}
            <div>
              <h4 className={SECTION_TITLE}>
                <MessageSquare size={15} /> Comments ({request.comments?.length || 0})
              </h4>

              <div className="flex max-h-60 flex-col gap-3 overflow-y-auto pr-1">
                {request.comments && request.comments.length > 0 ? (
                  request.comments.map((cmt) => (
                    <div key={cmt.id} className="rounded-lg border border-mms-border bg-mms-surface p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-mms-ink">
                            {cmt.user?.displayName || cmt.user?.username}
                          </span>
                          {cmt.user?.role && (
                            <RoleBadge role={cmt.user.role?.name || cmt.user.role} />
                          )}
                        </div>
                        <span className="text-xs text-mms-ink-muted">
                          {new Date(cmt.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-1 text-sm leading-relaxed text-mms-ink">
                        {cmt.comment}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-[13px] italic text-mms-ink-muted">
                    No comments on this request yet.
                  </p>
                )}
              </div>

              {/* Add Comment Box */}
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

      {/* Sub-modals for supervisor actions */}
      <AssignWorkerModal
        request={request}
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        onAssigned={handleAssigned}
      />
      <RejectRequestModal
        request={request}
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        onRejected={handleRejected}
      />
      {/* Sub-modals for work execution */}
      <RequestSparePartModal
        request={request}
        isOpen={isSparePartModalOpen}
        onClose={() => setIsSparePartModalOpen(false)}
        onSparePartAdded={handleSparePartAdded}
      />
      <CompleteWorkModal
        request={request}
        isOpen={isCompleteModalOpen}
        onClose={() => setIsCompleteModalOpen(false)}
        onWorkCompleted={handleWorkCompleted}
      />
    </div>
  );
}
