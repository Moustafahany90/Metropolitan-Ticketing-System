import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { requestService } from '../services/requestService';
import CreateRequestModal from '../components/CreateRequestModal';
import RequestDetailModal from '../components/RequestDetailModal';
import { StatusBadge, PriorityBadge, RoleBadge } from '../components/Badge';
import {
  Plus,
  Search,
  MapPin,
  Tag,
  CheckCircle2,
  Hourglass,
  FileText,
  MessageSquare,
  Paperclip,
  RefreshCw,
  Wrench,
  ChevronRight,
  Inbox,
  Shield,
  UserCheck,
  Users,
  Timer,
  Flame,
  PackageCheck,
  Boxes,
} from 'lucide-react';

const METRIC_ICON_TONES = {
  total: 'bg-mms-primary-soft text-mms-primary',
  submitted: 'bg-status-submitted-bg text-status-submitted-fg',
  assigned: 'bg-status-assigned-bg text-status-assigned-fg',
  progress: 'bg-status-progress-bg text-status-progress-fg',
  completed: 'bg-status-completed-bg text-status-completed-fg',
  aging: 'border border-mms-gold/60 bg-mms-gold-soft text-mms-ink',
  urgent: 'border border-priority-urgent-fg/30 bg-priority-urgent-bg text-priority-urgent-fg',
};

