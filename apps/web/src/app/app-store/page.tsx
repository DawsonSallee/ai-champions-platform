import Link from "next/link";
import { db } from "@/db/client";
import { businessUnits, projects, roiCalculations } from "@/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { safe } from "@/lib/safe-query";
import { DbDownBanner } from "@/components/DbDownBanner";
import { TierBadge } from "@/components/TierBadge";
import { formatUsd } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AppStorePage() {
  const result = await safe(async () => {
    const projectsRows = await db
      .select({
        project: projects,
        buCode: businessUnits.code,
      })
      .from(projects)
      .leftJoin(businessUnits, eq(businessUnits.id, projects.businessUnitId))
      .where(and(eq(projects.status, "Completed"), isNull(projects.deletedAt)));

    const rois = await db
      .select()
      .from(roiCalculations)
      .where(isNull(roiCalculations.deletedAt))
      .orderBy(desc(roiCalculations.createdAt));
    const latestSavings = new Map<string, number>();
    for (const r of rois) {
      if (!latestSavings.has(r.projectId))
        latestSavings.set(
          r.projectId,
          Number(r.computedAnnualSavingsUsd ?? 0),
        );
    }
    return projectsRows.map((r) => ({
      ...r,
      annualSavingsUsd: latestSavings.get(r.project.id) ?? null,
    }));
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">App Store</h1>
        <div className="text-xs text-gray-500">
          {result.ok ? result.value.length : 0} live solutions
        </div>
      </div>

      {!result.ok && <DbDownBanner message={result.error} />}

      {result.ok && result.value.length === 0 ? (
        <div className="card p-12 text-center text-sm text-gray-500">
          No completed solutions yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.ok &&
            result.value.map(({ project, buCode, annualSavingsUsd }) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="card flex flex-col gap-3 p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="h-10 w-10 rounded-md bg-brand text-brand-fg grid place-items-center text-lg font-bold">
                    {project.title.slice(0, 1)}
                  </div>
                  <TierBadge tier={project.complexityTier} />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">
                    {project.title}
                  </div>
                  <p className="mt-1 line-clamp-3 text-sm text-gray-600">
                    {project.summaryPitch ?? project.problemStatement ?? ""}
                  </p>
                </div>
                <div className="mt-auto flex items-center justify-between border-t border-surface-border pt-3 text-xs">
                  <span className="text-gray-500">{buCode ?? "—"}</span>
                  {annualSavingsUsd ? (
                    <span className="font-medium text-gray-900">
                      {formatUsd(annualSavingsUsd)}/yr
                    </span>
                  ) : null}
                </div>
              </Link>
            ))}
        </div>
      )}
    </div>
  );
}
