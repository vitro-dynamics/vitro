# @app/web

Vite SPA. TanStack Router + TanStack Query + tRPC client + Better Auth. Deployed as static files behind Caddy.

## Structure

```
apps/web/src/
├── routes/
│   ├── __root.tsx          Root layout — defines router context shape
│   ├── index.tsx           Redirects to /dashboard or /login
│   ├── login.tsx
│   ├── signup.tsx
│   ├── _authed.tsx         Authed layout — guards all nested routes + mounts SSE
│   └── _authed/
│       ├── dashboard.tsx
│       └── settings.tsx
├── lib/
│   ├── auth.ts             Better Auth client (signIn, signUp, signOut, useSession)
│   ├── trpc.ts             tRPC client + TRPCProvider + useTRPC hook
│   ├── use-realtime.ts     SSE hook — invalidates Query cache on server events
│   └── env.ts              Vite env type declarations
├── router.tsx              createRouter with QueryClient + tRPC proxy in context
└── main.tsx                React root
```

## Dev

```bash
cp .env.example .env
pnpm --filter @app/web dev      # → http://app.vitro.localhost:1355
```

Requires Portless globally and the API running.

## Scripts

```bash
pnpm --filter @app/web dev        # Vite dev server via Portless
pnpm --filter @app/web build      # TypeScript check + Vite build → dist/
pnpm --filter @app/web typecheck
pnpm --filter @app/web lint
```

## Route conventions

All routes under `_authed/` are automatically protected — `_authed.tsx` calls `authClient.getSession()` in `beforeLoad` and redirects unauthenticated users to `/login?redirect=<current-path>`.

The SSE connection (`useRealtime`) is mounted once in `_authed.tsx`, so it's active for the entire authenticated session.

## Data loading pattern

Loaders prefetch, components suspend on the same query key:

```tsx
export const Route = createFileRoute("/_authed/your-route")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(context.trpc.yourRouter.yourQuery.queryOptions()),
  component: YourComponent,
});

function YourComponent() {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.yourRouter.yourQuery.queryOptions());
  // ...
}
```

## Real-time invalidations

Add entries to `INVALIDATIONS` in `src/lib/use-realtime.ts` to map server event types to query keys:

```ts
const INVALIDATIONS: Record<string, string[][]> = {
  "your.event.type": [["yourQueryKey"]],
};
```

## Adding new routes

TanStack Router uses file-based routing. Create a file in `src/routes/` and the Vite plugin auto-generates `routeTree.gen.ts` on save.

## Env

```
VITE_API_URL=http://api.vitro.localhost:1355   # baked into the bundle at build time
```

