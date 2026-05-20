/**
 * One-shot local dev launcher: migrates + seeds + starts Next.
 *
 * Uses the embedded PGlite database — no Docker, no Postgres install.
 * Data persists in `.pgdata/` under the repo. Delete that directory to
 * reset.
 *
 *   npm run dev:embedded
 */
import { spawn } from "node:child_process";

process.env.USE_PGLITE ??= "true";
process.env.PGLITE_DATA_DIR ??= ".pgdata";
process.env.DEV_AUTH_BYPASS ??= "true";

async function run(cmd: string, args: string[]) {
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
  console.log("► Embedded dev: migrating PGlite…");
  await run("npx", ["tsx", "apps/web/src/db/migrate.ts"]);

  console.log("► Embedded dev: seeding…");
  await run("npx", ["tsx", "apps/web/src/db/seed/index.ts"]);

  console.log("► Embedded dev: starting Next on http://localhost:3000 …");
  await run("npx", ["next", "dev", "apps/web"]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
