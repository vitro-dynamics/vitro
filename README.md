# vitro

Type-safe full-stack monorepo. Turborepo + pnpm workspaces.

> **Railway deployments:** The deployment concepts (Dockerfiles, `railway.json` per service,
> `tooling/infra/init.sh`, CI/CD workflows) are all coded in this repo. Some manual wiring
> in the Railway dashboard (branch tracking, Wait for CI, PR Environments, secrets, DNS) may
> still be needed before first deploy — see [docs/setup.md](./docs/setup.md).

## Quickstart

```bash
# Install workspace deps
pnpm install

# Install Portless globally for stable HTTPS .localhost subdomains
npm install -g portless

# One-time: trust the local CA so HTTPS works in your browser (requires sudo)
portless trust

# Copy env templates (defaults work for local dev)
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Run migrations
pnpm db:migrate

# Start infra, proxy, and all apps
pnpm dev:up
```

| What | URL |
|---|---|
| Web app | https://app.vitro.localhost |
| API | https://api.vitro.localhost |
| Marketing | https://vitro.localhost |
| Mailpit (caught dev emails) | https://mailpit.localhost |
| Prisma Studio | `pnpm db:studio` |

## Stack

| Layer | Choice |
|---|---|
| Repo | Turborepo + pnpm workspaces |
| API | Nitro + tRPC + Better Auth |
| Database | Postgres + Prisma 7 |
| Frontend | Vite + React 19 + TanStack Router + TanStack Query |
| UI | shadcn (Tailwind v4) + shared theme |
| Marketing | Astro |
| Real-time | SSE + Valkey pub/sub |
| Hosting | Railway |

## Structure

```
apps/
  api/          Nitro server — tRPC, auth, SSE, webhooks, tasks
  web/          Vite SPA — the product
  mobile/       Expo app — iOS/Android
  marketing/    Astro static site — landing page

packages/
  db/           Prisma schema + client singleton
  trpc/         AppRouter type bridge (web → api, type-only)
  logger/       consola wrapper — tagged loggers, JSON in prod
  ui/           shadcn components + Tailwind v4 theme

tooling/
  e2e/          Playwright tests
  infra/        Railway provisioning script
  typescript/   shared tsconfig presets
```

## Daily commands

```bash
pnpm dev:up          # start infra + HTTPS proxy + all web/API apps
pnpm dev:mobile      # start Expo (iOS/Android) separately
pnpm dev             # start apps only (when infra is already running)
pnpm dev:down        # stop infra (keeps data)
pnpm dev:clean       # stop infra + wipe volumes
pnpm dev:reset       # clean → up → migrate

pnpm db:migrate      # create + apply a migration
pnpm db:studio       # Prisma Studio
pnpm db:generate     # regenerate Prisma client

pnpm typecheck       # typecheck all packages
pnpm lint            # lint all packages
```

## Further reading

See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the full architecture, deployment guide, upgrade paths, and every decision with its rationale.

Per-package/app docs live in each directory's `README.md`.
