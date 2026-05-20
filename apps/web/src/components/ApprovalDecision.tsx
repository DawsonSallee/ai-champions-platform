"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideApprovalAction } from "@/domains/governance/actions";

export function ApprovalDecision({ approvalId }: { approvalId: string }) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function decide(decision: "Approved" | "ChangesRequested" | "Rejected") {
    setError(null);
    startTransition(async () => {
      const res = await decideApprovalAction({
        approvalId,
        decision,
        comment,
      });
      if (!res.ok) setError(res.error);
      else {
        setComment("");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-2">
      <textarea
        className="input"
        rows={2}
        placeholder="Optional comment (visible to the champion)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => decide("Approved")}
          disabled={pending}
          className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          onClick={() => decide("ChangesRequested")}
          disabled={pending}
          className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
        >
          Request changes
        </button>
        <button
          onClick={() => decide("Rejected")}
          disabled={pending}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          Reject
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
