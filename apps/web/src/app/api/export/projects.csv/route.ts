import { listProjects } from "@/domains/projects/service";
import { toCsv } from "@/lib/export";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await listProjects();
  const csv = toCsv(
    rows.map((p) => ({
      id: p.id,
      title: p.title,
      business_unit: p.businessUnitCode ?? "",
      tier: p.complexityTier ?? "",
      status: p.status,
      champion: p.championName ?? "",
      implementation_date: p.implementationDate ?? "",
      updated_at: p.updatedAt.toISOString(),
    })),
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="projects-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
