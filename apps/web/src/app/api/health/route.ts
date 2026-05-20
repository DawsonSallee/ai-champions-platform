/**
 * Liveness / readiness probe.
 *
 * - App Service uses this to know when a new instance is warm enough to
 *   take traffic.
 * - Returns 200 if the app process is up. Includes a quick `select 1`
 *   against Postgres to confirm DB connectivity.
 */
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  try {
    const result = await db.execute(sql`select 1 as ok`);
    return NextResponse.json(
      {
        status: "ok",
        db: result ? "reachable" : "unknown",
        latencyMs: Date.now() - start,
        version: process.env.APP_VERSION ?? "dev",
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      {
        status: "degraded",
        db: "unreachable",
        error: err instanceof Error ? err.message : String(err),
        latencyMs: Date.now() - start,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
