import { listProjects } from "@/domains/projects/service";
import { toXlsxBuffer } from "@/lib/export";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await listProjects();
  const buf = toXlsxBuffer(
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
    "Projects",
  );
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="projects-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
