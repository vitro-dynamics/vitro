# @app/api

Nitro server. Single deployable that hosts tRPC, Better Auth, SSE, inbound webhooks, and background tasks.

## Endpoints

| Path | What |
|---|---|
| `GET /health` | Healthcheck — returns `{ status: "ok" }` |
| `POST /api/trpc/*` | tRPC batch endpoint |
| `ALL /api/auth/*` | Better Auth catch-all handler |
| `GET /api/events` | SSE stream — auth-gated, per-user real-time events |
| `POST /webhooks/stripe` | Stripe inbound webhook |
| `POST /webhooks/resend` | Resend inbound webhook |

## Structure

```
apps/api/
├── src/
│   ├── trpc/
│   │   ├── trpc.ts           initTRPC, context, publicProcedure, protectedProcedure
│   │   ├── router.ts         appRouter + AppRouter type
│   │   └── routers/          feature routers (auth, notifications, …)
│   ├── lib/
│   │   ├── auth.ts           Better Auth instance
│   │   ├── events.ts         Valkey pub/sub — publish() / subscribe()
│   │   ├── notify.ts         Notification orchestrator (real-time + persist + tasks)
│   │   ├── email.ts          Resend client singleton
│   │   └── env.ts            Arktype env validation — crashes fast if misconfigured
│   └── templates/            Notification payload factories (billing, …)
└── server/                   Nitro convention — auto-imported
    ├── routes/               File-based routing
    ├── plugins/cors.ts       CORS middleware (credentials-safe, exact origins)
    ├── tasks/                Background tasks (email, sms, cleanup, webhooks)
    └── middleware/
```

## Dev

```bash
cp .env.example .env
pnpm --filter @app/api dev      # → https://api.vitro.localhost
```

Requires Portless globally (`npm install -g portless`) and infra running (`pnpm dev:up` from root).

## Scripts

```bash
pnpm --filter @app/api dev        # Nitro dev server via Portless
pnpm --filter @app/api build      # production build → .output/
pnpm --filter @app/api typecheck
pnpm --filter @app/api lint
```

## Adding a tRPC router

1. Create `src/trpc/routers/your-feature.ts`
2. Export a router built from `publicProcedure` / `protectedProcedure`
3. Mount it in `src/trpc/router.ts`

Input validation uses Arktype: `type({ id: "string", amount: "number > 0" })`.

## Adding a task

Create `server/tasks/<area>/<name>.ts` and export a `defineTask({ meta, run })`. Call it anywhere on the server with:

```ts
import { runTask } from "nitropack/runtime";
await runTask("area:name", { payload: { ... } });
```

Scheduled tasks are registered in `nitro.config.ts` under `scheduledTasks`.

## Adding a webhook

Pattern in `server/routes/webhooks/<provider>.post.ts`:
1. Read raw body (`readRawBody`) — don't let Nitro parse it
2. Verify signature
3. Persist with provider event ID as PK (idempotency)
4. `runTask(...)` and return 200

## Env

See `.env.example` for the full list. Required at boot:

```
DATABASE_URL
BETTER_AUTH_SECRET
BETTER_AUTH_URL
TRUSTED_ORIGINS
RESEND_API_KEY
RESEND_FROM_EMAIL
VALKEY_URL
```
