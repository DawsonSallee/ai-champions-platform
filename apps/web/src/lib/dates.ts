/**
 * Business-day arithmetic — used by approval SLA timers.
 * "Business day" = Mon–Fri. Holidays are not modeled in MVP;
 * an admin-configurable holiday calendar can be added later.
 */
export function addBusinessDays(start: Date, days: number): Date {
  const out = new Date(start.getTime());
  let added = 0;
  while (added < days) {
    out.setUTCDate(out.getUTCDate() + 1);
    const dow = out.getUTCDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return out;
}

export function isPast(date: Date | null | undefined, now = new Date()): boolean {
  if (!date) return false;
  return date.getTime() < now.getTime();
}

export function formatDate(
  date: Date | string | null | undefined,
  fmt: "short" | "long" = "short",
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  if (fmt === "long") {
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  return d.toISOString().slice(0, 10);
}
