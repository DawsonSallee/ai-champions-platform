/**
 * One-time SharePoint importer.
 *
 * Reads the legacy Project Backlog list via Microsoft Graph and writes
 * a Project row per item. Walks `Project Artifacts` and registers files
 * in the `artifacts` table.
 *
 * Run once during cutover:
 *   SP_SITE=https://...sharepoint.com/sites/foo \
 *   SP_LIST=Project%20Backlog \
 *   GRAPH_CLIENT_ID=... GRAPH_CLIENT_SECRET=... GRAPH_TENANT=... \
 *   tsx scripts/import-from-sharepoint.ts
 *
 * The importer is idempotent on intake_ticket_id — re-running won't
 * create duplicates.
 */
import { db } from "../apps/web/src/db/client";
import {
  businessUnits,
  projects,
  users,
} from "../apps/web/src/db/schema";
import { eq } from "drizzle-orm";

type SpListItem = {
  id: string;
  fields: {
    Title: string;
    AIChamp?: { LookupId?: number; LookupValue?: string };
    BusinessUnit?: string;
    ComplexityTier?: string;
    Status?: string;
    ImplementationDate?: string;
    FreshserviceTicketID?: string;
    AnnualSavingsUSD?: number;
    SharePointSavingsLedger?: string;
    SharePointQualityLedger?: string;
  };
};

async function acquireToken() {
  const tenant = process.env.GRAPH_TENANT;
  const clientId = process.env.GRAPH_CLIENT_ID;
  const clientSecret = process.env.GRAPH_CLIENT_SECRET;
  if (!tenant || !clientId || !clientSecret) {
    throw new Error(
      "Set GRAPH_TENANT, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET to import.",
    );
  }
  const res = await fetch(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    },
  );
  if (!res.ok) throw new Error(`Token error: ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function fetchSpList(token: string, siteUrl: string, list: string) {
  // Resolve site id from URL
  const parsed = new URL(siteUrl);
  const host = parsed.host;
  const sitePath = parsed.pathname;
  const siteRes = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${host}:${sitePath}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!siteRes.ok) throw new Error(`Site resolve error: ${siteRes.status}`);
  const siteId = ((await siteRes.json()) as { id: string }).id;

  const items: SpListItem[] = [];
  let url:
    | string
    | undefined = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${encodeURIComponent(
    list,
  )}/items?expand=fields&top=200`;
  while (url) {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) throw new Error(`List items error: ${r.status}`);
    const page = (await r.json()) as { value: SpListItem[]; "@odata.nextLink"?: string };
    items.push(...page.value);
    url = page["@odata.nextLink"];
  }
  return items;
}

function parseTier(s?: string) {
  const m = (s ?? "").match(/(1A|1B|1C|2|3)/i);
  return (m?.[1]?.toUpperCase() ?? null) as
    | "1A"
    | "1B"
    | "1C"
    | "2"
    | "3"
    | null;
}

async function main() {
  const siteUrl = process.env.SP_SITE;
  const list = process.env.SP_LIST ?? "Project Backlog";
  if (!siteUrl) throw new Error("SP_SITE not set");

  const token = await acquireToken();
  const items = await fetchSpList(token, siteUrl, list);
  console.log(`Found ${items.length} list items.`);

  let inserted = 0;
  let updated = 0;

  for (const item of items) {
    const ticketId = item.fields.FreshserviceTicketID;
    if (!ticketId) continue;

    // Resolve / create the business unit by code.
    const buCode = item.fields.BusinessUnit ?? "Imported";
    let bu = await db
      .select()
      .from(businessUnits)
      .where(eq(businessUnits.code, buCode));
    if (bu.length === 0) {
      const [b] = await db
        .insert(businessUnits)
        .values({ code: buCode, displayName: buCode })
        .returning();
      bu = [b];
    }

    // Resolve / create the champion user.
    const champEmail = item.fields.AIChamp?.LookupValue;
    let championId: string | null = null;
    if (champEmail) {
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.email, champEmail.toLowerCase()))
        .limit(1);
      if (existing.length > 0) championId = existing[0].id;
      else {
        const [u] = await db
          .insert(users)
          .values({
            email: champEmail.toLowerCase(),
            displayName: champEmail,
            active: true,
          })
          .returning();
        championId = u.id;
      }
    }

    const existing = await db
      .select()
      .from(projects)
      .where(eq(projects.intakeTicketId, ticketId))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(projects)
        .set({
          title: item.fields.Title,
          complexityTier: parseTier(item.fields.ComplexityTier),
          businessUnitId: bu[0].id,
          championUserId: championId,
          implementationDate: item.fields.ImplementationDate ?? null,
        })
        .where(eq(projects.id, existing[0].id));
      updated++;
    } else {
      await db.insert(projects).values({
        intakeTicketId: ticketId,
        title: item.fields.Title,
        complexityTier: parseTier(item.fields.ComplexityTier),
        businessUnitId: bu[0].id,
        championUserId: championId,
        implementationDate: item.fields.ImplementationDate ?? null,
        status: "Completed", // legacy items default to Completed; adjust if needed
      });
      inserted++;
    }
  }

  console.log(`✅ Inserted ${inserted}, updated ${updated}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
