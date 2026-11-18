import { useState } from "react";
import { cn } from "@/lib/utils";
import type { StatusCount, TicketPriority, TicketStatus } from "@/types";

export const STATUS_COLORS: Record<TicketStatus, string> = {
  OPEN: "#06b6d4",
  IN_PROGRESS: "#f59e0b",
  RESOLVED: "#22c55e",
  CLOSED: "#64748b",
};

export const PRIORITY_COLORS: Record<TicketPriority, string> = {
  LOW: "#64748b",
  MEDIUM: "#3b82f6",
  HIGH: "#f97316",
  URGENT: "#ef4444",
};

const toneStyles = {
  primary: "bg-primary-soft text-primary",
  cyan: "bg-cyan-50 text-cyan-700",
  amber: "bg-amber-50 text-amber-700",
  green: "bg-green-50 text-green-700",
  slate: "bg-slate-100 text-slate-600",
} as const;

export type StatTone = keyof typeof toneStyles;

export function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: StatTone;
}) {
  return (
    <div className={cn("rounded-xl px-4 py-3", toneStyles[tone])}>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs font-medium">{label}</div>
    </div>
  );
}

const DONUT_SIZE = 160;
const STROKE_WIDTH = 18;
const RADIUS = (DONUT_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function StatusDonut({ data }: { data: StatusCount[] }) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const visible = data.filter((item) => item.count > 0);
  const [active, setActive] = useState<TicketStatus | null>(null);

  const activeItem = active ? data.find((item) => item.status === active) : undefined;
  const centerLabel = activeItem ? activeItem.status.replace("_", " ") : "Total";
  const centerValue = activeItem ? activeItem.count : total;

  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <svg
        width={DONUT_SIZE}
        height={DONUT_SIZE}
        viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}
        role="img"
        aria-label={`Ticket status breakdown: ${total} total`}
        className="shrink-0"
      >
        <g transform={`rotate(-90 ${DONUT_SIZE / 2} ${DONUT_SIZE / 2})`}>
          <circle
            cx={DONUT_SIZE / 2}
            cy={DONUT_SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--mts-border)"
            strokeWidth={STROKE_WIDTH}
          />
          {total > 0 &&
            visible.map((item) => {
              const length = (item.count / total) * CIRCUMFERENCE;
              const segment = (
                <circle
                  key={item.status}
                  cx={DONUT_SIZE / 2}
                  cy={DONUT_SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke={STATUS_COLORS[item.status]}
                  strokeWidth={STROKE_WIDTH}
                  strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += length;
              return segment;
            })}
        </g>
        <text
          x={DONUT_SIZE / 2}
          y={DONUT_SIZE / 2 - 6}
          textAnchor="middle"
          className="fill-[color:var(--mts-ink)]"
          style={{ fontSize: 26, fontWeight: 700 }}
        >
          {centerValue}
        </text>
        <text
          x={DONUT_SIZE / 2}
          y={DONUT_SIZE / 2 + 14}
          textAnchor="middle"
          className="fill-[color:var(--mts-ink-muted)]"
          style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}
        >
          {centerLabel}
        </text>
      </svg>

      <ul className="w-full space-y-2 sm:flex-1">
        {data.map((item) => (
          <li key={item.status}>
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
                active === item.status ? "bg-surface" : "hover:bg-surface"
              )}
              onMouseEnter={() => setActive(item.status)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(item.status)}
              onBlur={() => setActive(null)}
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: STATUS_COLORS[item.status] }}
              />
              <span className="flex-1 text-sm text-ink">{item.status.replace("_", " ")}</span>
              <span className="text-sm font-medium tabular-nums text-ink">{item.count}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BarBreakdown({
  items,
  colorFor,
}: {
  items: { name: string; count: number }[];
  colorFor?: (name: string) => string;
}) {
  const max = Math.max(1, ...items.map((item) => item.count));

  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-ink-muted">No data available yet.</p>
    );
  }

  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div key={item.name} className="flex items-center gap-3">
          <span className="w-32 shrink-0 truncate text-sm text-ink" title={item.name}>
            {item.name}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface ring-1 ring-inset ring-border-soft">
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{
                width: `${(item.count / max) * 100}%`,
                backgroundColor: colorFor?.(item.name) ?? "var(--mts-primary)",
              }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-sm font-medium tabular-nums text-ink">
            {item.count}
          </span>
        </div>
      ))}
    </div>
  );
}
