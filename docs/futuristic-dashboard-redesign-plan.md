# Futuristic Responsive Dashboard Redesign — Implementation Plan

**Branch:** `feature/futuristic-responsive-dashboards` (from `main` @ `03613c6`)
**Scope:** Front-end presentation/UX of the role-based dashboards only. Backend
contracts, API hooks, calculations, auth, permissions, QuickBooks integration and
routing are preserved. Where the redesign needs shaping, it uses **presentation
adapters / view-models** (`lib/dashboard/*`), never new business math.

> Currency is always Sri Lankan Rupees rendered as `Rs. 1,250.00` via the shared
> `formatMoney` (`formatCurrency` in `@hardware-pos/shared`). No USD/$ anywhere.

---

## 1. Existing UX problems

The current dashboards are functional and already responsive, but read as a
generic SaaS report rather than an operational command centre:

- **Flat visual hierarchy.** Every card is the same white box with the same
  border/shadow; no sense of "what matters now". No hero/greeting zone.
- **Static KPI values.** Numbers snap in; no count-up, weak trend affordance,
  sparklines only on 1–2 cards.
- **Primitive chart.** `MiniBarChart` is a fixed bar strip with no hover tooltip,
  no previous-period comparison, no accessible textual summary, single metric.
- **No global search / command surface.** No `Cmd/Ctrl+K`, no "start a sale from
  anywhere" affordance — a hallmark of a modern operations console.
- **Header is thin.** Branch/register are read-only text; logout is a lone icon;
  no consolidated profile menu.
- **Ungrouped sidebar.** A flat 9-item list; no visual grouping, weak active
  indicator, no section rhythm.
- **Admin layout is a uniform 3-up / 4-up grid** — no asymmetric emphasis, so the
  hero metrics and the attention queue carry the same weight as minor cards.
- **Cashier dashboard mixes analytics into an operational task surface** (top
  categories, frequent items) and buries the shift + quick actions.
- **Motion / reduced-motion** is not addressed.

## 2. Existing reusable components (keep / extend)

- **Shell:** `app/(app)/layout.tsx` (viewport-locked, `main` owns scroll),
  `components/sidebar.tsx`, `components/header.tsx`, `lib/sidebar.tsx`
  (collapse persistence + mobile drawer), `components/sync-status.tsx`.
- **UI kit:** `ui/button.tsx` (rich CVA variants + touch sizes), `ui/badge.tsx`,
  `ui/card.tsx`, `ui/tooltip.tsx`, `product-image.tsx`.
- **Dashboard data:** `lib/dashboard/use-dashboard-data.ts` (single
  `Promise.allSettled` source, 30 s visible-tab polling, per-panel degradation),
  `lib/dashboard/adapters.ts` (pure view-model builders), `lib/dashboard/types.ts`,
  `lib/dashboard-api.ts`, `lib/dashboard/roles.ts` (central role → variant).
- **Tokens:** `app/globals.css` `@theme` (blue brand scale, semantic
  success/warning/danger, `--radius-card`).

## 3. Components requiring refactoring

| Component | Action |
| --- | --- |
| `dashboard/primitives.tsx` | Rebuild: count-up `MetricCard`, richer `SectionCard`, `SegmentedControl`, dot+label `StatusPill`, `Trend`, states. |
| `dashboard/admin-dashboard.tsx` | Recompose into an asymmetric 12-col command centre. |
| `dashboard/cashier-dashboard.tsx` | Recompose into a task-first operational workspace. |
| `components/header.tsx` | Add `Cmd/Ctrl+K` command trigger + consolidated profile menu. |
| `components/sidebar.tsx` + `lib/nav.ts` | Grouped nav sections + refined active rail. |
| `app/globals.css` | Add elevation/gradient/chart/motion tokens + reduced-motion. |

**New files:** `dashboard/charts.tsx` (accessible SVG area/line chart + hover
tooltip + `useCountUp`), `dashboard/hero.tsx` (`DashboardHero`),
`components/command-palette.tsx`.

## 4. Admin dashboard information architecture

Business command centre — "what's happening, what changed, what needs attention,
what to do next":

1. **Hero** — time-of-day greeting, branch + date-range + last-updated meta;
   primary **New Sale**; secondary **Create Quote / Add Product / Reports**
   (collapse to a **More** menu on small widths); **Refresh**.
2. **KPI band (row 1)** — Net Sales · Gross Profit (gated on `REPORT_READ`) ·
   Transactions · Avg Order Value · Open Quotations. Count-up + trend + sparkline.
3. **Row 2** — **Sales Performance** (7/8 col, interactive range + area chart +
   prev-period comparison + a11y summary) · **Business Attention** (4/5 col,
   severity-sorted real alerts).
4. **Row 3** — **Payment Methods** · **Top Categories** · **QuickBooks Health**.
5. **Row 4** — **Recent Business Activity** table (8 col) · **Inventory
   Attention** (4 col).
   Quotation pipeline folds into row 3/4 area.

## 5. Cashier dashboard information architecture

Simpler, action-first operational workspace (no confidential business-wide
financials):

1. **Hero** — greeting + register-ready line; primary **Start New Sale**;
   secondary **Create Quote / Process Return** (permission-gated).
