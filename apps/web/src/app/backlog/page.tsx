import Link from "next/link";
import { listProjects } from "@/domains/projects/service";
import { safe } from "@/lib/safe-query";
import { DbDownBanner } from "@/components/DbDownBanner";
import { BacklogTable } from "@/components/BacklogTable";
import { db } from "@/db/client";
import { roiCalculations } from "@/db/schema";
import { desc, isNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function BacklogPage() {
  const projects = await safe(() => listProjects());
  const rois = await safe(async () => {
    const rows = await db
      .select()
      .from(roiCalculations)
      .where(isNull(roiCalculations.deletedAt))
      .orderBy(desc(roiCalculations.createdAt));
    const latest = new Map<string, number>();
    for (const r of rows) {
      if (!latest.has(r.projectId)) {
        latest.set(r.projectId, Number(r.computedAnnualSavingsUsd ?? 0));
      }
    }
    return latest;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Backlog</h1>
        <div className="flex gap-2">
          <Link href="/api/export/projects.csv" className="btn">
            CSV
          </Link>
          <Link href="/api/export/projects.xlsx" className="btn">
            XLSX
          </Link>
        </div>
      </div>

      {!projects.ok && <DbDownBanner message={projects.error} />}

      <BacklogTable
        rows={
          projects.ok
            ? projects.value.map((p) => ({
                id: p.id,
                title: p.title,
                businessUnitCode: p.businessUnitCode,
                complexityTier: p.complexityTier,
                status: p.status,
                championName: p.championName,
                updatedAt: p.updatedAt.toISOString(),
                annualSavingsUsd: rois.ok ? rois.value.get(p.id) ?? null : null,
              }))
            : []
        }
      />
    </div>
  );
}
