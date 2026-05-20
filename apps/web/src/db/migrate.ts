import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { migrate as migratePg } from "drizzle-orm/postgres-js/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import postgres from "postgres";
import { PGlite } from "@electric-sql/pglite";
import path from "node:path";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const usePglite =
    process.env.USE_PGLITE === "true" || url.startsWith("pglite://");
  const migrationsFolder = "apps/web/src/db/migrations";

  if (usePglite) {
    const dataDir = url.startsWith("pglite://")
      ? url.replace(/^pglite:\/\//, "")
      : process.env.PGLITE_DATA_DIR ?? ".pgdata";
    const abs = path.isAbsolute(dataDir)
      ? dataDir
      : path.resolve(process.cwd(), dataDir);
    console.log(`Migrating embedded PGlite at ${abs}`);
    const client = new PGlite(abs);
    const db = drizzlePglite(client);
    await migratePglite(db, { migrationsFolder });
    await client.close();
  } else {
    const sql = postgres(
      url || "postgres://postgres:postgres@localhost:5432/ai_champions",
      { max: 1 },
    );
    const db = drizzlePg(sql);
    await migratePg(db, { migrationsFolder });
    await sql.end();
  }
  console.log("Migrations applied.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