2. **KPI band** — Shift Sales · Transactions · Average Bill · Expected Cash.
3. **Row 2** — **Current Shift** (7 col) · **Quick Actions** (5 col, large
   touch tiles).
4. **Row 3** — **Recent Sales** (8 col) · **Register Health** (4 col).

## 6. Responsive strategy

- **Container-query driven** (`@container`) so the grid re-balances on
  sidebar collapse/expand at the same viewport — not just on browser width.
- 12-column CSS grid with explicit balanced spans per breakpoint; `min-width:0`
  on every track; no fixed card widths; no orphan cards (odd trailing KPI spans).
- Ladder: `<640` 1-col → `640–1023` 2-col → `1024–1279` compact 12-col →
  `≥1280` full asymmetric 12-col → `≥1536` wide activity table.
- Tablet portrait / mobile: drawer nav, stacked charts, activity **cards**
  instead of wide tables. No horizontal page scroll (shell already locks it).

## 7. Accessibility strategy (WCAG 2.2 AA)

- Semantic landmarks + heading order; every icon-only control has an accessible
  name; ≥44px touch targets (button `md`/`icon-md` = 44px).
- Colour never the sole status signal — status pills carry dot **and** text.
- Charts expose a `role="img"` + textual summary and a visually-hidden data table.
- Command palette + profile menu: focus trap, `Esc` to close, focus restore,
  `aria-activedescendant` listbox pattern, roving selection.
- Visible focus rings (already global); `prefers-reduced-motion` disables
  count-up, entrance and chart transitions.

## 8. Data-source mapping (real endpoints only)

| Surface | Source |
| --- | --- |
| Net Sales / Transactions / AOV | `fetchDashboardStats` (today) + `fetchDashboardSummary` (7-day + prev). |
| Gross Profit | `summary.grossProfit` (gated `REPORT_READ`). |
| Sales Performance chart | `fetchSalesSeries({from})` per range. |
| Payment mix | `fetchPaymentMethods({mine})`. |
| Top categories | `fetchTopCategories`. |
| Frequent items (cashier) | `fetchTopProducts({mine})`. |
| Shift | `fetchShiftSummary` → `buildShiftSummary`. |
| Quotation pipeline / open count | `fetchQuotations` → `buildQuotationPipeline`. |
| Stock alerts / inventory | `fetchStockCounts` (`outOfStock`, `lowStock`). |
| QuickBooks health | `buildQuickBooksHealth(stats, failedSyncs)` + `/sync/status` pill. |
| Recent activity | `fetchSales({pageSize})`. |

## 9. Mock-data limitations (things we must NOT fabricate)

- **No** product-without-image / -category / -QuickBooks-mapping counts →
  Inventory Attention shows only the two real stock states + honest empty states.
- **No** customer outstanding/overdue balance API → that alert is omitted.
- **No** held-sales / drawer-session feature → "Resume Hold" stays disabled with
  an explanatory tooltip (never faked); shift drawer variance stays `0`
  ("Balanced") because there is no physical drawer count.
- **No** register cash-variance / printer / scanner telemetry → Register Health
  reports only what is knowable (register open time from shift, live sync queue
  from `/sync/status`); hardware rows are shown as "Not monitored" rather than a
  fake "connected".
- No demo/fake values are introduced anywhere; every number traces to an endpoint.

## 10. Testing strategy

- **No JS test runner exists in `apps/web`** (only `apps/api` has one). Adding a
  framework is out of the front-end-only scope and would add dependencies, so we
  follow the repo's existing convention: keep all logic in **pure, exported,
  unit-testable** view-model functions (`lib/dashboard/adapters.ts`,
  `roles.ts`, and the new `greetingFor`, chart-scaling, count-up easing) with
  documented `TODO(test)` cases matching the current `roles.ts` precedent.
- Verification gates actually run: `pnpm --filter @hardware-pos/web typecheck`,
  `pnpm --filter @hardware-pos/web lint`, and `next build`.
- Manual review matrix: role resolution, each card's loading/empty/error state,
  the responsive resolutions listed in the brief, keyboard nav for palette +
  profile menu, and reduced-motion.

## 11. Removed / replaced (with UX reason)

- **"Products Cached" is never surfaced** as a metric (technical, not
  operational). — Confidential/technical metric with no user value.
- **Cashier "Top Categories" + "Frequently Sold Items" analytics blocks** are
  removed from the cashier surface — analytics belong on the Admin console; the
  cashier surface is task-first. (Frequent-items data still powers Admin.)
- **Raw QuickBooks error/stack detail** is never shown — plain-language health
  states only.

## 12. Component architecture (target)

```
lib/dashboard/roles.ts        resolveDashboardVariant, greetingFor (pure)
lib/dashboard/adapters.ts     view-model builders (pure)
lib/dashboard/types.ts        view-model types
components/dashboard/
  charts.tsx                  AreaChart (a11y), useCountUp
  primitives.tsx              MetricCard, SectionCard, SegmentedControl, StatusPill, states
  hero.tsx                    DashboardHero
  admin-dashboard.tsx         AdminDashboard composition
  cashier-dashboard.tsx       CashierDashboard composition
components/command-palette.tsx  Cmd/Ctrl+K action search (permission-aware)
```

Separation preserved: fetching (`use-dashboard-data`), transformation
(`adapters`), permission resolution (`roles` + `hasPermission`), presentation
(components), chart config (`charts`).
