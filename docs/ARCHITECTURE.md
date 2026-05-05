# Architecture & Handoff Guide

A type-safe full-stack monorepo. This is the single source of truth — architecture, tools, per-package READMEs, per-app READMEs, conventions, and setup all live here (or link from here).

The guiding principle is: **ship the simplest thing that works, with deliberate upgrade paths for when scale demands more.** When you see deferred features (push notifications, custom autoscaler, BullMQ), they have defined trigger conditions in the [Upgrade paths](#upgrade-paths) table. Don't pre-build any of them.

---

## Stack at a glance

| Layer | Choice | Why |
|---|---|---|
| Repo | Turborepo + pnpm workspaces | Build orchestration, shared packages |
| API | Nitro + tRPC + Better Auth | One Node service, type-safe RPC, batteries-included auth |
| Validation | Arktype | Standard Schema, faster type-checks, string-DSL constraints |
| Database | Postgres + Prisma 7 (`prisma-client` generator, driver adapter) | ESM-first, Rust-free, smaller bundles |
| Frontend | Vite + React 19 + TanStack Router + TanStack Query | SPA with Suspense; no SSR complexity |
| UI | shadcn (Tailwind v4 era) + TweakCN theme | Component library + branded design tokens |
| Marketing | Astro, deployed separately | Static, SEO-perfect, isolated from app concerns |
| Real-time | SSE inside the API + Valkey pub/sub | Multi-replica safe from day one |
| Background work | Nitro tasks | Built-in, no queue infrastructure |
| Webhooks | Nitro routes that hand off to tasks | Verify, enqueue, return 200 fast |
| Logging | consola + thin wrapper | Pretty in dev, JSON in prod, tagged everywhere |
| Cache / pub-sub | Valkey (Redis-compatible) | SSE fanout across replicas, available for rate limiting / BullMQ |
| Local dev infra | Docker Compose (Postgres, Valkey, Mailpit) | App code runs natively; only deps in containers |
| Hosting | Railway with native autoscaling | Per-service `railway.json` + Dockerfile |
| CI quality gates | GitHub Actions (lint, typecheck, CodeQL, Trivy) | Block deploys via Railway "Wait for CI" |
| Deploys | Railway, branch-driven (dev / staging / production) | Promotion via GitHub release events |
| E2E | Playwright on `deployment_status` events | Same workflow runs against PR, dev, staging, prod |

---

## Repo structure

```
.
├── apps/
│   ├── api/                 Nitro server: tRPC + Better Auth + SSE + tasks + webhooks
│   ├── web/                 Vite SPA: TanStack Router + Query + tRPC client
│   ├── mobile/              Expo app: iOS/Android
│   └── marketing/           Astro: single landing page
├── packages/
│   ├── db/                  Prisma schema + generated client
│   ├── trpc/                Shared AppRouter type re-export
│   ├── logger/              consola wrapper with tagged loggers
│   └── ui/                  shadcn components + theme.css + utils
├── tooling/
│   ├── e2e/                 Playwright tests (run against any deployed env)
│   ├── infra/               Railway provisioning script (init.sh)
│   └── typescript/          @app/tsconfig — shared tsconfig presets
├── .github/workflows/
│   ├── pr.yml               Lint, typecheck, CodeQL, Trivy
│   ├── e2e.yml              Playwright on deployment_status events
│   └── release.yml          Promote tagged releases to staging / production
├── biome.json               Shared Biome config (root-level, no per-workspace overrides)
├── docker-compose.yml       Local infra: Postgres, Valkey, Mailpit
├── portless.json            Portless proxy config (app name → dev:app script mapping)
├── pnpm-workspace.yaml
├── turbo.json
├── package.json
└── docs/
    └── ARCHITECTURE.md      (this file)
```

`tooling/` holds dev infrastructure — nothing here is deployed or imported at runtime:
- `typescript/` is a shared config package consumed via `workspace:*` devDeps
- `infra/` is a shell script for Railway provisioning (run via `pnpm infra:init`)
- `e2e/` is Playwright tests run against deployed environments

Biome config lives at the repo root (`biome.json`). Run `pnpm lint` / `pnpm lint:fix` from the root.

Each deployable app (`api`, `web`, `marketing`) ships with its own `Dockerfile` and `railway.json` colocated.

---

## `packages/db` — Prisma 7

### Layout

```
packages/db/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── client.ts            singleton PrismaClient with pg adapter
│   └── index.ts             re-exports client + types
├── generated/               git-ignored, output of prisma generate
└── prisma.config.ts
```

### `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/client"
}

