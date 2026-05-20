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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Trash</h1>
        <p className="mt-1 text-sm text-gray-500">
          Soft-deleted projects, restorable.
        </p>
      </div>

      {!result.ok && <DbDownBanner message={result.error} />}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-subtle text-left text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Status when deleted</th>
              <th className="px-3 py-2">Champion</th>
              <th className="px-3 py-2">Deleted</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {result.ok && result.value.length > 0 ? (
              result.value.map((p) => (
                <tr key={p.id} className="border-t border-surface-border">
                  <td className="px-3 py-2 font-medium">{p.title}</td>
                  <td className="px-3 py-2">{p.status}</td>
                  <td className="px-3 py-2">{p.actorName ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-500">
                    {formatDate(p.deletedAt, "long")}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <TrashRestoreButton id={p.id} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-12 text-center text-gray-500"
                >
                  Trash is empty.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
