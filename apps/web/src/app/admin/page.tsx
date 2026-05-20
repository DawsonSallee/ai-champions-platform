import Link from "next/link";
import { db } from "@/db/client";
import {
  businessUnits,
  projects,
  reviewerRoles,
  tierReviewMatrix,
  userReviewerRoles,
  userRoles,
  users,
} from "@/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { safe } from "@/lib/safe-query";
import { DbDownBanner } from "@/components/DbDownBanner";
import { TierMatrixEditor } from "@/components/TierMatrixEditor";
import { reviewerRoleLabel } from "@/lib/display";

export const dynamic = "force-dynamic";

const CHAMPIONS_GROUP_URL = process.env.CHAMPIONS_GROUP_URL ?? "";

export default async function AdminPage() {
  const data = await safe(async () => {
    const matrixRows = await db
      .select({
        tier: tierReviewMatrix.tier,
        roleCode: tierReviewMatrix.reviewerRoleCode,
        roleName: reviewerRoles.displayName,
        required: tierReviewMatrix.required,
        sla: tierReviewMatrix.slaBusinessDays,
      })
      .from(tierReviewMatrix)
      .innerJoin(
        reviewerRoles,
        eq(reviewerRoles.code, tierReviewMatrix.reviewerRoleCode),
      );

    const holders = await db
      .select({
        roleCode: userReviewerRoles.reviewerRoleCode,
        roleName: reviewerRoles.displayName,
        userName: users.displayName,
        userEmail: users.email,
      })
      .from(userReviewerRoles)
      .innerJoin(users, eq(users.id, userReviewerRoles.userId))
      .innerJoin(
        reviewerRoles,
        eq(reviewerRoles.code, userReviewerRoles.reviewerRoleCode),
      );

    const roles = await db.select().from(reviewerRoles);

    // Champions = users holding the Champion app role.
    const championRows = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        email: users.email,
        active: users.active,
        buCode: businessUnits.code,
        buName: businessUnits.displayName,
        activeCount: sql<number>`coalesce(sum(case when ${projects.status} not in ('Completed','Rejected','Decommissioned','NewIdea') then 1 else 0 end)::int, 0)`,
        completedCount: sql<number>`coalesce(sum(case when ${projects.status} = 'Completed' then 1 else 0 end)::int, 0)`,
      })
      .from(users)
      .innerJoin(
        userRoles,
        and(eq(userRoles.userId, users.id), eq(userRoles.roleCode, "Champion")),
      )
      .leftJoin(businessUnits, eq(businessUnits.id, users.businessUnitId))
      .leftJoin(
        projects,
        and(
          eq(projects.championUserId, users.id),
          isNull(projects.deletedAt),
        ),
      )
      .groupBy(
        users.id,
        users.displayName,
        users.email,
        users.active,
        businessUnits.code,
        businessUnits.displayName,
      )
      .orderBy(users.displayName);

    return { matrixRows, holders, roles, championRows };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <div className="flex flex-wrap gap-2">
          {CHAMPIONS_GROUP_URL && (
            <a
              href={CHAMPIONS_GROUP_URL}
              target="_blank"
              rel="noreferrer"
              className="btn"
            >
              Microsoft Group ↗
            </a>
          )}
          <Link href="/admin/audit" className="btn">
            Audit log
          </Link>
          <Link href="/admin/trash" className="btn">
            Trash
          </Link>
        </div>
      </div>

      {!data.ok && <DbDownBanner message={data.error} />}

      {data.ok && (
        <>
          <ChampionsSection champions={data.value.championRows} />
          <ApprovalsConfigSection
            matrixRows={data.value.matrixRows}
            holders={data.value.holders}
            reviewerRoles={data.value.roles}
          />
        </>
      )}
    </div>
  );
}

function ChampionsSection({
  champions,
}: {
  champions: Array<{
    id: string;
    displayName: string;
    email: string;
    active: boolean;
    buCode: string | null;
    buName: string | null;
    activeCount: number;
    completedCount: number;
  }>;
}) {
  const totalActive = champions.reduce((acc, c) => acc + c.activeCount, 0);
  const totalCompleted = champions.reduce(
    (acc, c) => acc + c.completedCount,
    0,
  );

  return (
    <section className="card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border bg-surface-subtle px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Champions</h2>
          <div className="text-xs text-gray-500">
            {champions.length} active · {totalActive} in-flight projects ·{" "}
            {totalCompleted} completed
          </div>
        </div>
        {CHAMPIONS_GROUP_URL && (
          <a
            href={CHAMPIONS_GROUP_URL}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-brand hover:underline"
          >
            Manage in Microsoft Group ↗
          </a>
        )}
      </header>
      {champions.length === 0 ? (
        <div className="p-8 text-center text-sm text-gray-500">
          No champions yet. Assign the Champion app role to users in Entra ID.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-5 py-2">Champion</th>
              <th className="px-5 py-2">Business unit</th>
              <th className="px-5 py-2 text-right">Active</th>
              <th className="px-5 py-2 text-right">Completed</th>
              <th className="px-5 py-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {champions.map((c) => (
              <tr key={c.id} className="border-t border-surface-border">
                <td className="px-5 py-2">
                  <div className="font-medium text-gray-900">{c.displayName}</div>
                  <a
                    href={`mailto:${c.email}`}
                    className="text-xs text-gray-500 hover:underline"
                  >
                    {c.email}
                  </a>
                </td>
                <td className="px-5 py-2 text-gray-700">{c.buName ?? "—"}</td>
                <td className="px-5 py-2 text-right tabular-nums">
                  {c.activeCount}
                </td>
                <td className="px-5 py-2 text-right tabular-nums">
                  {c.completedCount}
                </td>
                <td className="px-5 py-2 text-right">
                  <span
                    className={`pill ${
                      c.active
                        ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {c.active ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function ApprovalsConfigSection({
  matrixRows,
  holders,
  reviewerRoles,
}: {
  matrixRows: Array<{
    tier: "1A" | "1B" | "1C" | "2" | "3";
    roleCode: string;
    roleName: string;
    required: boolean;
    sla: number;
  }>;
  holders: Array<{
    roleCode: string;
    roleName: string;
    userName: string;
    userEmail: string;
  }>;
  reviewerRoles: { code: string; displayName: string }[];
}) {
  // Friendly display names for the matrix.
  const friendlyMatrix = matrixRows.map((r) => ({
    ...r,
    roleName: reviewerRoleLabel(r.roleCode),
  }));
  const friendlyHolders = holders.map((h) => ({
    ...h,
    roleName: reviewerRoleLabel(h.roleCode),
  }));
  const friendlyRoles = reviewerRoles.map((r) => ({
    ...r,
    displayName: reviewerRoleLabel(r.code),
  }));

  return (
    <section className="card">
      <header className="border-b border-surface-border bg-surface-subtle px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-900">
          Approvals configuration
        </h2>
        <div className="text-xs text-gray-500">
          Which reviewer roles are required at which tier, and who fills those
          roles. Edit here to change personnel.
        </div>
      </header>
      <div className="p-5">
        <TierMatrixEditor
          rows={friendlyMatrix}
          reviewerRoles={friendlyRoles}
          holders={friendlyHolders}
        />
      </div>
    </section>
  );
}
