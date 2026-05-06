# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS pruner
RUN apk add --no-cache libc6-compat
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm dlx turbo@2 prune @app/api --docker

FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat
RUN corepack enable
WORKDIR /repo

COPY --from=pruner /repo/out/json/ ./
RUN pnpm install --frozen-lockfile

COPY --from=pruner /repo/out/full/ ./

RUN pnpm --filter @app/db generate
RUN pnpm --filter @app/api build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8000

RUN addgroup -S app && adduser -S app -G app

# Nitro server bundle (self-contained, no node_modules needed)
COPY --from=builder --chown=app:app /repo/apps/api/.output ./

# ── Migration tooling for Railway preDeployCommand ────────────────────────────
# prisma migrate deploy needs the CLI, schema, migrations, and config.
# We install prisma + dotenv via npm to get a flat node_modules that works
# without pnpm's symlinked virtual store.
COPY --from=builder /repo/packages/db/prisma ./packages/db/prisma
COPY --from=builder /repo/packages/db/prisma.config.ts ./packages/db/prisma.config.ts
RUN cd packages/db && npm init -y && npm install --save-exact prisma@7 dotenv@16

USER app
EXPOSE 8000
CMD ["node", "server/index.mjs"]
