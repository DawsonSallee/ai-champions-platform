/**
 * Daily SLA breach checker.
 *
 * Finds approvals where status=Pending and slaDueAt < now, then
 * emails the reviewer + escalation contact.
 *
 * Run via Container Apps Job daily.
 */
import { db } from "../apps/web/src/db/client";
import { approvals, projects, users } from "../apps/web/src/db/schema";
import { and, eq, isNull, lt } from "drizzle-orm";
import { getEmail } from "../apps/web/src/lib/email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const ESCALATION = (process.env.SLA_ESCALATION_CC ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

async function main() {
  const overdue = await db
    .select({
      approval: approvals,
      project: projects,
      reviewer: users,
    })
    .from(approvals)
    .innerJoin(projects, eq(projects.id, approvals.projectId))
    .leftJoin(users, eq(users.id, approvals.reviewerUserId))
    .where(
      and(
        eq(approvals.status, "Pending"),
        lt(approvals.slaDueAt, new Date()),
        isNull(projects.deletedAt),
      ),
    );

  if (overdue.length === 0) {
    console.log("No SLA breaches.");
    process.exit(0);
  }

  const email = getEmail();
  for (const o of overdue) {
    const to = o.reviewer?.email ?? null;
    if (!to) {
      console.log(`⚠ ${o.project.title}: reviewer unassigned — skipping`);
      continue;
    }
    await email.send({
      to: [to],
      cc: ESCALATION.length > 0 ? ESCALATION : undefined,
      subject: `[SLA breach] ${o.project.title} — ${o.approval.reviewerRoleCode}`,
      html: `
        <p>This review has missed its SLA.</p>
        <p>
          <a href="${APP_URL}/projects/${o.project.id}?tab=approvals">
            ${o.project.title}
          </a> — ${o.approval.reviewerRoleCode} —
          due ${o.approval.slaDueAt?.toISOString()}
        </p>
      `,
    });
  }

  console.log(`✅ Notified ${overdue.length} overdue approval(s)`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
