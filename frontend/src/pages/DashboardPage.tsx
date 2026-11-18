import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { getDashboard } from "@/services/dashboard";
import { errorMessage } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import {
  BarBreakdown,
  PRIORITY_COLORS,
  StatCard,
  StatusDonut,
} from "@/components/DashboardCharts";
import StatusBadge from "@/components/StatusBadge";
import PriorityBadge from "@/components/PriorityBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardResponse, Ticket } from "@/types";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function StatCards({ totals }: { totals: DashboardResponse["totals"] }) {
  const cards = [
    { label: "Total tickets", value: totals.total, tone: "primary" as const },
    { label: "Open", value: totals.open, tone: "cyan" as const },
    { label: "In progress", value: totals.inProgress, tone: "amber" as const },
    { label: "Resolved", value: totals.resolved, tone: "green" as const },
    { label: "Closed", value: totals.closed, tone: "slate" as const },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <StatCard key={card.label} label={card.label} value={card.value} tone={card.tone} />
      ))}
    </div>
  );
}

function RecentTickets({ tickets }: { tickets: Ticket[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent tickets</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {tickets.length === 0 && (
          <p className="text-sm text-ink-muted">No tickets yet.</p>
        )}
        {tickets.map((ticket) => (
          <Link
            key={ticket.id}
            to={`/tickets/${ticket.id}`}
            className="block rounded-lg border border-border-soft p-3 transition-colors hover:bg-surface"
          >
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
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-sm text-ink-muted">Loading dashboard…</p>;
  }

  if (error || !data) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
      >
        {error ?? "Could not load the dashboard."}
      </div>
    );
  }

  const isTechnician = data.role === "TECHNICIAN";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Dashboard</h1>
          <p className="text-sm text-ink-muted">
            Welcome back, {user?.name} · {user?.roleLabel ?? ""}
          </p>
        </div>
        <Button asChild>
          <Link to="/tickets/new">
            <Plus /> New ticket
          </Link>
        </Button>
      </div>

      <StatCards totals={data.totals} />

      {data.totals.total === 0 ? (
        <div className="rounded-xl border border-dashed border-border-soft bg-surface p-10 text-center text-ink-muted">
          {isTechnician
            ? "No tickets have been created yet. Statistics will appear here."
            : "You haven't submitted any tickets yet. Create your first ticket to get IT support."}
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Tickets by status</CardTitle>
              </CardHeader>
              <CardContent>
                <StatusDonut data={data.byStatus} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tickets by priority</CardTitle>
              </CardHeader>
              <CardContent>
                <BarBreakdown
                  items={data.byPriority.map((p) => ({ name: p.priority, count: p.count }))}
                  colorFor={(name) => PRIORITY_COLORS[name as keyof typeof PRIORITY_COLORS]}
                />
              </CardContent>
            </Card>
          </div>

          {isTechnician && (
            <div className="grid gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>By category</CardTitle>
                </CardHeader>
                <CardContent>
                  <BarBreakdown items={data.byCategory} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>By department</CardTitle>
                </CardHeader>
                <CardContent>
                  <BarBreakdown items={data.byDepartment} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Technician workload</CardTitle>
                </CardHeader>
                <CardContent>
                  <BarBreakdown items={data.byTechnician} />
                </CardContent>
              </Card>
            </div>
          )}

          {data.recent.length > 0 && <RecentTickets tickets={data.recent} />}
        </>
      )}
    </div>
  );
}
