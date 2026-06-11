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
      <header className="v3-page-header flex items-end justify-between" style={{ marginBottom: 0 }}>
        <h1 className="v3-headline">App Store</h1>
        <div className="v3-muted mono" style={{ fontSize: 12 }}>
          {result.ok ? result.value.length : 0} live solutions
        </div>
      </header>

      {!result.ok && <DbDownBanner message={result.error} />}

      {result.ok && result.value.length === 0 ? (
        <div className="v3-empty">
          <div className="icon">⚇</div>
          <div className="msg">No completed solutions yet</div>
          <div className="sub">Projects appear here once they reach Completed.</div>
        </div>
      ) : (
        <div className="v3-sources-grid">
          {result.ok &&
            result.value.map(({ project, buCode, annualSavingsUsd }) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="v3-source-card"
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <div className="flex items-start justify-between">
                  <div
                    className="grid place-items-center"
                    style={{
                      height: 40,
                      width: 40,
                      borderRadius: 8,
                      background: "var(--a)",
                      color: "var(--a-fg)",
                      fontSize: 18,
                      fontWeight: 700,
                    }}
                  >
                    {project.title.slice(0, 1)}
                  </div>
                  <TierBadge tier={project.complexityTier} />
                </div>
                <div>
                  <div className="name">{project.title}</div>
                  <p className="desc line-clamp-3">
                    {project.summaryPitch ?? project.problemStatement ?? ""}
                  </p>
                </div>
                <div
                  className="meta"
                  style={{
                    marginTop: "auto",
                    borderTop: "1px solid var(--hairline)",
                    paddingTop: 12,
                  }}
                >
                  <span>{buCode ?? "—"}</span>
                  {annualSavingsUsd ? (
                    <span className="mono" style={{ color: "var(--ink)", fontWeight: 600 }}>
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
