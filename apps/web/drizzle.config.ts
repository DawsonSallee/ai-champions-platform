import type { Config } from "drizzle-kit";

export default {
  schema: "./apps/web/src/db/schema/index.ts",
  out: "./apps/web/src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgres://postgres:postgres@localhost:5432/ai_champions",
  },
  verbose: true,
  strict: true,
} satisfies Config;
