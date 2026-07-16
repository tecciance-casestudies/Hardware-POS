# Variation Builder — UI improvement

## 1. Why the variation section was "invisible"

The variation section was not hard to find — **it did not exist**. This is the honest
root cause after inspecting the code.

`ProductForm` ([apps/web/src/components/products/product-form.tsx](../apps/web/src/components/products/product-form.tsx))
renders exactly four cards — **Details**, **Pricing & stock**, **Options**, **Image** —
and nothing else. There is:

- **No product-type control** (Simple vs. Product with Variations), so there is no state
  that could ever reveal a variation UI.
- **No variation components anywhere in the app.** A repo-wide search for
  `variant option`, `generate variant`, `attribute`, `variationStore`, etc. returns only
  incidental matches (the `variant` prop on `Button`/`Badge`). No variation section is
  conditionally rendered, hidden with `display:none`, collapsed, pushed below the fold,
  or gated behind a disabled/`z-index`/overflow trick. There was simply no code to show.
- **No section navigation**, so once the form grows the user has no map of where things
  live and no anchor to jump to.

The two attached screenshots are a *reference from a different product* used to describe
the desired capability, not an existing screen in this codebase.

So the fix is twofold: (a) give the form real section navigation with a permanently
visible **Variations** item, and (b) implement the whole variation-builder experience
from scratch using the existing design system and the frontend-only mock/localStorage
architecture already established by
[category-assignments.ts](../apps/web/src/lib/category-assignments.ts).

## 2. Components affected

- **Refactored:** `components/products/product-form.tsx` — adds a sticky section-nav
  rail, a **Product type** control (Simple / Product with Variations), a permanently
  visible **Variations** nav item with an enabled/inactive state, and mounts the new
  builder. Existing Details / Pricing / Options / Image / Save behaviour is preserved.
- **Added (all new, frontend-only):**
  - `lib/variations/types.ts`
  - `lib/variations/variation-combination-utils.ts` — `variationCombinationUtils`
  - `lib/variations/variation-store.ts` — `productExtensionAdapter`,
    `variationMockService`, `variationStore` (React hook)
  - `components/products/variations/*` — the builder, attribute builder, matrix,
    bulk-edit drawer, variant drawer, regenerate dialog, and shared bits.

## 3. Proposed interaction model

A single in-page, three-stage workflow (no new routes):

1. **Attributes** — build custom attributes (Color, Size, Finish, …) with chip-based
   option entry.
2. **Combinations** — a live `3 × 2 × 2 = 12` preview with duplicate / empty / large-set
   warnings, then generate the Cartesian product.
3. **Price & stock** — a compact, filterable, groupable variant matrix with bulk edit and
   a per-variant detail drawer.

An overview header summarises status, attribute/option/variant counts, price mode and
stock mode, and exposes one clear **primary** action at a time (blue, never dark).

## 4. Responsive approach

- **Desktop / laptop:** full matrix, sticky header, sticky bulk toolbar.
- **Tablet landscape (iPad / Galaxy Tab):** the matrix scrolls horizontally inside its own
  container with a sticky first (Variation) column; the page itself never scrolls
  sideways. Detailed edits happen in the drawer.
- **Tablet portrait / phone:** the matrix collapses to stacked variant cards
  (combination · price · stock · status · edit) and all detailed editing moves to the
  drawer. The section is never hidden on any breakpoint.

## 5. Frontend-only persistence approach

No backend, Prisma, QuickBooks, or server code is touched. Variation data lives entirely
in the browser via three layers, mirroring the existing `categoryAssignmentService`
pattern and **never** touching `localStorage` from a component:

- `productExtensionAdapter` — raw namespaced localStorage read/write, keyed per product
  (edit mode uses the product id; create mode uses a `draft` key).
- `variationMockService` — load/persist/generate operations built on the adapter.
- `variationStore` — a small React hook holding in-memory state and persisting through the
  service (debounced), returned to the builder with typed actions.

Variation data is stored **separately** from the API `ProductInput` payload, so the
product save call is unchanged. `TODO(backend)` markers flag every place a real API would
plug in (a `ProductVariant` model, `POST /products/:id/variants`, SKU/barcode uniqueness,
QuickBooks mapping).
