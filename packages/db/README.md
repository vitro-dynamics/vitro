# @app/db

Prisma 7 database client. Single source of truth for the schema and the only place `PrismaClient` is instantiated.

## What's here

```
packages/db/
├── prisma/
│   └── schema.prisma       All models — Better Auth tables + app models
├── src/
│   ├── client.ts           Singleton PrismaClient (globalThis cache for dev HMR)
│   └── index.ts            Public exports: prisma client + generated types
├── generated/              Gitignored — output of prisma generate
└── prisma.config.ts        Prisma 7 config: schema path + datasource URL
```

## Models

| Model | Purpose |
|---|---|
| `User`, `Session`, `Account`, `Verification` | Better Auth — do not edit manually, regenerate with `@better-auth/cli` |
| `NotificationPreference` | Per-user opt-in flags for email, SMS, push |
| `Notification` | Persisted notification inbox |
| `PushSubscription` | Web Push endpoint + VAPID keys per browser/device |
| `WebhookEvent` | Idempotency store for inbound webhooks (keyed by provider event ID) |
| `ConnectedAccount` | Stripe Connect — maps a user to their Express account |
| `SuppressedEmail` | Hard-bounce / complaint suppression list |
| `SmsConsent` | Audit record of user SMS opt-in (E.164, IP, disclosure text) |
| `SmsOptOut` | Authoritative STOP opt-out keyed by phone number |
| `Image` | S3 object metadata (pending → uploaded lifecycle) |

## Scripts

```bash
pnpm --filter @app/db generate        # regenerate Prisma client (or: pnpm db:generate from root)
pnpm --filter @app/db migrate         # create + apply a migration (dev only)
pnpm --filter @app/db migrate:deploy  # apply pending migrations (CI / production)
pnpm --filter @app/db studio          # open Prisma Studio
```

The `postinstall` script runs `prisma generate` automatically so fresh installs in CI always have a client.

## Usage

```ts
import { prisma } from "@app/db";
import type { User, Notification } from "@app/db";

const user = await prisma.user.findUniqueOrThrow({ where: { id } });
```

Never call `new PrismaClient()` outside this package. One instance per process.

## Env

`DATABASE_URL` — PostgreSQL connection string. In Railway, this resolves to the private `railway.internal` address by default.

## Upgrading the Better Auth schema

```bash
npx @better-auth/cli generate
# copies updated model definitions → paste into schema.prisma
pnpm db:migrate
```
