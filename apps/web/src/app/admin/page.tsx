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
      <header className="v3-page-header flex flex-wrap items-end justify-between gap-3" style={{ marginBottom: 0 }}>
        <h1 className="v3-headline">Admin</h1>
        <div className="flex flex-wrap gap-2">
          {CHAMPIONS_GROUP_URL && (
            <a
              href={CHAMPIONS_GROUP_URL}
              target="_blank"
              rel="noreferrer"
              className="v3-btn-outline v3-btn-sm"
            >
              Microsoft Group ↗
            </a>
          )}
          <Link href="/admin/audit" className="v3-btn-outline v3-btn-sm">
            Audit log
          </Link>
          <Link href="/admin/trash" className="v3-btn-outline v3-btn-sm">
            Trash
          </Link>
        </div>
      </header>

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
    <section className="v3-card" style={{ overflow: "hidden" }}>
      <header
        className="flex flex-wrap items-center justify-between gap-3"
        style={{
          borderBottom: "1px solid var(--hairline)",
          background: "var(--bg-sunken)",
          padding: "12px 20px",
        }}
      >
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>Champions</h2>
          <div className="v3-muted" style={{ fontSize: 12 }}>
            {champions.length} active · {totalActive} in-flight projects ·{" "}
            {totalCompleted} completed
          </div>
        </div>
        {CHAMPIONS_GROUP_URL && (
          <a
            href={CHAMPIONS_GROUP_URL}
            target="_blank"
            rel="noreferrer"
            className="link"
            style={{ fontSize: 12 }}
          >
            Manage in Microsoft Group ↗
          </a>
        )}
      </header>
      {champions.length === 0 ? (
        <div className="v3-muted" style={{ padding: 32, textAlign: "center", fontSize: 13 }}>
          No champions yet. Assign the Champion app role to users in Entra ID.
        </div>
      ) : (
        <table className="v3-data-table">
          <thead>
            <tr>
              <th>Champion</th>
              <th>Business unit</th>
              <th className="r">Active</th>
              <th className="r">Completed</th>
              <th className="r">Status</th>
            </tr>
          </thead>
          <tbody>
            {champions.map((c) => (
              <tr key={c.id}>
                <td data-label="Champion">
                  <div className="v3-row-title">{c.displayName}</div>
                  <a href={`mailto:${c.email}`} className="v3-row-sub" style={{ textDecoration: "none" }}>
                    {c.email}
                  </a>
                </td>
                <td data-label="Business unit">{c.buName ?? "—"}</td>
                <td data-label="Active" className="r">
                  {c.activeCount}
                </td>
                <td data-label="Completed" className="r">
                  {c.completedCount}
                </td>
                <td data-label="Status" className="r">
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
    <section className="v3-card" style={{ overflow: "hidden" }}>
      <header
        style={{
          borderBottom: "1px solid var(--hairline)",
          background: "var(--bg-sunken)",
          padding: "12px 20px",
        }}
      >
        <h2 style={{ fontSize: 15, fontWeight: 600 }}>Approvals configuration</h2>
        <div className="v3-muted" style={{ fontSize: 12 }}>
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
