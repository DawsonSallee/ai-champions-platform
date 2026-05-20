/**
 * Database client.
 *
 * Two backends, switched by env:
 *  - postgres-js  (default)   — for real Postgres (Docker / Neon / Azure)
 *  - pglite       (embedded)  — when DATABASE_URL starts with `pglite://`
 *                                or USE_PGLITE=true. Stores data on disk
 *                                under .pgdata/ so it survives restarts.
 *                                Lets you run the whole app without
 *                                installing Postgres or Docker.
 */
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import postgres from "postgres";
import { PGlite } from "@electric-sql/pglite";
import path from "node:path";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "";
const usePglite =
  process.env.USE_PGLITE === "true" || url.startsWith("pglite://");

declare global {
  // eslint-disable-next-line no-var
  var __dbClient: unknown | undefined;
}

function buildClient() {
  if (usePglite) {
    const dataDir = url.startsWith("pglite://")
      ? url.replace(/^pglite:\/\//, "")
      : process.env.PGLITE_DATA_DIR ?? ".pgdata";
    const abs = path.isAbsolute(dataDir)
      ? dataDir
      : path.resolve(process.cwd(), dataDir);
    // eslint-disable-next-line no-console
    console.log(`[db] using embedded PGlite at ${abs}`);
    const client = new PGlite(abs);
    return { kind: "pglite" as const, db: drizzlePglite(client, { schema }), client };
  }

  const connectionString =
    url || "postgres://postgres:postgres@localhost:5432/ai_champions";
  const client = postgres(connectionString, { max: 10, prepare: false });
  return { kind: "pg" as const, db: drizzlePg(client, { schema }), client };
}

const cached =
  (global.__dbClient as ReturnType<typeof buildClient> | undefined) ??
  buildClient();
if (process.env.NODE_ENV !== "production") {
  global.__dbClient = cached;
}

export const db = cached.db;
export const dbKind = cached.kind;
export const rawClient = cached.client;
export type DB = typeof cached.db;
