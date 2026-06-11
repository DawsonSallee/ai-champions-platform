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
      <header className="v3-page-header flex items-end justify-between" style={{ marginBottom: 0 }}>
        <h1 className="v3-headline">Backlog</h1>
        <div className="flex gap-2">
          <Link href="/api/export/projects.csv" className="v3-btn-outline v3-btn-sm">
            CSV
          </Link>
          <Link href="/api/export/projects.xlsx" className="v3-btn-outline v3-btn-sm">
            XLSX
          </Link>
        </div>
      </header>

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
