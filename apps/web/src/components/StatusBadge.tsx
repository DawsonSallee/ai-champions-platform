import { cn } from "@/lib/utils";
import { statusLabel } from "@/lib/display";
import type { ProjectStatus } from "@/domains/projects/schema";

const STATUS_CLASS: Record<ProjectStatus, string> = {
  NewIdea: "bg-neutral-100 text-neutral-700 ring-1 ring-inset ring-neutral-200",
  IntakeSubmitted: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
  UnderReview: "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200",
  ITApprovalPending:
    "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  ITApproved: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  InProgress: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200",
  AITeamReview: "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200",
  Completed: "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200",
  Rejected: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
  Decommissioned:
    "bg-neutral-100 text-neutral-600 ring-1 ring-inset ring-neutral-200",
};

export function StatusBadge({
  status,
  className,
}: {
  status: ProjectStatus;
  className?: string;
}) {
  return (
    <span className={cn("pill", STATUS_CLASS[status], className)}>
      {statusLabel(status)}
    </span>
  );
}
