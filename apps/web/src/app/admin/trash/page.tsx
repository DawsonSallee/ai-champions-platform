import { db } from "@/db/client";
import { projects, users } from "@/db/schema";
import { eq, isNotNull, desc } from "drizzle-orm";
import { safe } from "@/lib/safe-query";
import { DbDownBanner } from "@/components/DbDownBanner";
import { TrashRestoreButton } from "./TrashRestoreButton";
import { formatDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function TrashPage() {
  const result = await safe(async () => {
    return await db
      .select({
        id: projects.id,
        title: projects.title,
        status: projects.status,
        deletedAt: projects.deletedAt,
        actorName: users.displayName,
      })
      .from(projects)
      .leftJoin(users, eq(users.id, projects.championUserId))
      .where(isNotNull(projects.deletedAt))
      .orderBy(desc(projects.deletedAt));
  });

  return (
    <div className="space-y-6">
      <header className="v3-page-header" style={{ marginBottom: 0 }}>
        <h1 className="v3-headline">Trash</h1>
        <p className="v3-subhead">Soft-deleted projects, restorable.</p>
      </header>

      {!result.ok && <DbDownBanner message={result.error} />}

      <div className="v3-card" style={{ overflow: "hidden" }}>
        <table className="v3-data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status when deleted</th>
              <th>Champion</th>
              <th>Deleted</th>
              <th className="r"></th>
            </tr>
          </thead>
          <tbody>
            {result.ok && result.value.length > 0 ? (
              result.value.map((p) => (
                <tr key={p.id}>
                  <td data-label="Title">
                    <span className="v3-row-title">{p.title}</span>
                  </td>
                  <td data-label="Status">{p.status}</td>
                  <td data-label="Champion">{p.actorName ?? "—"}</td>
                  <td data-label="Deleted" className="v3-muted">
                    {formatDate(p.deletedAt, "long")}
                  </td>
                  <td data-label="" className="r">
                    <TrashRestoreButton id={p.id} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>
                  <div className="v3-muted" style={{ padding: "48px 0", textAlign: "center", fontSize: 13 }}>
                    Trash is empty.
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
