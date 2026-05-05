# @app/mobile

Expo app for iOS and Android. Shares UI components with `apps/web` via `packages/ui`.

## First-time setup

```bash
# From repo root
pnpm install

# iOS — requires Xcode + Simulator
pnpm --filter @app/mobile ios

# Android — requires Android Studio + Emulator
pnpm --filter @app/mobile android

# Metro dev server only
pnpm --filter @app/mobile dev
```

## Architecture: `"use dom"`

Each screen is split into two layers:

```
app/(tabs)/index.tsx          ← native shell (React Native)
components/dom/counter.tsx    ← DOM component (web React)
```

**Native shell** (`app/(tabs)/index.tsx`)
- Owns state, route params, session
- Wraps native APIs (haptics, camera, secure storage) as async callbacks
- Passes everything as serializable props to the DOM component
- Does nothing visual

**DOM component** (`components/dom/counter.tsx`)
- `"use dom"` directive at the top — Metro compiles it as a web bundle
- Runs inside a native WebView at runtime
- Imports and renders `@app/ui` shadcn components exactly as web does
- Receives all data and capabilities as props
- Uses `<div>`, `<button>`, etc. — no React Native primitives

### The bridge

```
Button onClick (web)
  → await onIncrement()          ← async prop = RPC across WebView bridge
  → Haptics.impactAsync()        ← native API, runs in the native shell
  → setCount(c => c + 1)        ← state update
  → count prop re-serialized → DOM component re-renders
```

### Rules

| Inside DOM component | Inside native shell |
|---|---|
| ✓ HTML elements | ✓ View, Text, etc. |
| ✓ Tailwind classes | ✓ StyleSheet |
| ✓ Web APIs | ✓ expo-haptics, expo-camera, etc. |
| ✗ React Native modules | ✗ DOM-only APIs |
| ✗ Native APIs directly | ✗ Direct WebView control |

### Props contract

- **Primitives** (`string`, `number`, `boolean`, `null`) — serialized automatically
- **Function props** — become `async`, always return `Promise`. Keep them fast.
- **No** class instances, Dates, RegExps, or nested functions

## Adding a new screen

1. Create `components/dom/your-screen.tsx` with `"use dom"` + `@app/ui` imports
2. Create `app/(tabs)/your-screen.tsx` as the native shell — passes state + native callbacks
3. Add the tab in `app/(tabs)/_layout.tsx`

## Tailwind in DOM components

`@app/ui/styles/theme.css` is imported in each DOM component. Metro processes it
via `postcss.config.js` → `@tailwindcss/postcss`. All OKLCH variables and utility
classes from the shared theme are available.

## Known setup notes

- `unstable_enablePackageExports: true` in `metro.config.js` is required for `@app/ui`
  exports map (`./components/ui/*`, `./styles/theme.css`) to resolve in Metro.
- `unstable_transformImportMeta: true` in `babel.config.js` handles ESM workspace packages.
- Run `expo install` after adding native deps to get peer-compatible versions:
  `pnpm --filter @app/mobile exec expo install <package>`
