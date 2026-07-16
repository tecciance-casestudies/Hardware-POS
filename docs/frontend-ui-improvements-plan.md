# Frontend UI Improvements — Implementation Plan

_Branch: `feature/frontend-a4-category-variation-ui` · **frontend-only**. No backend,
Prisma, API-contract, QuickBooks, or auth changes._

Scope: (3) A4 sale receipt, (4) Payment page overflow, (5) Category & subcategory
management. The attached screenshots are issue references only.

---

## Current issues found

### Payment page (`app/(app)/pos/payment/page.tsx`)
- Layout was `space-y-5` + a `grid lg:grid-cols-[1fr_420px]` that simply grows. With
  **Cash** selected, the method grid + amount + quick buttons + 4-row keypad + Paid/Balance
  + print toggle + button push **Complete Payment below the fold** — the register has to
  scroll the whole page to pay. No independent scroll region; the action bar isn't pinned.

### Sale receipt / print flow
- After a sale, `SuccessView` and the sale-detail "Print receipt" call
  `printCustomerReceipt` / `reprintCustomerReceipt` → the **thermal** (~320px monospace)
  layout. `printAfter` auto-print is also thermal.
- A proper **A4 bill already exists server-side** (`GET /documents/sales/:id`, configurable
  via Settings → Documents), but it's only reachable from sale-detail "A4 bill" (opens a
  popup, no auto-print). A4 is not the default and the Success screen offers no A4 action.

### Category management (`app/(app)/products/categories/page.tsx`)
- The page already supports category + subcategory CRUD, activate/deactivate, reorder,
  product counts, and re-parenting a subcategory. But: **no search**, and — critically —
  **the page is unreachable**: nothing in the nav or Products page links to it.
- Subcategories are strictly **one-parent** (`Subcategory.categoryId`). The requested
  *reusable / shared* subcategory library (many-to-many assignment) is **not** in the
  backend model, so it must be a frontend-only feature.

---

## Components reused (not rebuilt)
- `ui/button` (upgraded earlier: `isLoading`, `leftIcon`, `asChild`, sizes), `ui/card`,
  `ui/input`, `ui/select`, `ui/switch`, `ui/dialog`, `Numpad`, `Row` (payment page).
- Existing data APIs: `lib/sales.ts` (`fetchSale`, `SaleDetail`), `lib/settings-api.ts`
  (`fetchSettings().documents` — the document/business profile), `lib/products-api.ts`
  (category CRUD), `lib/auth` (`session` → branch / register / cashier name).

## Components refactored / added
- **Refactor** `pos/payment/page.tsx` → viewport-locked two-panel layout with a pinned
  action bar (Section 4).
- **Add** `lib/document-template-service.ts` — adapter that resolves the business/document
  profile (real `/settings` API, LocalStorage fallback + backend TODOs).
- **Add** `components/documents/sale-a4-document.tsx` — native React `SaleA4Document` with
  A4 print CSS.
- **Add** shell-free print route `app/print/sales/[saleId]/page.tsx` (outside `(app)` so no
  sidebar/header), with Preview / Print / Back actions that don't print.
- **Wire** `SuccessView` + sale-detail print + `printAfter` to the A4 route (thermal kept as
  an optional secondary action).
- **Add** `lib/category-assignments.ts` — LocalStorage mock adapter for the reusable
  subcategory library + a search box and a "Manage categories" link (Section 5).

## Frontend-only mock-data approach
- Mock logic lives in dedicated services (`document-template-service.ts`,
  `category-assignments.ts`), **never inside components**. Each exposes typed interfaces and
  carries `TODO(backend)` comments describing the real endpoint that should replace it.
- Persistence via `localStorage` keyed by tenant; adapters read the real API first where one
  exists (document profile) and fall back to mock only when unavailable.

## Responsive layout approach
- Reuse the shell's viewport lock (`h-dvh`, `main` = the only scroll). Pages fill height with
  `flex/grid` + `min-h-0` + `min-w-0`; inner regions use `overflow-y-auto`; action bars are
  `shrink-0` / `sticky bottom-0` with `env(safe-area-inset-bottom)` padding. Verified at
  1024×768, 1180×820, 1194×834, 1280×800, 1366×1024, 1440×900.

## A4 printing approach
- Native React A4 doc sized `210mm`, `@page { size: A4 portrait }`, print-only CSS that
  hides the app chrome + on-screen controls, `break-inside: avoid` rows, repeating `<thead>`
  via `display: table-header-group`, totals block `break-inside: avoid`, page counter.
  Rendered on a shell-free route so nothing from the app shell prints. LKR only (`Rs.`).
