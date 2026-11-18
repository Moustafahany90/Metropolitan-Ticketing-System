import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, X } from "lucide-react";
import { listCategories, listDepartments, listTickets } from "@/services/tickets";
import { errorMessage } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import StatusBadge from "@/components/StatusBadge";
import PriorityBadge from "@/components/PriorityBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type {
  Category,
  Department,
  Ticket,
  TicketPriority,
  TicketQuery,
  TicketStatus,
} from "@/types";

const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

const PAGE_SIZE = 20;

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function TicketsPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TicketStatus | "">("");
  const [priority, setPriority] = useState<TicketPriority | "">("");
  const [departmentId, setDepartmentId] = useState<number | "">("");
  const [categoryId, setCategoryId] = useState<number | "">("");

  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const debouncedSearch = useDebouncedValue(search, 300);

  const isTechnician = user?.role === "TECHNICIAN";
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtersActive =
    debouncedSearch.trim() !== "" ||
    status !== "" ||
    priority !== "" ||
    departmentId !== "" ||
    categoryId !== "";

  useEffect(() => {
    listDepartments().then(setDepartments).catch(() => undefined);
    listCategories().then(setCategories).catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params: TicketQuery = { page, pageSize: PAGE_SIZE };
    const trimmed = debouncedSearch.trim();
    if (trimmed) params.search = trimmed;
    if (status) params.status = status;
    if (priority) params.priority = priority;
    if (departmentId) params.departmentId = departmentId;
    if (categoryId) params.categoryId = categoryId;

    listTickets(params)
      .then((data) => {
        if (cancelled) return;
        setTickets(data.tickets);
        setTotal(data.total);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, status, priority, departmentId, categoryId, page]);

  function applyStatus(value: string): void {
    setStatus(value as TicketStatus | "");
    setPage(1);
  }

  function applyPriority(value: string): void {
    setPriority(value as TicketPriority | "");
    setPage(1);
  }

  function applyDepartment(value: string): void {
    setDepartmentId(value === "" ? "" : Number(value));
    setPage(1);
  }

  function applyCategory(value: string): void {
    setCategoryId(value === "" ? "" : Number(value));
    setPage(1);
  }

  function resetFilters(): void {
    setSearch("");
    setStatus("");
    setPriority("");
    setDepartmentId("");
    setCategoryId("");
    setPage(1);
  }

  const startIndex = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(total, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Tickets</h1>
          <p className="text-sm text-ink-muted">Your IT support tickets</p>
        </div>
        <Button asChild>
          <Link to="/tickets/new">
            <Plus /> New ticket
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, description or #id…"
            className="pl-9"
            aria-label="Search tickets"
          />
        </div>
        <Select value={status} onChange={(e) => applyStatus(e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          {(Object.keys(STATUS_LABELS) as TicketStatus[]).map((option) => (
            <option key={option} value={option}>
              {STATUS_LABELS[option]}
            </option>
          ))}
        </Select>
        <Select value={priority} onChange={(e) => applyPriority(e.target.value)} aria-label="Filter by priority">
          <option value="">All priorities</option>
          {(Object.keys(PRIORITY_LABELS) as TicketPriority[]).map((option) => (
            <option key={option} value={option}>
              {PRIORITY_LABELS[option]}
            </option>
          ))}
        </Select>
        <Select
          value={String(departmentId)}
          onChange={(e) => applyDepartment(e.target.value)}
          aria-label="Filter by department"
        >
          <option value="">All departments</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </Select>
        <Select
          value={String(categoryId)}
          onChange={(e) => applyCategory(e.target.value)}
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
        {filtersActive && (
          <Button variant="ghost" onClick={resetFilters} aria-label="Clear filters">
            <X /> Clear
          </Button>
        )}
      </div>

      {loading && <p className="text-sm text-ink-muted">Loading tickets…</p>}

      {!loading && error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && total === 0 && (
        <div className="rounded-xl border border-dashed border-border-soft bg-surface p-10 text-center text-ink-muted">
          {filtersActive
            ? "No tickets match your filters. Try adjusting or clearing them."
            : "No tickets yet. Create your first ticket to get IT support."}
        </div>
      )}

      {!loading && !error && tickets.length > 0 && (
        <>
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <Card key={ticket.id} className="transition-shadow hover:shadow-md">
                <CardContent className="p-4">
                  <Link to={`/tickets/${ticket.id}`} className="block">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-heading text-sm font-semibold text-ink">#{ticket.id}</span>
                      <span className="font-medium text-ink">{ticket.title}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                      <StatusBadge status={ticket.status} />
                      <PriorityBadge priority={ticket.priority} />
                      <span>{ticket.department.name}</span>
                      <span>·</span>
                      <span>{ticket.category.name}</span>
                      <span>·</span>
                      <span>{formatDate(ticket.createdAt)}</span>
                      {isTechnician && ticket.technician && (
                        <>
                          <span>·</span>
                          <span>Assigned to {ticket.technician.name}</span>
                        </>
                      )}
                    </div>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-muted">
              Showing {startIndex}–{endIndex} of {total}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-ink-muted">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}