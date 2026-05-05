# @app/e2e

Playwright end-to-end tests. Runs against any deployed environment — PR previews, dev, staging, production.

## Running

```bash
# Against local dev (default BASE_URL)
pnpm --filter @app/e2e test

# Interactive mode while writing tests
pnpm --filter @app/e2e test:ui

# Against a specific environment
BASE_URL=https://app-staging.example.com pnpm --filter @app/e2e test
```

In CI, `BASE_URL` is set automatically from Railway's `deployment_status` event URL.

## Writing tests

Tests live in `tests/`. The Playwright config is in `playwright.config.ts`.

**Key conventions:**

- **Idempotent test data.** Use unique emails per run:
  ```ts
  const email = `e2e+${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  ```
  PR environments run in parallel — collisions silently break tests.

- **No internal imports.** Tests treat the web app as a black box. Never import from `apps/web` or `apps/api`.

- **One suite, every environment.** Don't fork test logic by environment. Use `test.skip` if a feature isn't available everywhere.

## Debugging failures

The CI workflow (`e2e.yml`) uploads `playwright-report/` as an artifact on failure. Download, unzip, open `index.html` — you get traces, screenshots, and video.

Locally, `test:ui` opens Playwright's interactive trace viewer.

## Config

`playwright.config.ts` defaults to `http://app.vitro.localhost:1355`. Override with `BASE_URL`. CI sets `retries: 2` and `workers: 2`.
