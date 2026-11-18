import React from 'react';

const STATUS_STYLES = {
  SUBMITTED: {
    label: 'Submitted',
    cls: 'border-status-submitted-fg/30 bg-status-submitted-bg text-status-submitted-fg',
  },
  ASSIGNED: {
    label: 'Assigned',
    cls: 'border-status-assigned-fg/30 bg-status-assigned-bg text-status-assigned-fg',
  },
  IN_PROGRESS: {
    label: 'In progress',
    cls: 'border-status-progress-fg/30 bg-status-progress-bg text-status-progress-fg',
  },
  COMPLETED: {
    label: 'Completed',
    cls: 'border-status-completed-fg/30 bg-status-completed-bg text-status-completed-fg',
  },
  REJECTED: {
    label: 'Rejected',
    cls: 'border-status-rejected-fg/30 bg-status-rejected-bg text-status-rejected-fg',
  },
};

const PRIORITY_STYLES = {
  Normal: {
    label: 'Normal',
    cls: 'border-priority-normal-fg/30 bg-priority-normal-bg text-priority-normal-fg',
  },
  High: {
    label: 'High',
    cls: 'border-priority-high-fg/30 bg-priority-high-bg text-priority-high-fg',
  },
  Urgent: {
    label: 'Urgent',
    cls: 'border-priority-urgent-fg/30 bg-priority-urgent-bg text-priority-urgent-fg',
  },
};

const ROLE_STYLES = {
  ADMIN: {
    label: 'Admin',
    cls: 'border-mms-primary/30 bg-mms-primary-soft text-mms-primary-dark',
  },
  SUPERVISOR: {
    label: 'Supervisor',
    cls: 'border-mms-gold/70 bg-mms-gold-soft text-mms-ink',
  },
  MAINTENANCE_WORKER: {
    label: 'Maintenance Worker',
    cls: 'border-mms-teal/30 bg-mms-teal/10 text-mms-teal',
  },
  WORKER: {
    label: 'Maintenance Worker',
    cls: 'border-mms-teal/30 bg-mms-teal/10 text-mms-teal',
  },
  STORE_KEEPER: {
    label: 'Store Keeper',
    cls: 'border-mms-ink/20 bg-white text-mms-ink',
  },
  STORE: {
    label: 'Store Keeper',
    cls: 'border-mms-ink/20 bg-white text-mms-ink',
  },
  EMPLOYEE: {
    label: 'Employee',
    cls: 'border-mms-border bg-mms-surface text-mms-ink-muted',
  },
};

export function StatusBadge({ status }) {
  const s = STATUS_STYLES[status];
  if (!s) return null;
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

export function PriorityBadge({ priority }) {
  const s = PRIORITY_STYLES[priority];
  if (!s) return null;
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

export function RoleBadge({ role }) {
  const s = ROLE_STYLES[role] || ROLE_STYLES.EMPLOYEE;
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}
