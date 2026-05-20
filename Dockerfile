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

EXPOSE 3000

# Migrations are run by CI (the deploy workflow has a `Bootstrap` step that
# applies them against the live Postgres before traffic shifts to the new
# revision). The container just runs the server.
CMD ["node", "apps/web/server.js"]
