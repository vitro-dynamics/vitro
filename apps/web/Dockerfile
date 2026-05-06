# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS pruner
RUN apk add --no-cache libc6-compat
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm dlx turbo@2 prune @app/web --docker

FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat
RUN corepack enable
WORKDIR /repo

COPY --from=pruner /repo/out/json/ ./
RUN pnpm install --frozen-lockfile

COPY --from=pruner /repo/out/full/ ./

# Vite reads VITE_* env at build time. Pass via --build-arg from Railway.
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

RUN pnpm --filter @app/web run build:docker

FROM caddy:2-alpine AS runtime
ENV PORT=8080
COPY --from=builder /repo/apps/web/dist /srv
COPY apps/web/Caddyfile /etc/caddy/Caddyfile
EXPOSE 8080
