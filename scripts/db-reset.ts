/**
 * Wipe the embedded PGlite database and re-migrate + re-seed.
 *
 *   npm run db:reset
 *
 * Useful after a schema change. Safe — only touches the local .pgdata
 * directory; never the configured Postgres URL.
 */
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

process.env.USE_PGLITE = "true";
process.env.PGLITE_DATA_DIR ??= ".pgdata";

const dataDir = path.resolve(
  process.cwd(),
  process.env.PGLITE_DATA_DIR ?? ".pgdata",
);

function run(cmd: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      env: process.env,
      shell: process.platform === "win32",
    });
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`)),
    );
  });
}

async function main() {
  console.log(`► Removing ${dataDir}`);
  rmSync(dataDir, { recursive: true, force: true });
  console.log("► Re-migrating…");
  await run("npx", ["tsx", "apps/web/src/db/migrate.ts"]);
  console.log("► Re-seeding…");
  await run("npx", ["tsx", "apps/web/src/db/seed/index.ts"]);
  console.log("✅ Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
