# vitro — Project Rules

## Commit discipline

- Always run `pnpm typecheck && pnpm lint` before committing. Fix all errors.
- After any work, verify that affected READMEs and docs are still accurate:
  - `docs/ARCHITECTURE.md` for architectural changes
  - `docs/setup.md` for new external services or env vars
  - The relevant package or app `README.md` for API / usage changes
- Do not add AI co-author tags to commits.
- Commit messages should describe *what changed and why*, not just what files were touched.

## Shared screen architecture

Screen UI components live in `packages/ui/src/screens/` as pure React — no data fetching,
no routing, no platform APIs. They receive everything as props.

| Layer | Location | Responsibility |
|---|---|---|
| Shared UI | `packages/ui/src/screens/<name>.tsx` | Pure React, props-only |
| Web route | `apps/web/src/routes/_authed/<name>.tsx` | Fetches data, renders screen |
| Mobile DOM | `apps/mobile/components/dom/<name>.tsx` | `"use dom"` wrapper, imports screen |
| Mobile shell | `apps/mobile/app/(tabs)/<name>.tsx` | Native APIs, state, passes props |

Data fetching always happens at the boundary layer, never inside the shared screen component.
This is what makes the same UI renderable on both web (via TanStack Router + React Query)
and mobile (via Expo's `"use dom"` WebView bridge).

When adding a new screen:
1. Build the UI in `packages/ui/src/screens/<name>.tsx`
2. Create a web route that fetches data and renders the screen
3. Create a mobile DOM wrapper (`"use dom"`) that imports the same screen
4. Create a mobile native shell that owns state and native callbacks

## Repo

Turborepo + pnpm workspaces. Package manager is `pnpm@10.15.0`. Node >=22 required.

```
apps/        api · web · marketing
packages/    db · trpc · logger · ui
tooling/     biome · typescript · e2e · infra
docs/        ARCHITECTURE.md
```

All workspaces use the `@app/` namespace (`@app/api`, `@app/db`, etc.).

## Stack

| Layer | Choice |
|---|---|
| API | Nitro + tRPC v11 + Better Auth |
| Database | Postgres + Prisma 7 (driver adapter, ESM-first) |
| Validation | Arktype (Standard Schema — works directly with tRPC v11) |
| Frontend | Vite + React 19 + TanStack Router + TanStack Query |
| UI | shadcn (Tailwind v4) + shared theme in `packages/ui` |
| Marketing | Astro |
| Real-time | SSE + Valkey pub/sub via ioredis |
| Email (dev) | Mailpit on localhost:8025 |
| Email (prod) | Resend |
| SMS | Bird Channels API (fetch, no SDK) |
| Payments | Stripe Connect |
| Logging | `@app/logger` (consola wrapper) |
| Hosting | Railway |

## Dev commands

```bash
# One-time (after install, after reboot):
# portless trust               # trust local CA (sudo once)
# portless proxy start --https # start HTTPS daemon (sudo once, persists)

pnpm dev:up          # start infra + portless proxy + apps (https://app.vitro.localhost etc.)
pnpm dev:mobile      # start Expo separately (iOS/Android)  
pnpm dev:down        # stop infra (keeps volumes)
pnpm dev:clean       # stop infra + wipe volumes
pnpm dev:reset       # clean → up → migrate
pnpm dev:logs        # tail infra logs (docker compose logs -f)
pnpm db:migrate             # create + apply a migration (dev only — interactive)
pnpm db:migrate:deploy      # apply pending migrations only (non-interactive, for CI)
pnpm db:studio              # Prisma Studio
pnpm db:generate            # regenerate Prisma client
pnpm lint            # biome check . (not turbo)
pnpm typecheck       # turbo typecheck
pnpm build           # turbo build
```

## Coding conventions

### Logging
- Always use `@app/logger`, never `console.log` in production code.
- Every server-side module creates its own tagged logger at the top of the file.
- Tag format: `area:subarea` (e.g. `api:auth`, `tasks:email`, `api:events`).

```ts
import { createLogger } from "@app/logger";
const log = createLogger("api:webhooks:stripe");
```

### TypeScript typing
- **No `!` non-null assertions.** If a value might be absent, guard it: `if (!x) throw ...` or use optional chaining.
- **No `any`.** Biome enforces this as an error. Use the narrowest specific type, or `Record<string, unknown>` / `unknown` with a guard.
- **No `unknown` as a lazy escape hatch.** It is fine as a function parameter that is immediately narrowed; it is not fine as a permanent type.
- **No `as any`/`as unknown`.** Use specific types. For third-party library boundaries (`r.reason` from `Promise.allSettled`, etc.) use `as { field?: Type } | undefined` with optional access.
- Prefer type narrowing via guard functions and control flow over type assertions.

### tRPC
- Inputs use Arktype: `type({ id: "string", amount: "number > 0" })`.
- Public reads: `publicProcedure`. Anything user-scoped: `protectedProcedure`.
- Adding a router: create `src/trpc/routers/<name>.ts`, mount in `src/trpc/router.ts`.

### Tasks (background work)
- All transactional sends (email, SMS) go through `runTask()`. Never inline.
- Adding a task: `server/tasks/<area>/<name>.ts` with `defineTask({ meta, run })`.

```ts
import { runTask } from "nitropack/runtime";
await runTask("email:send", { payload: { to, subject, html } });
```

### Webhooks
- Always: verify signature → persist with provider event ID as PK → `runTask()` → return 200.
- Never process a webhook inline.

### Database
- Never `new PrismaClient()` outside `@app/db`. One singleton per process.
- Import: `import { prisma } from "@app/db"`.

### Auth
- All auth state flows through Better Auth. No bypassing.
- tRPC context exposes `ctx.user` and `ctx.session` (null if unauthenticated).

### Type bridge
- `@app/trpc` re-exports `AppRouter` as `type` only. Never add runtime code or deps.

### Frontend routing
- Routes under `_authed/` are auto-protected by `_authed.tsx` — no per-route auth checks needed.
- Data pattern: loader prefetches via `context.queryClient.ensureQueryData(...)`, component uses `useSuspenseQuery` on the same key.

### Real-time
- To trigger a UI refresh from the server: `publish({ type: "your.event", userId, data })`.
- To handle it in the web app: add an entry to `INVALIDATIONS` in `src/lib/use-realtime.ts`.

## Key invariants (never break these)

- `AppRouter` is `import type` only — never import API runtime into the web app.
- Marketing (`apps/marketing`) is auth-unaware — no fetch calls, no `better-auth` import.
- All server logging through `@app/logger` with tags.
- Cookies in production: `sameSite: "none"`, `secure: true`, `partitioned: true`, exact origins only.
- Prisma client is a singleton in `@app/db`.
- Webhooks verify → persist → task → 200.

## Shared tooling

- **Biome**: single root `biome.json` — no per-workspace configs. Run `pnpm lint` / `pnpm lint:fix`.
- **TypeScript presets**: `tooling/typescript/` exports `node.json`, `react.json`, `astro.json`. Every workspace extends the right one.
- **shadcn components**: add from `packages/ui/` with `pnpm dlx shadcn@latest add <component>`.

## Environment

Required vars at API boot (validated by Arktype in `apps/api/src/lib/env.ts`):

```
DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL,
TRUSTED_ORIGINS, RESEND_API_KEY, RESEND_FROM_EMAIL, VALKEY_URL
```

Copy `apps/api/.env.example` → `apps/api/.env` and `apps/web/.env.example` → `apps/web/.env` for local dev. Defaults match docker-compose.
