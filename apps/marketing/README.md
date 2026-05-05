# @app/marketing

Astro static site. Landing page at the apex domain. Auth-unaware — no fetch calls, no session state.

## Structure

```
apps/marketing/src/
├── pages/
│   └── index.astro         Landing page (imports Layout + Hero island)
├── layouts/
│   └── Layout.astro        HTML shell, Google Fonts, <slot />
├── components/
│   └── Hero.tsx            React island — client:load directive
└── styles/
    └── globals.css         @import "@app/ui/styles/theme.css"
```

## Dev

```bash
pnpm --filter @app/marketing dev    # → http://vitro.localhost:1355
```

Requires Portless globally.

## Scripts

```bash
pnpm --filter @app/marketing dev       # Astro dev server via Portless
pnpm --filter @app/marketing build     # Static build → dist/
pnpm --filter @app/marketing typecheck # astro check
pnpm --filter @app/marketing lint
```

## Conventions

- **No auth.** Signup/login CTAs link to `app.vitro.localhost:1355/signup` (or the production equivalent). The marketing site does not import `better-auth`, `@app/trpc`, or make any API calls.
- **Static output.** `astro build` produces pure HTML/CSS/JS in `dist/`. Deployed behind Caddy with aggressive asset caching.
- **React islands.** Interactive sections use `client:load` (or `client:visible` for below-the-fold content). Most of the page should be static Astro components.
- **Shared theme.** Import `@app/ui/styles/theme.css` in `globals.css` for consistent design tokens. Add shadcn components from `@app/ui/components/ui/*` as needed.

## Adding pages

Create `.astro` files in `src/pages/`. Astro uses file-based routing — `src/pages/about.astro` becomes `/about`.
