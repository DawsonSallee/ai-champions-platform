/**
 * Showcase PDF endpoint.
 *
 * Renders a printable, leadership-friendly one-pager for the project
 * directly from the live data (no manual copy-paste).
 */
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import {
  businessUnits,
  projects,
  roiCalculations,
  users,
} from "@/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { renderShowcasePdf } from "@/domains/artifacts/pdf";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const realId = id.replace(/\.pdf$/, "");

  const [proj] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, realId), isNull(projects.deletedAt)));
  if (!proj) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [bu] = proj.businessUnitId
    ? await db
        .select()
        .from(businessUnits)
        .where(eq(businessUnits.id, proj.businessUnitId))
    : [];
  const [champion] = proj.championUserId
    ? await db.select().from(users).where(eq(users.id, proj.championUserId))
    : [];

  const [latestRoi] = await db
    .select()
    .from(roiCalculations)
    .where(
      and(
        eq(roiCalculations.projectId, realId),
        isNull(roiCalculations.deletedAt),
      ),
    )
    .orderBy(desc(roiCalculations.createdAt))
    .limit(1);

  const pdf = await renderShowcasePdf({
    title: proj.title,
    problemStatement: proj.problemStatement ?? "",
    tier: proj.complexityTier ?? "—",
    status: proj.status,
    businessUnit: bu?.displayName ?? "—",
    champion: champion?.displayName ?? "—",
    implementationDate: proj.implementationDate,
    annualSavedUsd: latestRoi
      ? Number(latestRoi.computedAnnualSavingsUsd ?? 0)
      : 0,
    annualSavedHours: latestRoi
      ? Number(latestRoi.computedAnnualSavingsHours ?? 0)
      : 0,
    annualQualityUsd: latestRoi
      ? Number(latestRoi.computedQualityValueUsd ?? 0)
      : 0,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${proj.title.replace(/[^a-zA-Z0-9]/g, "_")}-showcase.pdf"`,
    },
  });
}
