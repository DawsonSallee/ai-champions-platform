import { db } from "@/db/client";
import { auditEvents, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { safe } from "@/lib/safe-query";
import { DbDownBanner } from "@/components/DbDownBanner";
import { formatDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; limit?: string }>;
}) {
  const { entity, limit } = await searchParams;
  const take = Math.min(500, Number(limit) || 100);

  const result = await safe(async () => {
    const q = db
      .select({
        e: auditEvents,
        actorName: users.displayName,
        actorEmail: users.email,
      })
      .from(auditEvents)
      .leftJoin(users, eq(users.id, auditEvents.actorUserId))
      .orderBy(desc(auditEvents.occurredAt))
      .limit(take);

    return entity
      ? await q.where(eq(auditEvents.entityType, entity))
      : await q;
  });

  return (
    <div className="space-y-6">
      <header className="v3-page-header" style={{ marginBottom: 0 }}>
        <h1 className="v3-headline">Audit log</h1>
      </header>

      {!result.ok && <DbDownBanner message={result.error} />}

      <div className="v3-card" style={{ overflow: "hidden" }}>
        <table className="v3-data-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Entity</th>
              <th>Action</th>
              <th>Before → After (excerpt)</th>
            </tr>
          </thead>
          <tbody>
            {result.ok && result.value.length > 0 ? (
              result.value.map((r) => (
                <tr key={r.e.id} style={{ verticalAlign: "top" }}>
                  <td data-label="When" className="v3-muted" style={{ whiteSpace: "nowrap" }}>
                    {formatDate(r.e.occurredAt, "long")}
                  </td>
                  <td data-label="Actor">
                    {r.actorName ?? r.actorEmail ?? "system"}
                  </td>
                  <td data-label="Entity">
                    <div style={{ fontWeight: 500 }}>{r.e.entityType}</div>
                    <div className="v3-row-sub">{r.e.entityId}</div>
                  </td>
                  <td data-label="Action">
                    <span className="pill bg-gray-100 text-gray-700">
                      {r.e.action}
                    </span>
                  </td>
                  <td data-label="Diff" className="v3-muted" style={{ fontSize: 11 }}>
                    <pre className="mono whitespace-pre-wrap max-w-md">
                      {JSON.stringify(
                        {
                          before: r.e.beforeJson,
                          after: r.e.afterJson,
                        },
                        null,
                        2,
                      ).slice(0, 400)}
                    </pre>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>
                  <div className="v3-muted" style={{ padding: "48px 0", textAlign: "center", fontSize: 13 }}>
                    No events recorded yet.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
