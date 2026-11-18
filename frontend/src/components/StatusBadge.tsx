import { cn } from "@/lib/utils";
import type { TicketStatus } from "@/types";

const statusStyles: Record<TicketStatus, string> = {
  OPEN: "bg-cyan-50 text-cyan-700 border-cyan-200",
  IN_PROGRESS: "bg-amber-50 text-amber-700 border-amber-200",
  RESOLVED: "bg-green-50 text-green-700 border-green-200",
  CLOSED: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        statusStyles[status]
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}
