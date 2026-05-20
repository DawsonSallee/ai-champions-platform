# syntax=docker/dockerfile:1.7

# ── 1. deps — install only what's needed to build, with cache mounts ──────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# ── 2. builder — compile Next.js with standalone output ───────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx next build apps/web

# ── 3. runner — minimal runtime image ─────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Bring over the standalone bundle + static + public.
# Next packages the standalone server at <buildRoot>/.next/standalone.
# With monorepo (apps/web), it lives at apps/web/.next/standalone/.
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

# Copy migrations and the tsx/migrate scripts so we can run them at startup.
COPY --from=builder /app/apps/web/src/db/migrations ./apps/web/src/db/migrations
COPY --from=builder /app/apps/web/src/db/migrate.ts ./apps/web/src/db/migrate.ts
COPY --from=builder /app/apps/web/src/db/seed/bootstrap.ts ./apps/web/src/db/seed/bootstrap.ts

# Include drizzle-orm + postgres + tsx for the migration step (won't ship in
# standalone by default since they're only used by scripts, not by pages).
COPY --from=deps /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=deps /app/node_modules/postgres ./node_modules/postgres
COPY --from=deps /app/node_modules/tsx ./node_modules/tsx
COPY --from=deps /app/node_modules/esbuild ./node_modules/esbuild
COPY --from=deps /app/node_modules/get-tsconfig ./node_modules/get-tsconfig
COPY --from=deps /app/node_modules/resolve-pkg-maps ./node_modules/resolve-pkg-maps

EXPOSE 3000

# A tiny startup script: run migrations then start the server.
RUN printf '#!/bin/sh\nset -e\necho "[startup] running migrations…"\nnpx tsx apps/web/src/db/migrate.ts\necho "[startup] starting server on :${PORT}"\nexec node apps/web/server.js\n' > /app/start.sh && chmod +x /app/start.sh

CMD ["/app/start.sh"]
