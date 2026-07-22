# Axlo Digital Theme Migration — Colour Audit

**Branch:** `feature/axlo-design-system-theme` (from `99826df`)
**Scope:** Front-end colour/theming only. No business logic, backend contracts,
calculations, permissions, QuickBooks logic, or workflows changed.

This was a **semantic token migration**, not a search-and-replace. The codebase
already routed almost all colour through semantic Tailwind utilities
(`bg-primary`, `text-brand-700`, `bg-card`, `border-border`, `text-muted-foreground`,
`success/warning/danger`), so the migration re-points those utilities at the
approved Axlo palette in one central place and adds a dark theme, rather than
editing colour in every component.

---

## 1. Existing colour values found

A full sweep of `apps/web/src` for hex, `rgb/rgba`, and raw Tailwind palette
utilities (`bg-blue-*`, `bg-slate-*`, `bg-violet-*`, `red/green/amber-*`, …)
found the surface area was small and well-contained:

| Value / class | Where | Purpose |
| --- | --- | --- |
| Blue brand scale + `--color-primary #2563eb` | `globals.css` `@theme` | Old primary/brand — **remapped to Axlo**. |
| `bg-red-700`, `bg-green-700`, `bg-amber-600` | `ui/button.tsx` | Hardcoded button hovers — **replaced with `-hover` tokens**. |
| `bg-slate-400`, `bg-slate-300` | dashboard `primitives.tsx`, `admin-dashboard.tsx` | Neutral status/bar dots — **remapped to Axlo `--gray-*`**. |
| `bg-slate-900/40` | `dialog`, `pos`, `sidebar`, `command-palette` | Modal scrims — **retained** (neutral dark overlay, correct in both themes). |
| `bg-foreground text-white` | `pos` toast | Dark toast — **retained** (uses `foreground` = Axlo Midnight). |
| `#1d4ed8` (blue accent) | `sale-a4-document.tsx`, `document-template-service.ts` | A4 print brand accent — **replaced with Kinetic Teal `#006c68`**. |
| `#0f172a`, `#64748b`, `#e2e8f0` | A4 document CSS | Print ink (near-Midnight / slate / hairline) — **retained** (print stays light). |
| `bg-slate-100` | `print/sales/[saleId]` | Print-preview screen backdrop — **retained** (print surfaces stay light). |

There were **no** scattered inline styles, one-off backgrounds, or hardcoded
chart colours in feature components — charts already read `var(--color-*)`.

## 2. Token architecture added (`globals.css`)

Three layers, all central:

1. **Primitive tokens** — raw approved palette: `--axlo-midnight`,
   `--axlo-kinetic-teal`, `--axlo-flow-aqua`, `--axlo-volt-lime`, `--axlo-cloud`,
   `--axlo-slate`, `--axlo-white`, and `--gray-50 … --gray-900`. Components never
   use these directly.
2. **Semantic tokens** (`--sem-*`) — purpose-named: background/surface, text
   (primary/secondary/on-primary/on-accent), border (default/strong), action
   (primary + hover/active via `color-mix`), accent + highlight, focus ring, the
   teal/aqua tint ramp, semantic status + soft + hover, elevation, chart series,
   hero gradient. Light values live in `:root`; **dark overrides** live in
   `[data-theme='dark']` (hand-tuned surfaces/borders/text — not an inversion).
3. **Utility mapping** (`@theme`) — maps every Tailwind colour utility already in
   use onto the semantic tokens, so the same class names resolve correctly in
   both themes:

| Utility | Light | Dark |
| --- | --- | --- |
| `primary` | Kinetic Teal `#006C68` | Kinetic Teal `#006C68` |
| `primary-hover/active` | darker teal (`color-mix`) | lightened teal |
| `ring` (focus) | Flow Aqua `#00D4C7` | Flow Aqua |
| `canvas` | Axlo Cloud `#F4F7F7` | Axlo Midnight `#0B1220` |
| `surface` / `card` | Pure White | `#1A2433` |
| `muted` | Gray 100 `#EEF2F4` | `#111827` |
| `foreground` | Axlo Midnight | Pure White |
| `muted-foreground` | Digital Slate `#5F6B75` | Gray 300 `#C4CED6` |
| `border` | Gray 200 `#DCE3E8` | `#2A3441` |
| `brand-50…100` | teal/aqua tint | dark teal surface |
| `brand-600/700` | Kinetic Teal | Flow Aqua |
| `accent` | Flow Aqua | Flow Aqua |
| `highlight` | Volt Lime | Volt Lime |
| `success/warning/danger/info` | `#12B76A`/`#F59E0B`/`#E5484D`/`#0EA5E9` | same hues |
| `chart-1…6` | Teal, Aqua, Lime(dk), Info, Warning, Slate | rebalanced for dark |

Also added: `@custom-variant dark` (attribute-based), `.bg-axlo-gradient`
(signature Aqua→Lime, sparing use), themed `.bg-hero-gradient`, and a
`@media print` block that forces the light tokens so shared components inside A4
previews stay ink-light.

## 3. Component tokens / variants touched

- **Button** — primary=Kinetic Teal (white text, teal hover/active), destructive
  =Error, success/warning use `-hover` tokens; focus ring = Flow Aqua (global).
- **Badge** — added `accent` (Flow Aqua + Midnight text) and `info` variants
  alongside neutral/primary/success/warning/danger.
- **Dashboard primitives** — neutral bar/dot tones moved to Axlo `--gray-*`;
  `accent` bar is now Flow Aqua; chart line reads `--color-primary` (Teal/Aqua).

## 4. Theme control

- Central `lib/theme.tsx` service: `light | dark | system`, persisted to
  `localStorage['axlo.theme']` in one place, resolves the OS preference and
  writes `data-theme` + `color-scheme` on `<html>`, and live-updates on OS change
  while in system mode.
- **No flash**: an inline `<head>` script applies the stored theme before first
  paint; `<html suppressHydrationWarning>`.
- `ThemeToggle` (radiogroup, per-option labels) in the header (md+) and inside
  the account menu (mobile fallback).

## 5. Accessibility findings

- **Passing:** White on Kinetic Teal (~5.9:1); Midnight on Flow Aqua / Volt Lime
  (accent/highlight badges); Flow Aqua text on dark teal surfaces (active nav,
  dark); focus ring visible in both themes; colour never sole signal (status
  pills carry dot **+** text, badges carry icon/text).
- **Watch items (documented, matches prior design language):** small semantic
  text on its pale soft background (e.g. `text-success` on `success-soft`) sits
  near the AA-normal threshold — always paired with an icon/dot and used at
  badge scale; not regressed from the previous theme. Volt Lime and Flow Aqua
  are never used as text on white or with white text (per rules 4–5).

## 6. Exceptions retained (with reason)

- A4 print document hex (Midnight/slate ink, hairline borders) — print must stay
  light and low-ink; brand accent updated to Teal.
- Modal scrims `bg-slate-900/40` — a neutral translucent overlay is correct over
  either theme.
- Print-preview screen backdrop (`bg-slate-100`) — print context is light.

## 7. Remaining technical debt

- Per-component dark-mode visual QA across every module is recommended (the token
  remap themes them, but edge cases — dense tables, product-image wells, deeply
  nested overlays — benefit from a manual pass).
- No JS test runner exists in `apps/web`; theme resolution logic is isolated in
  pure/near-pure functions (`resolve`, `themeInitScript`) for future unit tests.
- The theme preference is stored client-side only; wiring it into the server-side
  settings profile (if desired later) is a follow-up, not required for this
  migration.
