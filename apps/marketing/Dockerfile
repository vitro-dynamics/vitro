# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS pruner
RUN apk add --no-cache libc6-compat
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm dlx turbo@2 prune @app/marketing --docker

FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat
RUN corepack enable
WORKDIR /repo

COPY --from=pruner /repo/out/json/ ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY --from=pruner /repo/out/full/ ./
RUN pnpm --filter @app/marketing build

FROM caddy:2-alpine AS runtime
COPY --from=builder /repo/apps/marketing/dist /srv
COPY apps/marketing/Caddyfile /etc/caddy/Caddyfile
EXPOSE 80
