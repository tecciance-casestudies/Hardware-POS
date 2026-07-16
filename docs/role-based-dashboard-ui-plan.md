# Role-Based Responsive Dashboards — UI Plan

Status: implemented on branch `feature/role-based-responsive-dashboards`.

## 1. Current dashboard issues

The existing `/dashboard` route (`apps/web/src/app/(app)/dashboard/page.tsx`) renders a single
generic screen for every role:

- Four static stat tiles (`Today's Sales`, `Transactions`, `Products Cached`, `Pending Syncs`)
  from `fetchDashboardStats`, plus a "Getting started" card.
- No role differentiation — an Owner and a Cashier see exactly the same thing.
- No charts, alerts, QuickBooks health, quotation pipeline, shift summary, or recent-transaction
  drill-downs.
- No loading skeletons (values flash `—`), no per-card empty/error handling, no interactivity
  (cards are decoration, not links).

## 2. Existing components / data we can reuse

Reused as-is:

- UI: `Card`, `Button`/`buttonVariants`, `Badge`, `Tooltip`, `Select`, `ProductImage`.
- Formatting: `formatMoney` (LKR), `cn`.
- Auth/roles: `useAuth().session.user.role`, `hasPermission`, `permissions.ts`.
- Real data hooks/APIs:
  - `fetchDashboardStats` → today's sales total, today's transactions, products cached, pending syncs.
  - `fetchSales` → recent transactions (number, customer, amount, payment/return/sync status, time).
  - `fetchQuotations` → quotation pipeline counts + values, open-quotation count.
  - `fetchProducts` → low-stock / out-of-stock detection (client-side on `quantityOnHand`).

No chart library exists and none is added — sparklines and bar/donut visuals are lightweight
inline SVG (no new dependency, stable dimensions → no layout shift).

## 3. Admin / Owner dashboard structure

`AdminDashboard` (title "Business Overview"):

1. Header + quick actions: New Sale (primary), Create Quote, Add Product, View Reports; refresh + last-updated.
2. KPI grid (5): Net Sales, Gross Profit\*, Transactions, Average Order Value\*, Open Quotations.
3. Sales Performance (7D/30D/3M/6M/1Y range + SVG bar chart)\*.
4. QuickBooks Integration Health (connected / waiting-to-sync / failed) — partial real.
5. Business Alerts (low stock, waiting-to-sync, open quotations, expiring quotes) — real + actionable.
6. Secondary analytics: Payment Methods\*, Top Categories\*, Quotation Pipeline (real), Recent Transactions (real).

## 4. Cashier dashboard structure

`CashierDashboard` (title "Welcome back, {name}"):

1. Header + quick actions: Start New Sale (primary), Return, Quote, Hold Sales.
2. KPI grid (4): Today's Sales, Transactions Today, Average Bill, Cash Drawer Balance/Shift\*.
3. Recent Sales (real, 6 rows, status pills, view action).
4. Quick Access (New Sale, Scan Barcode, Add Customer, Resume Hold, Create Quotation).
5. Shift Summary (open/closed, starting cash, cash/card/bank sales, expected, difference)\*.
6. Payment Methods (today)\* + Top Categories\* + Frequently Sold Items\*.

`*` = no backing API yet → served by an **isolated, dev-only demo adapter** (`lib/dashboard/demo.ts`),
rendered with a visible "Demo" badge and a production-safe empty state. Never mixed into real queries.

## 5. Role resolution

Central helper `resolveDashboardVariant(role)` in `lib/dashboard/roles.ts`:

- `OWNER`, `ADMIN`, `MANAGER`, `ACCOUNTANT` → `admin`
- `CASHIER` → `cashier`

The dashboard route renders `AdminDashboard` or `CashierDashboard` accordingly. This is **UI shaping
only** — every underlying route/API remains guarded by backend permissions; hiding a card is not
authorization. Financial cards (drawer balance, profit) additionally respect `hasPermission`.

## 6. Data-adapter approach

- `lib/dashboard/use-dashboard-data.ts` — one hook fetches real data (stats, sales, quotations,
  products) with `loading`/`error`, polls while visible, exposes a `refresh()`.
- `lib/dashboard/adapters.ts` — pure functions map raw API data → typed view-models
  (`DashboardMetric`, `AlertItem`, `PipelineStage`, …). No business math is duplicated in components.
- `lib/dashboard/demo.ts` — dev-only placeholder generators, each returning `{ isDemo: true }` and
  carrying a `// TODO(api):` marker. Guarded so production shows empty states rather than fake data.

## 7. Responsive strategy

- Shell: page fills the app content area, no horizontal overflow (`min-w-0` on every grid/flex child).
- KPI grid: `grid` with `sm:grid-cols-2`, `xl:grid-cols-4`, `2xl:grid-cols-5` (admin) / `xl:grid-cols-4` (cashier).
- Main analytics + side panels: single column on tablet, `xl:grid-cols-3` split on desktop.
- Tables scroll inside their own container; sidebar already auto-collapses ≤1279px (existing).
- Touch targets ≥44px; charts have fixed heights (no layout shift); reduced-motion respected.

## 8. Testing plan

- No JS test runner is configured in `apps/web` (no jest/vitest/playwright). Role resolution is
  therefore implemented as a pure, side-effect-free function (`resolveDashboardVariant`) that is
  trivially unit-testable once a runner is added; a `describe` block is provided as a TODO.
- Verified via `tsc --noEmit`, `next lint`, and `next build`; manual review steps in the final report.

## 9. Backend TODOs (for real data)

- Aggregations endpoint(s): net sales + gross profit, average order value, period comparisons,
  sales timeseries, payment-method split, top categories, frequently-sold items.
- Shift/register-session endpoint (starting cash, expected cash, drawer balance, difference).
- QuickBooks health endpoint (connection state, last sync, failed-sync count, unmapped products).
- Dedicated low-stock endpoint (avoid client-side scan of the product list).