function MetricCard({ icon, tone, value, label, alert = false }) {
  return (
    <div
      className={`card flex items-center gap-4 p-5 ${
        alert ? 'border-mms-gold/70 bg-mms-gold-soft' : ''
      }`}
    >
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${
          METRIC_ICON_TONES[tone]
        }`}
      >
        {icon}
      </div>
      <div className="flex flex-col">
        <span
          className={`font-display text-2xl font-bold tabular-nums ${
            alert ? 'text-priority-urgent-fg' : 'text-mms-ink'
          }`}
        >
          {value}
        </span>
        <span className="text-xs font-medium text-mms-ink-muted">{label}</span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState(null);
  const [categories, setCategories] = useState([]);
  const [spareParts, setSpareParts] = useState([]);
  const [sparePartsLoading, setSparePartsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Tabs: 'tickets' | 'inventory' (for Storekeeper & Supervisor)
  const [activeTab, setActiveTab] = useState('tickets');

  // Filters for requests
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Filters for spare parts tab
  const [partStatusFilter, setPartStatusFilter] = useState('PENDING');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState(null);

  const userRole = user?.role || 'EMPLOYEE';
  const isSupervisorOrAdmin = userRole === 'SUPERVISOR' || userRole === 'ADMIN';
  const isWorker = userRole === 'MAINTENANCE_WORKER';
  const isStoreKeeper = userRole === 'STORE_KEEPER';

  useEffect(() => {
    loadCategories();
    loadStats();
    if (activeTab === 'tickets') {
      loadRequests();
    } else if (activeTab === 'inventory') {
      loadSpareParts();
    }
  }, [statusFilter, categoryFilter, activeTab, partStatusFilter]);

  const loadCategories = async () => {
    try {
      const res = await requestService.getCategories();
      if (res.success && res.data) {
        setCategories(res.data);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const loadStats = async () => {
    try {
      const res = await requestService.getStats();
      if (res.success && res.data) {
        setStats(res.data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await requestService.getRequests({
        status: statusFilter || undefined,
        categoryId: categoryFilter || undefined,
        search: search || undefined,
      });
      if (res.success && res.data) {
        setRequests(res.data);
      } else {
        setRequests([]);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load maintenance requests');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, search]);

  const loadSpareParts = async () => {
    setSparePartsLoading(true);
    try {
      const res = await requestService.getSpareParts({
        status: partStatusFilter || undefined,
      });
      if (res.success && res.data) {
        setSpareParts(res.data);
      } else {
        setSpareParts([]);
      }
    } catch (err) {
      console.error('Error fetching spare parts:', err);
    } finally {
      setSparePartsLoading(false);
    }
  };

  const handleReleasePart = async (partId) => {
    try {
      const res = await requestService.releaseSparePart(partId);
      if (res.success) {
        loadSpareParts();
        loadStats();
      }
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to release spare part');
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (activeTab === 'tickets') {
      loadRequests();
    }
  };

  const handleRequestCreated = (newReq) => {
    loadRequests();
    loadStats();
    if (newReq && newReq.id) {
      setSelectedRequestId(newReq.id);
    }
  };

  const handleRequestUpdated = () => {
    loadRequests();
    loadStats();
    if (activeTab === 'inventory') {
      loadSpareParts();
    }
  };

  // Role-specific titles and subtitles
  const getDashboardTitle = () => {
    if (isSupervisorOrAdmin) return 'Supervisor Control Center';
    if (isWorker) return 'Maintenance Workbench';
    if (isStoreKeeper) return 'Spare Parts Hub';
    return 'School Maintenance Portal';
  };

  const getDashboardSubtitle = () => {
    if (isSupervisorOrAdmin) return 'Review, triage, and assign incoming maintenance requests';
    if (isWorker) return 'Execute tasks, track repair progress, and request parts';
    if (isStoreKeeper) return 'Fulfill requested materials and release spare parts to workers';
    return 'Submit and track your maintenance requests';
  };

  const isAging = (req) => {
    if (req.status !== 'SUBMITTED') return false;
    const created = new Date(req.createdAt);
    const now = new Date();
    return now - created > 24 * 60 * 60 * 1000;
  };

  // ===== METRICS RENDERING =====
  const renderMetrics = () => {
    if (!stats) return null;

    if (isStoreKeeper) {
      return (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard
            icon={<Boxes size={20} />}
            tone="aging"
            value={stats.pendingSpareParts || 0}
            label="Pending Release"
            alert
          />
          <MetricCard
            icon={<CheckCircle2 size={20} />}
            tone="completed"
            value={stats.releasedSpareParts || 0}
            label="Released Parts"
          />
          <MetricCard
            icon={<PackageCheck size={20} />}
            tone="total"
            value={stats.totalSpareParts || 0}
            label="Total Part Requests"
          />
          <MetricCard
            icon={<FileText size={20} />}
            tone="progress"
            value={stats.total || 0}
            label="Total School Requests"
          />
        </div>
      );
    }

    if (isSupervisorOrAdmin) {
      return (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard
            icon={<Hourglass size={20} />}
            tone="submitted"
            value={stats.submitted || 0}
            label="Pending Triage"
          />
          <MetricCard
            icon={<UserCheck size={20} />}
            tone="assigned"
            value={stats.assigned || 0}
            label="Assigned"
          />
          <MetricCard
            icon={<Wrench size={20} />}
            tone="progress"
            value={stats.inProgress || 0}
            label="In Progress"
          />
          <MetricCard
            icon={<CheckCircle2 size={20} />}
            tone="completed"
            value={stats.completed || 0}
            label="Completed"
          />
          {stats.aging > 0 && (
            <MetricCard
              icon={<Timer size={20} />}
              tone="aging"
              value={stats.aging}
              label="Aging (24h+)"
              alert
            />
          )}
          {stats.urgentPending > 0 && (
            <MetricCard
              icon={<Flame size={20} />}
              tone="urgent"
              value={stats.urgentPending}
              label="Urgent Pending"
              alert
            />
          )}
        </div>
      );
    }

    if (isWorker) {
      return (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard
            icon={<FileText size={20} />}
            tone="total"
            value={stats.total || 0}
            label="Total Assigned"
          />
          <MetricCard
            icon={<UserCheck size={20} />}
            tone="assigned"
            value={stats.assigned || 0}
            label="Awaiting Start"
          />
          <MetricCard
            icon={<Wrench size={20} />}
            tone="progress"
            value={stats.inProgress || 0}
            label="In Progress"
          />
          <MetricCard
            icon={<CheckCircle2 size={20} />}
            tone="completed"
            value={stats.completed || 0}
            label="Completed"
          />
        </div>
      );
    }

    // Employee
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          icon={<FileText size={20} />}
          tone="total"
          value={stats.total || 0}
          label="Total Requests"
        />
        <MetricCard
          icon={<Hourglass size={20} />}
          tone="submitted"
          value={stats.submitted || 0}
          label="Submitted / Pending"
        />
        <MetricCard
          icon={<Wrench size={20} />}
          tone="progress"
          value={stats.inProgress || 0}
          label="In Progress / Assigned"
        />
        <MetricCard
          icon={<CheckCircle2 size={20} />}
          tone="completed"
          value={stats.completed || 0}
          label="Completed"
        />
      </div>
    );
  };

  // ===== RENDER REQUEST CARD =====
  const renderRequestCard = (req) => (
    <div
      key={req.id}
      onClick={() => setSelectedRequestId(req.id)}
      className={`card flex cursor-pointer items-center justify-between gap-4 p-5 text-left transition-colors duration-150 hover:border-mms-primary/50 hover:bg-mms-surface ${
        isAging(req) ? 'border-l-4 border-l-mms-gold' : ''
      }`}
    >
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-md border border-mms-primary/30 bg-mms-primary-soft px-2 py-0.5 font-mono text-[13px] font-bold text-mms-primary-dark tabular-nums">
            {req.ticketNumber}
          </span>
          <StatusBadge status={req.status} />
          <PriorityBadge priority={req.priority} />
          {isAging(req) && (
            <span
              className="badge border-mms-gold/70 bg-mms-gold-soft text-mms-ink"
              title="This request has been waiting for over 24 hours"
            >
              <Timer size={11} /> Aging
            </span>
          )}
          <span className="ml-auto text-xs text-mms-ink-muted">
            {new Date(req.createdAt).toLocaleDateString()}
          </span>
        </div>

        <h4 className="line-clamp-2 text-[15px] font-medium leading-snug text-mms-ink">
          {req.description}
        </h4>

        <div className="mt-0.5 flex flex-wrap items-center gap-3.5">
          <span className="inline-flex items-center gap-1.5 text-xs text-mms-ink-muted">
            <Tag size={13} />
            {req.category?.name || 'General'}
          </span>
          {req.location && (
            <span className="inline-flex items-center gap-1.5 text-xs text-mms-ink-muted">
              <MapPin size={13} />
              {req.location}
            </span>
          )}
          {req.requester && (isSupervisorOrAdmin || isWorker || isStoreKeeper) && (
            <span className="inline-flex items-center gap-1.5 text-xs text-mms-ink-muted">
              <Users size={13} />
              {req.requester.displayName || req.requester.username}
            </span>
          )}
          {req.assignedTo && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-mms-teal">
              <Wrench size={13} />
              {req.assignedTo.displayName || req.assignedTo.username}
            </span>
          )}
          {req._count?.spareParts > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-mms-border bg-mms-surface px-2 py-0.5 text-xs text-mms-ink-muted">
              <Boxes size={13} />
              {req._count.spareParts} parts
            </span>
          )}
          {req._count?.attachments > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-mms-border bg-mms-surface px-2 py-0.5 text-xs text-mms-ink-muted">
              <Paperclip size={13} />
              {req._count.attachments}
            </span>
          )}
          {req._count?.comments > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-mms-border bg-mms-surface px-2 py-0.5 text-xs text-mms-ink-muted">
              <MessageSquare size={13} />
              {req._count.comments}
            </span>
          )}
        </div>
      </div>

      <div className="pl-2 text-mms-ink-muted">
        <ChevronRight size={18} />
      </div>
    </div>
  );

  // ===== RENDER SPARE PARTS INVENTORY QUEUE (STOREKEEPER VIEW) =====
  const renderSparePartsQueue = () => (
    <div className="card p-5">
      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-mms-primary/20 ${
              partStatusFilter === 'PENDING'
                ? 'border-mms-primary bg-mms-primary-soft text-mms-primary-dark'
                : 'border-mms-border bg-white text-mms-ink-muted hover:bg-mms-surface hover:text-mms-ink'
            }`}
            onClick={() => setPartStatusFilter('PENDING')}
          >
            Pending Release ({stats?.pendingSpareParts || 0})
          </button>
          <button
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-mms-primary/20 ${
              partStatusFilter === 'RELEASED'
                ? 'border-mms-primary bg-mms-primary-soft text-mms-primary-dark'
                : 'border-mms-border bg-white text-mms-ink-muted hover:bg-mms-surface hover:text-mms-ink'
            }`}
            onClick={() => setPartStatusFilter('RELEASED')}
          >
            Released History ({stats?.releasedSpareParts || 0})
          </button>
          <button
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-mms-primary/20 ${
              partStatusFilter === ''
                ? 'border-mms-primary bg-mms-primary-soft text-mms-primary-dark'
                : 'border-mms-border bg-white text-mms-ink-muted hover:bg-mms-surface hover:text-mms-ink'
            }`}
            onClick={() => setPartStatusFilter('')}
          >
            All Parts
          </button>
          <button
            onClick={loadSpareParts}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-mms-border bg-white text-mms-ink-muted transition-colors duration-150 hover:bg-mms-surface hover:text-mms-ink focus:outline-none focus:ring-2 focus:ring-mms-primary/20"
            title="Refresh spare parts queue"
            aria-label="Refresh spare parts queue"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {sparePartsLoading ? (
        <div className="flex flex-col items-center justify-center p-12">
          <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-mms-border border-t-mms-primary"></div>
          <p className="mt-3 text-sm text-mms-ink-muted">Loading spare parts...</p>
        </div>
      ) : spareParts.length === 0 ? (
        <div className="flex flex-col items-center px-8 py-16 text-center">
          <Boxes size={36} className="mb-3 text-mms-ink-muted" />
          <h4 className="font-display text-lg font-semibold">No spare parts in queue</h4>
          <p className="mt-1 max-w-[420px] text-sm text-mms-ink-muted">
            There are no spare parts matching the filter.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-mms-border bg-white">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-mms-border bg-mms-surface">
                <th className="px-3.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-mms-ink-muted">
                  Part Description
                </th>
                <th className="px-3.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-mms-ink-muted">
                  Quantity
                </th>
                <th className="px-3.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-mms-ink-muted">
                  Linked Request
                </th>
                <th className="px-3.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-mms-ink-muted">
                  Requested By
                </th>
                <th className="px-3.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-mms-ink-muted">
                  Status
                </th>
                <th className="px-3.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-mms-ink-muted">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {spareParts.map((part) => (
                <tr key={part.id} className="border-b border-mms-border/70 hover:bg-mms-surface">
                  <td className="px-3.5 py-3 align-middle">
                    <div className="font-semibold text-mms-ink">{part.partName}</div>
                    {part.notes && (
                      <div className="mt-0.5 text-xs text-mms-ink-muted">{part.notes}</div>
                    )}
                  </td>
                  <td className="px-3.5 py-3 text-center font-bold align-middle tabular-nums">
                    {part.quantity}
                  </td>
                  <td className="px-3.5 py-3 align-middle">
                    <button
                      className="text-sm font-semibold text-mms-primary underline transition-colors duration-150 hover:text-mms-primary-dark"
                      onClick={() => setSelectedRequestId(part.request?.id)}
                    >
                      {part.request?.ticketNumber || 'Request'}
                    </button>
                    <div className="text-xs text-mms-ink-muted">{part.request?.location}</div>
                  </td>
                  <td className="px-3.5 py-3 align-middle">
                    {part.requestedBy?.displayName || part.requestedBy?.username}
                  </td>
                  <td className="px-3.5 py-3 align-middle">
                    {part.releasedAt ? (
                      <span className="badge border-status-completed-fg/30 bg-status-completed-bg text-status-completed-fg">
                        Released ({part.releasedBy?.displayName || 'Store'})
                      </span>
                    ) : (
                      <span className="badge border-status-progress-fg/30 bg-status-progress-bg text-status-progress-fg">
                        Pending Release
                      </span>
                    )}
                  </td>
                  <td className="px-3.5 py-3 align-middle">
                    {!part.releasedAt ? (
                      <button
                        className="btn-primary h-8 px-3 text-xs"
                        onClick={() => handleReleasePart(part.id)}
                      >
                        Release part
                      </button>
                    ) : (
                      <span className="text-xs text-mms-ink-muted">Delivered</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // ===== MAIN RENDER =====
  return (
    <div className="flex flex-col gap-7">
      {/* Top Banner with Action */}
      <div className="card p-6 sm:p-8">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="flex items-center gap-2.5 font-display text-2xl font-bold">
              {isSupervisorOrAdmin && <Shield size={24} className="text-mms-primary" />}
              {isWorker && <Wrench size={24} className="text-mms-primary" />}
              {isStoreKeeper && <Boxes size={24} className="text-mms-primary" />}
              {getDashboardTitle()}
            </h1>
            <p className="mt-2 text-sm text-mms-ink-muted">
              Welcome,{' '}
              <strong className="font-semibold text-mms-ink">
                {user?.displayName || user?.username}
              </strong>{' '}
              <span className="mx-1 inline-block align-middle">
                <RoleBadge role={userRole} />
              </span>{' '}
              — {getDashboardSubtitle()}
            </p>
          </div>
          {!isWorker && !isStoreKeeper && (
            <button onClick={() => setIsCreateOpen(true)} className="btn-primary btn-lg shrink-0 px-6">
              <Plus size={18} />
              <span>New request</span>
            </button>
          )}
        </div>

        {/* Storekeeper / Supervisor Tab Navigation */}
        {(isStoreKeeper || isSupervisorOrAdmin) && (
          <div className="mt-5 flex gap-2 border-b border-mms-border pb-3">
            <button
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-mms-primary/20 ${
                activeTab === 'tickets'
                  ? 'border-mms-primary/30 bg-mms-primary-soft text-mms-primary-dark'
                  : 'border-transparent text-mms-ink-muted hover:bg-mms-surface hover:text-mms-ink'
              }`}
              onClick={() => setActiveTab('tickets')}
            >
              <FileText size={16} />
              <span>Requests</span>
            </button>
            <button
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-mms-primary/20 ${
                activeTab === 'inventory'
                  ? 'border-mms-primary/30 bg-mms-primary-soft text-mms-primary-dark'
                  : 'border-transparent text-mms-ink-muted hover:bg-mms-surface hover:text-mms-ink'
              }`}
              onClick={() => setActiveTab('inventory')}
            >
              <Boxes size={16} />
              <span>Spare Parts Queue</span>
              {stats?.pendingSpareParts > 0 && (
                <span className="inline-flex items-center justify-center rounded-full bg-mms-gold px-1.5 py-0.5 text-[11px] font-bold text-mms-ink">
                  {stats.pendingSpareParts}
                </span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Metrics Bar */}
      {renderMetrics()}

      {/* Main Tab Content */}
      {activeTab === 'inventory' ? (
        renderSparePartsQueue()
      ) : (
        <>
          {/* Filter and Search Bar */}
          <div className="card flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
            <form onSubmit={handleSearchSubmit} className="flex flex-1 items-center gap-3">
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-mms-ink-muted"
                />
                <input
                  type="text"
                  className="mms-input pl-10"
                  placeholder="Search by ticket number (MNT-000001), location, or description..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search requests"
                />
              </div>
              <button type="submit" className="btn-outline h-10 shrink-0">
                Search
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="mms-input cursor-pointer"
                aria-label="Filter by status"
              >
                <option value="">All statuses</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="REJECTED">Rejected</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="mms-input cursor-pointer"
                aria-label="Filter by category"
              >
                <option value="">All categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>

              <button
                onClick={() => {
                  setSearch('');
                  setStatusFilter('');
                  setCategoryFilter('');
                }}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-mms-border bg-white text-mms-ink-muted transition-colors duration-150 hover:bg-mms-surface hover:text-mms-ink focus:outline-none focus:ring-2 focus:ring-mms-primary/20"
                title="Reset filters"
                aria-label="Reset filters"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          {/* Requests List */}
          <div className="flex flex-col">
            {loading ? (
              <div className="card flex flex-col items-center justify-center p-12">
                <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-mms-border border-t-mms-primary"></div>
                <p className="mt-3 text-sm text-mms-ink-muted">Loading requests...</p>
              </div>
            ) : error ? (
              <div
                role="alert"
                className="rounded-lg border border-red-700/30 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            ) : requests.length === 0 ? (
              <div className="card flex flex-col items-center px-8 py-16 text-center">
                <div className="mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-full border border-mms-border bg-mms-surface text-mms-ink-muted">
                  <Inbox size={40} />
                </div>
                <h3 className="font-display text-lg font-semibold">
                  {isSupervisorOrAdmin
                    ? 'No requests awaiting action'
                    : isWorker
                    ? 'No assigned tasks'
                    : isStoreKeeper
                    ? 'No requests linked'
                    : 'No maintenance requests found'}
                </h3>
                <p className="mt-2 max-w-[420px] text-sm text-mms-ink-muted">
                  {search || statusFilter || categoryFilter
                    ? 'No requests match your current filters. Try resetting the filter.'
                    : isSupervisorOrAdmin
                    ? 'All maintenance requests have been triaged. Check back later for new submissions.'
                    : isWorker
                    ? 'You currently have no assigned maintenance tasks.'
                    : 'You have not submitted any maintenance requests yet.'}
                </p>
                {!isWorker && !isSupervisorOrAdmin && !isStoreKeeper && (
                  <button onClick={() => setIsCreateOpen(true)} className="btn-primary mt-5">
                    <Plus size={16} />
                    <span>Submit first request</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">{requests.map(renderRequestCard)}</div>
            )}
          </div>
        </>
      )}

      {/* Create Request Modal */}
      <CreateRequestModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onRequestCreated={handleRequestCreated}
      />

      {/* Request Details Modal */}
      <RequestDetailModal
        requestId={selectedRequestId}
        isOpen={!!selectedRequestId}
        onClose={() => {
          setSelectedRequestId(null);
          loadRequests();
          loadStats();
          if (activeTab === 'inventory') {
            loadSpareParts();
          }
        }}
        onRequestUpdated={handleRequestUpdated}
      />
    </div>
  );
}
