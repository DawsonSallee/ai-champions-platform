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
      <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>

      {!result.ok && <DbDownBanner message={result.error} />}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-subtle text-left text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Entity</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Before → After (excerpt)</th>
            </tr>
          </thead>
          <tbody>
            {result.ok && result.value.length > 0 ? (
              result.value.map((r) => (
                <tr key={r.e.id} className="border-t border-surface-border align-top">
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                    {formatDate(r.e.occurredAt, "long")}
                  </td>
                  <td className="px-3 py-2">
                    {r.actorName ?? r.actorEmail ?? "system"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.e.entityType}</div>
                    <div className="text-xs text-gray-500 font-mono">
                      {r.e.entityId}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className="pill bg-gray-100 text-gray-700">
                      {r.e.action}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    <pre className="whitespace-pre-wrap max-w-md">
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
                <td colSpan={5} className="px-3 py-12 text-center text-gray-500">
                  No events recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
