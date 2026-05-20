import { reviewerRoleLabel, approvalStatusLabel } from "@/lib/display";
import { formatDate } from "@/lib/dates";

type Approval = {
  id: string;
  reviewerRoleCode: string;
  status: "Pending" | "Approved" | "ChangesRequested" | "Rejected";
  slaDueAt: Date | string | null;
  decidedAt: Date | string | null;
  reviewerName?: string | null;
};

export function ApprovalProgress({
  approvals,
  showReviewerName = true,
}: {
  approvals: Approval[];
  showReviewerName?: boolean;
}) {
  if (approvals.length === 0) {
    return (
      <div className="text-sm text-gray-500">No approvals required.</div>
    );
  }
  return (
    <ol className="flex flex-wrap items-stretch gap-1">
      {approvals.map((a, i) => {
        const overdue =
          a.status === "Pending" &&
          a.slaDueAt &&
          new Date(a.slaDueAt).getTime() < Date.now();
        const tone = toneFor(a.status, !!overdue);
        return (
          <li
            key={a.id}
            className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${tone.bg} ${tone.border}`}
          >
            <StatusGlyph status={a.status} overdue={!!overdue} />
            <div className="leading-tight">
              <div className={`font-medium ${tone.text}`}>
                {reviewerRoleLabel(a.reviewerRoleCode)}
              </div>
              <div className="text-[11px] text-gray-600">
                {showReviewerName && a.reviewerName ? `${a.reviewerName} · ` : ""}
                {a.status === "Pending"
                  ? overdue
                    ? `Overdue — was due ${formatDate(a.slaDueAt)}`
                    : `Due ${formatDate(a.slaDueAt)}`
                  : `${approvalStatusLabel(a.status)} · ${formatDate(a.decidedAt)}`}
              </div>
            </div>
            {i < approvals.length - 1 && (
              <span className="ml-1 text-gray-300">›</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function StatusGlyph({
  status,
  overdue,
}: {
  status: Approval["status"];
  overdue: boolean;
}) {
  if (status === "Approved")
    return <span className="text-green-600">✓</span>;
  if (status === "Rejected")
    return <span className="text-red-600">✕</span>;
  if (status === "ChangesRequested")
    return <span className="text-amber-600">!</span>;
  return (
    <span className={overdue ? "text-red-500" : "text-gray-400"}>○</span>
  );
}

function toneFor(status: Approval["status"], overdue: boolean) {
  if (status === "Approved")
    return {
      bg: "bg-green-50",
      border: "border-green-200",
      text: "text-green-800",
    };
  if (status === "Rejected")
    return { bg: "bg-red-50", border: "border-red-200", text: "text-red-800" };
  if (status === "ChangesRequested")
    return {
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-800",
    };
  if (overdue)
    return { bg: "bg-red-50", border: "border-red-200", text: "text-red-800" };
  return {
    bg: "bg-surface-subtle",
    border: "border-surface-border",
    text: "text-gray-800",
  };
}
