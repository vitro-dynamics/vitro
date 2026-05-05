# @app/trpc

Type bridge between `apps/api` and `apps/web`. One line.

```ts
// src/index.ts
export type { AppRouter } from "../../../apps/api/src/trpc/router";
```

## Why this exists

The web app needs the `AppRouter` type to get end-to-end type safety through the tRPC client. It does **not** need any of the API's runtime code (Nitro, Prisma, Better Auth server adapters). Importing `apps/api` directly would pull all of that into the web bundle.

This package exports `AppRouter` as a type-only re-export. TypeScript erases it entirely at compile time — nothing from `apps/api` is ever bundled into `apps/web`.

## Rule

`import type` only. Never add runtime exports or runtime dependencies to this package.

## Usage

```ts
// In apps/web
import type { AppRouter } from "@app/trpc";
```

The actual tRPC router implementation lives in `apps/api/src/trpc/`.
