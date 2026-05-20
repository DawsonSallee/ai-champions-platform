/**
 * Weekly Champion Nudge.
 *
 * Replaces the legacy Power Automate flow. Run on a schedule
 * (e.g. Mon 08:00 ET) via Container Apps Job / Azure Functions Timer:
 *
 *   tsx scripts/nudge-active-projects.ts
 *
 * Sends one email per champion summarizing their active projects with
 * direct deep links, and CCs the configured `NUDGE_CC` (e.g. program lead).
 */
import { db } from "../apps/web/src/db/client";
import {
  nudgeLog,
  projects,
  users,
} from "../apps/web/src/db/schema";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { getEmail } from "../apps/web/src/lib/email";
import { NUDGE_STATUSES } from "../apps/web/src/domains/governance/state-machine";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const CC = (process.env.NUDGE_CC ?? "").split(",").map((s) => s.trim()).filter(Boolean);

async function main() {
  console.log("🔔 Weekly nudge — building champion → projects map…");

  const rows = await db
    .select({ project: projects, champion: users })
    .from(projects)
    .innerJoin(users, eq(users.id, projects.championUserId))
    .where(
      and(
        inArray(projects.status, Array.from(NUDGE_STATUSES)),
        isNotNull(projects.championUserId),
        isNull(projects.deletedAt),
        eq(users.active, true),
      ),
    );

  const byChampion = new Map<
    string,
    {
      champion: typeof users.$inferSelect;
      items: (typeof projects.$inferSelect)[];
    }
  >();
  for (const r of rows) {
    const key = r.champion.id;
    if (!byChampion.has(key))
      byChampion.set(key, { champion: r.champion, items: [] });
    byChampion.get(key)!.items.push(r.project);
  }

  const email = getEmail();
  let sent = 0;

  for (const { champion, items } of byChampion.values()) {
    const html = renderNudgeHtml(champion, items);
    const result = await email.send({
      to: [champion.email],
      cc: CC.length > 0 ? CC : undefined,
      subject: `Weekly nudge: ${items.length} active AI Champions project${items.length === 1 ? "" : "s"}`,
      html,
    });
    if (result.ok) {
      sent++;
      for (const p of items) {
        await db.insert(nudgeLog).values({
          projectId: p.id,
          recipients: [champion.email, ...CC],
          bodyHtml: html.slice(0, 4000),
        });
      }
    } else {
      console.error(`❌ ${champion.email}: ${result.error}`);
    }
  }

  console.log(`✅ Nudges sent: ${sent}`);
  process.exit(0);
}

function renderNudgeHtml(
  champion: typeof users.$inferSelect,
  items: (typeof projects.$inferSelect)[],
) {
  const list = items
    .map((p) => {
      const days = Math.floor(
        (Date.now() - new Date(p.updatedAt).getTime()) /
          (24 * 60 * 60 * 1000),
      );
      return `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #e4e7eb;">
            <a href="${APP_URL}/projects/${p.id}" style="color:#0f3a8a;text-decoration:none;font-weight:600;">
              ${escape(p.title)}
            </a>
            <div style="color:#6b7280;font-size:12px;">
              ${p.status} · Tier ${p.complexityTier ?? "—"} · ${days} day${days === 1 ? "" : "s"} since last update
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;">
      <div style="background:#0f3a8a;color:#fff;padding:16px;border-radius:6px 6px 0 0;">
        <div style="font-size:14px;opacity:.8;">AI Champions Program</div>
        <div style="font-size:20px;font-weight:700;">Weekly nudge — ${escape(champion.displayName)}</div>
      </div>
      <div style="border:1px solid #e4e7eb;border-top:none;border-radius:0 0 6px 6px;background:#fff;padding:16px;">
        <p style="margin:0 0 12px;color:#374151;">
          You have <strong>${items.length}</strong> active project${items.length === 1 ? "" : "s"}.
          Click a title to update its status, log progress, or finalize ROI.
        </p>
        <table style="width:100%;border-collapse:collapse;">${list}</table>
        <p style="margin-top:16px;font-size:12px;color:#6b7280;">
          This nudge is sent every Monday until the project is Completed or Decommissioned.
        </p>
      </div>
    </div>
  `;
}

function escape(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
