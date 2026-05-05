# @app/ui

Shared component library. shadcn/ui components + Tailwind v4 theme. Consumed by `apps/web` and `apps/marketing`.

## What's here

```
packages/ui/
├── src/
│   ├── components/ui/      shadcn components (add via CLI below)
│   ├── lib/
│   │   └── utils.ts        cn() — Tailwind class merger
│   └── styles/
│       └── theme.css       Tailwind v4 entry + OKLCH design tokens
└── components.json         shadcn config (aliases, style, icon library)
```

## Adding components

Run from `packages/ui/`:

```bash
pnpm dlx shadcn@latest add button card input form dialog dropdown-menu
```

Components land in `src/components/ui/` and are immediately available in both apps.

## Importing

```ts
// Components
import { Button } from "@app/ui/components/ui/button";
import { Card } from "@app/ui/components/ui/card";

// Utility
import { cn } from "@app/ui/lib/utils";
```

```css
/* In each app's global CSS */
@import "@app/ui/styles/theme.css";
```

## Theme

The theme is a TweakCN export — Tailwind v4 with OKLCH color variables, DM Sans + Space Mono, brutalist flat shadows, and pure black borders.

**Visual notes:**
- Every element with a border gets a black outline by default (`--border: oklch(0 0 0)`). This is intentional — embrace it or override per-component.
- Shadows are flat (no blur). For a hard offset shadow: `shadow-[3px_3px_0px_0px_var(--border)]`.
- Fonts: DM Sans (body) + Space Mono (mono). Loaded via Google Fonts in each app's HTML.

To update the theme, regenerate from [TweakCN](https://tweakcn.com) and replace `src/styles/theme.css`. Do not hand-edit the token values.

## Dark mode

Dark mode uses the `.dark` class variant: `@custom-variant dark (&:is(.dark *))`. Toggle by adding/removing `dark` on a parent element.
