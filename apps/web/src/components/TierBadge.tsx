import { cn } from "@/lib/utils";
import type { Tier } from "@/domains/projects/schema";

const TIER_CLASS: Record<Tier, string> = {
  "1A": "bg-neutral-100 text-neutral-700 ring-1 ring-inset ring-neutral-200",
  "1B": "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  "1C": "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200",
  "2": "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  "3": "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
};

export function TierBadge({
  tier,
  className,
}: {
  tier: Tier | null | undefined;
  className?: string;
}) {
  if (!tier) {
    return (
      <span className={cn("pill bg-neutral-100 text-ink-soft", className)}>
        —
      </span>
    );
  }
  return (
    <span className={cn("pill", TIER_CLASS[tier], className)}>
      Tier {tier}
    </span>
  );
}