datasource db {
  provider = "postgresql"
}
// url lives in prisma.config.ts, not here (Prisma 7 requirement)
```

Better Auth models: `User`, `Session`, `Account`, `Verification`. Run `npx @better-auth/cli generate` to refresh them.

App models: `NotificationPreference`, `Notification`, `WebhookEvent`, `ConnectedAccount`.

### `src/client.ts`

```ts
import { PrismaClient } from "../generated/client/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

Never `new PrismaClient()` outside this package. One instance per process.

---

## `packages/trpc` — shared types

```ts
// packages/trpc/src/index.ts
export type { AppRouter } from "../../../apps/api/src/trpc/router";
```

`import type` only. This lets `apps/web` get full end-to-end type safety without ever bundling any of the API's runtime code (Nitro, Prisma, Better Auth server adapters). TypeScript erases it entirely at compile time.

---

## `packages/logger` — consola wrapper

Tagged loggers as the default. `createLogger("area:subarea")` is the entry point. Pretty CLI in dev, structured JSON in prod for log aggregation.

```ts
import { createLogger } from "@app/logger";
const log = createLogger("api:webhooks:stripe");
log.info("Webhook received", { type });
```

`LOG_LEVEL` env var controls verbosity. Default: `debug` in dev, `info` in prod.

Production output shape:

```json
{"time":"...","level":"info","tag":"api:webhooks:stripe","msg":"Webhook received","data":{"type":"invoice.payment_failed"}}
```

No `console.log` in production code. Every server-side module creates its own tagged logger at the top of the file.

---

## `packages/ui` — shadcn + theme

shadcn components live in `src/components/ui/`. Add them from `packages/ui/`:

```bash
pnpm dlx shadcn@latest add button card input form dialog
```

The theme (`src/styles/theme.css`) is a TweakCN export — Tailwind v4, OKLCH variables, DM Sans + Space Mono, flat shadows, pure black borders. Regenerate from TweakCN if brand changes; do not hand-edit.

Visual notes:
- Borders are pure black by default. Every `<Card>`, `<Input>`, `<Button>` will have a black outline.
- Shadows are flat (no blur). For deliberate elevation: `shadow-[3px_3px_0px_0px_var(--border)]`.
- Fonts: DM Sans + Space Mono. Load via Google Fonts in each app's `index.html`.

Both `apps/web` and `apps/marketing` import from `@app/ui`.

---

## `apps/api` — Nitro server

Hosts tRPC, Better Auth, SSE, webhooks, and background tasks in a single Nitro app.

### Endpoints

| Path | What |
|---|---|
| `GET /health` | `{ status: "ok" }` |
| `POST /api/trpc/*` | tRPC batch handler |
| `ALL /api/auth/*` | Better Auth catch-all |
| `GET /api/events` | SSE — auth-gated, per-user real-time stream |
| `POST /webhooks/stripe` | Stripe inbound webhook |
| `POST /webhooks/resend` | Resend inbound webhook |

### Auth — Better Auth

`src/lib/auth.ts` configures Better Auth with the Prisma adapter, email/password, and email verification. `sendResetPassword` and `sendVerificationEmail` route through Nitro tasks rather than calling Resend inline.

Cross-origin checklist for `app.example.com` ↔ `api.example.com`:
- `TRUSTED_ORIGINS=https://app.example.com` on the API
- CORS plugin allows that origin with `credentials: true`
- Cookie attributes in production: `sameSite: "none"`, `secure: true`, `partitioned: true`

### tRPC

`src/trpc/trpc.ts` initialises tRPC with a context that reads the Better Auth session from the request headers and exposes `prisma`, `user`, and `session`. Two procedures:

- `publicProcedure` — open
- `protectedProcedure` — throws `UNAUTHORIZED` if no session

Inputs use Arktype: `type({ id: "string" })`. tRPC v11 accepts Standard Schema directly — no adapter needed.

### Real-time events

`src/lib/events.ts` uses two ioredis clients (publisher + subscriber) bound to the `app:events` Valkey channel. Per-user filtering happens in-memory inside the SSE handler.

```ts
publish({ type: "notification.read", userId, data: { id } });
// → published to Valkey → every replica's subscriber receives it
// → each replica iterates its local SSE handler set
// → filters by userId, pushes to matching connections
```

`publish()` / `subscribe()` signatures are stable. Upgrading to BullMQ or changing the Valkey topology does not affect call sites.

### Notification orchestrator

`src/lib/notify.ts` does three things in order:

1. `publish()` — real-time (best-effort, no persistence required)
2. `prisma.notification.create()` — durable inbox record
3. `runTask("email:send" | "sms:send", ...)` — fan out to channels via tasks, respecting user preferences

### Background tasks (Nitro)

`server/tasks/<area>/<name>.ts`. Call from anywhere on the server:

```ts
import { runTask } from "nitropack/runtime";
await runTask("email:send", { payload: { to, subject, html } });
```

Scheduled tasks are registered in `nitro.config.ts` under `scheduledTasks`.

**Why tasks for sends:** the HTTP response goes out immediately; the send happens after. If the provider has a transient error, the task fails without the user retrying. All outbound communication flows through one pipeline — swapping providers or adding BullMQ is one file change.

**Durability limit:** Nitro tasks are in-process. A crash mid-run loses the job. See [Upgrade paths](#upgrade-paths) for the BullMQ trigger.

### Webhook pattern

`server/routes/webhooks/<provider>.post.ts`:

1. `readRawBody` — do not let Nitro parse it (signature verification needs the bytes)
2. Verify signature — throw 400 on failure
3. `prisma.webhookEvent.findUnique({ where: { id: event.id } })` — skip if duplicate
4. `prisma.webhookEvent.create(...)` — persist with provider event ID as PK
5. `runTask(...)` — hand off processing
6. Return `{ received: true }`

The processing task reads the persisted row, dispatches by event type, and updates `processedAt` on success.

---

## `apps/web` — Vite SPA

### Auth

`src/lib/auth.ts` creates the Better Auth client. All sign-in/sign-up/sign-out happens through it. The tRPC and auth clients both send `credentials: "include"`.

### Routing

TanStack Router file-based routing. All routes under `_authed/` are protected by `_authed.tsx`, which calls `authClient.getSession()` in `beforeLoad` and redirects to `/login` if no session. The SSE connection (`useRealtime`) mounts once in the authed layout.

### Data loading

```tsx
export const Route = createFileRoute("/_authed/dashboard")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(context.trpc.notifications.list.queryOptions()),
  component: Dashboard,
});

function Dashboard() {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.notifications.list.queryOptions());
  // ...
}
```

Loaders prefetch; components suspend on the same key. Cold loads show the route's `pendingComponent`; intent-preloaded navigations feel instant.

### Real-time invalidations

`src/lib/use-realtime.ts` maps server event types to TanStack Query keys. Add entries to `INVALIDATIONS` when new server events should trigger UI refreshes.

---

## `apps/marketing` — Astro

Static landing page at the apex domain. Auth-unaware — no fetch calls, no session state, no `better-auth` import.

Signup/login CTAs link to `app.example.com`. Interactive sections use React islands (`client:load`). Theme imported from `@app/ui/styles/theme.css`.

---

## `tooling/e2e` — Playwright

Connects to whatever `BASE_URL` provides. Portable across PR environments, dev, staging, and production without code changes.

Conventions:
- Unique email per test run: `e2e+${Date.now()}-${random}@example.test`
- No imports from `apps/web` or `apps/api`
- Use `test.skip` rather than forking by environment

CI uploads `playwright-report/` as an artifact on failure. Download → unzip → `index.html` for traces, screenshots, and video.

---

## Infrastructure (Railway)

### Per-service `railway.json`

Each app has one. `watchPatterns` means Railway only rebuilds when that app's code or its package dependencies change.

```json
// apps/api/railway.json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "apps/api/Dockerfile",
    "watchPatterns": ["apps/api/**", "packages/db/**", "packages/trpc/**", "pnpm-lock.yaml", "turbo.json"]
  },
  "deploy": {
    "startCommand": "node apps/api/.output/server/index.mjs",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE"
  }
}
```

### Valkey

Valkey is load-bearing from day one for SSE pub/sub. `apps/api/src/lib/events.ts` uses two ioredis clients (publisher + subscriber) on the `app:events` channel. Every API replica subscribes; events fan out across all of them.

It's also available for rate limiting, distributed locks, and BullMQ when those are needed.

```
VALKEY_URL=${{Valkey.VALKEY_URL}}   # private by default in Railway
```

### Horizontal scaling

What scales freely: `web` and `marketing` (stateless, any number of replicas). `api` request handling is replica-safe (sessions in Postgres). SSE pub/sub is already Valkey-backed.

Things to watch when API replicas exceed one:

**Scheduled tasks.** Nitro's `scheduledTasks` fires on every replica. Options: (a) run cron on a single dedicated replica, or (b) wrap each handler in a Valkey `SET NX EX` lock.

**Postgres connections.** `replicas × pool_size ≤ max_connections − 10`. Tune via `DATABASE_URL` query params. PgBouncer is the next step when you hit the limit.

### Environments and branches

| Railway environment | Watches | Promotion trigger |
|---|---|---|
| dev | `main` | Push to `main` |
| staging | `staging` | GitHub release marked **pre-release** |
| production | `production` | GitHub release marked **release** |
| pr-* | PR branches | PR opened (Railway auto-creates env per PR) |

**Wait for CI configuration (by environment):**

| Environment | Wait for CI | Rationale |
|---|---|---|
| PR environments | **Yes** | CI gates must pass before the PR env deploys |
| dev (`main`) | **Yes** | CI must pass, then dev deploys, then e2e runs after |
| staging | **No** | GitHub Release is the manual gate; commit already passed CI on `main` |
| production | **No** | Same — `pr.yml` only triggers on `pull_request`, not branch pushes |

Required statuses (PR envs + dev): `quality / Lint & Typecheck`, `codeql / CodeQL`, and the three `trivy / Trivy Container Scan` jobs.

> Do NOT add e2e as a required status for the deploy gate. E2E is the verification step that runs **after** the deploy (triggered by `deployment_status: success`), not a prerequisite for it.

### CI/CD

**`pr.yml`** — runs on every PR: lint + typecheck, CodeQL, Trivy (3 services in parallel). All four must pass before Railway deploys the PR environment.

**`e2e.yml`** — triggers on `deployment_status: success`. Runs Playwright against the deployed URL. One workflow handles every environment automatically.

**`release.yml`** — on GitHub release, force-pushes the commit to `staging` or `production` branch. Railway sees the push and deploys.

No external GitHub secrets required. `release.yml` uses the built-in `GITHUB_TOKEN`
(`permissions: contents: write`). `staging` and `production` branches are intentionally
unprotected — they are deploy targets only, updated exclusively by `release.yml`.

---

## Dockerfiles

Three-stage pattern (pruner → builder → runtime) using `turbo prune --docker` for clean layer caching.

**API** — runtime is `node:22-alpine`; Nitro bundles all deps into `.output/`, so the final image carries no `node_modules`.

**Web** — runtime is `caddy:2-alpine`. `VITE_API_URL` is baked in at build time via `ARG`/`--build-arg`. The Caddyfile has `try_files {path} /index.html` for SPA routing.

**Marketing** — same as web, without the SPA fallback.

Why Caddy: single static binary, clean syntax, native env var interpolation (`{$PORT:80}`), sensible defaults.

Why `turbo prune`: without it every code change invalidates the `pnpm install` layer. With prune, only `package.json` changes do.

---

## Environment variables

### `apps/api`

| Variable | Required | Dev default |
|---|---|---|
| `DATABASE_URL` | yes | `postgres://app:app@localhost:5432/app` |
| `BETTER_AUTH_SECRET` | yes | any 32+ char string |
| `BETTER_AUTH_URL` | yes | `https://api.vitro.localhost` |
| `TRUSTED_ORIGINS` | yes | `https://app.vitro.localhost` |
| `RESEND_API_KEY` | yes | dummy (Mailpit catches sends) |
| `RESEND_FROM_EMAIL` | yes | `dev@localhost` |
| `VALKEY_URL` | yes | `redis://localhost:6379` |
| `NODE_ENV` | yes | `development` |
| `LOG_LEVEL` | no | `debug` (dev) / `info` (prod) |
| `BIRD_ACCESS_KEY` | when SMS live | — |
| `BIRD_WORKSPACE_ID` | when SMS live | — |
| `BIRD_SMS_CHANNEL_ID` | when SMS live | — |
| `STRIPE_SECRET_KEY` | when payments live | — |
| `STRIPE_WEBHOOK_SECRET` | when payments live | — |
| `STRIPE_CONNECT_CLIENT_ID` | when payments live | — |

### `apps/web`

| Variable | Required | Notes |
|---|---|---|
| `VITE_API_URL` | yes | Baked into bundle at build time |

### `tooling/e2e`

| Variable | Required | Notes |
|---|---|---|
| `BASE_URL` | yes (CI) | Defaults to `https://app.vitro.localhost` locally |

### Validating env at startup

`apps/api/src/lib/env.ts` uses Arktype to fail fast at boot if anything is missing or malformed. Add new required vars here.

---

## Local development

App code runs natively via `pnpm dev`. Docker Compose runs infra dependencies. Portless routes stable named subdomains.

### Portless

```bash
npm install -g portless
portless trust   # one-time, requires sudo — trusts the local CA in your browser
```

| Local URL | Production URL |
|---|---|
| `https://vitro.localhost` | `https://example.com` |
| `https://app.vitro.localhost` | `https://app.example.com` |
| `https://api.vitro.localhost` | `https://api.example.com` |
| `https://mailpit.localhost` | — (dev only) |

App names and underlying commands are declared in `portless.json` at the repo root:

```jsonc
// portless.json
{
  "apps": {
    "apps/api":       { "name": "api.vitro",  "script": "dev:app" },
    "apps/web":       { "name": "app.vitro",  "script": "dev:app" },
    "apps/marketing": { "name": "vitro",      "script": "dev:app" }
  }
}
```

Each app's `package.json` has `"dev": "portless"` (registers with the proxy) and `"dev:app": "<framework cmd>"` (the actual server). `pnpm dev:up` starts the proxy and calls `pnpm dev`; you can also run `pnpm dev` alone when infra is already up.

### Docker Compose

Postgres 17, Valkey 8, Mailpit. `pnpm dev:up` starts them; `pnpm dev:down` stops and keeps volumes; `pnpm dev:clean` wipes volumes.

### Mailpit

Catches all outbound email locally at `https://mailpit.localhost` (proxied by Portless). The `email:send` task routes through Mailpit's SMTP in dev and Resend in production.

### First-time setup

```bash
pnpm install
npm install -g portless
portless trust                            # one-time: trust local CA (requires sudo)
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
pnpm db:migrate
pnpm dev:up                               # starts infra + proxy + all apps
```

---

## Initial setup checklist

1. **`pnpm infra:init`** — provisions Railway project, three environments, Postgres + Valkey per env, service shells.
2. **GitHub + branches (dashboard)** — connect repo, set branch tracking, enable Wait for CI, enable PR Environments.
3. **Secrets per env** — `BETTER_AUTH_SECRET` (unique per env), `BETTER_AUTH_URL`, `TRUSTED_ORIGINS`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `VITE_API_URL` (web service).
4. **DNS** — CNAME records for `example.com`, `app.example.com`, `api.example.com`.
5. **Autoscaling** — API: 1/3 @ 70% CPU (prod only); Web: 1/2; Marketing: 1/1. dev/staging: max 1 everywhere.
6. **GitHub secrets** — `PROMOTE_TOKEN`: fine-grained PAT, write to `staging` + `production` branches.
7. **First deploy** — open a PR → pr.yml → Railway PR env → e2e. Merge → dev. Pre-release → staging. Release → production.
8. **Smoke test** — `/health` returns ok, signup works, password reset email arrives in Mailpit (dev) / inbox (prod), SSE connection visible in DevTools Network.

---

## Key invariants

These are non-negotiable. Breaking them creates subtle, hard-to-debug problems.

- **API is the single source of truth for auth.** Never read or write auth state without going through Better Auth.
- **Cookies require exact origins, `credentials: true`, and `sameSite: "none"; secure: true; partitioned: true` in production.** No `*` origins.
- **All transactional sends go through tasks.** No inline `resend.emails.send()` calls in route handlers.
- **All server logging goes through `@app/logger`.** No bare `console.log` in production code. Tag every logger.
- **Webhooks always verify signature, persist with provider event ID as PK, and hand off to a task.** Never process inline.
- **The Prisma client is a singleton.** One instance per process, in `@app/db`. Never `new PrismaClient()` elsewhere.
- **`AppRouter` is exported as `type` only.** Never import runtime API code into the web app.
- **Marketing is auth-unaware.** No fetch calls, no auth state, no `better-auth` import — static HTML and CSS.
- **VAPID keys (when push is added) must be stable.** Rotating them silently invalidates every browser subscription.

---

## Upgrade paths

| Today | Trigger | Next step |
|---|---|---|
| Nitro tasks | Need retry / durability for sends | BullMQ on Valkey, replace `runTask` with `queue.add` |
| Native Railway autoscaling | CPU lies about Node saturation | Custom cron-based autoscaler scraping event-loop-lag p95 |
| Dashboard env vars | ≥3 environments and tired of clicking | JSON manifests + `provision-env.sh` |
| No outbound webhooks | Customer-facing event subscriptions | `WebhookSubscription` + `WebhookDelivery` tables, scheduled retry task |
| Push notifications deferred | Mobile or PWA traffic | `web-push` + VAPID keys + `push_subscription` table |
| Single Postgres | Read scaling | Replicas; route reads via Prisma's read-replica support |

The shape of each upgrade is designed so call sites don't change — only implementations behind stable boundaries.
