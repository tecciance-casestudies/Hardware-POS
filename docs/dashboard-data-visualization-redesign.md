# AxloPOS — Dashboard Data-Visualization Redesign

_"Axlo Business Command Centre" — a colourful, accessible, operationally trustworthy admin dashboard._

Branch: `feature/colorful-dashboard-data-visualization` (off `feature/axlo-design-system-theme`).
Scope: **primarily frontend UI/UX**, with one small **additive, non-breaking** backend change (real
per-method / per-category counts). No existing API contract, calculation, permission, QuickBooks,
currency, date-filtering, theme or design-token behaviour was changed.

---

## 1. Current UX issues (audit)

The existing admin dashboard ([apps/web/src/components/dashboard/admin-dashboard.tsx](../apps/web/src/components/dashboard/admin-dashboard.tsx))
was structurally sound but visually flat:

- **Uniform surfaces** — nearly every card used the same `bg-card` dark surface, so nothing led the eye.
- **Teal monotony** — KPIs, charts, progress bars and links all leaned on the same teal, flattening hierarchy.
- **Weak section distinction** — critical/warning/informational/analytical content competed at equal weight.
- **Payment Methods** was a stack of single-colour progress bars — no share-of-whole story, no counts.
- **Top Categories** used bars scaled to the leader only (no contribution %, no ranking metric choice).
- **QuickBooks Health** showed "Connected" next to a status dot that could be red — a contradictory signal.
- **Inventory Attention** was two dotted rows; **Recent Activity** had no activity-type affordance.
- No chart/data toggle; screen-reader users depended on `sr-only` tables but sighted keyboard users had none.

## 2. Current chart library

**None.** The project has no charting dependency (no Recharts/Chart.js/D3/visx). Charts are hand-authored
SVG/HTML:

- [charts.tsx](../apps/web/src/components/dashboard/charts.tsx) — `AreaChart` (fixed-viewBox SVG, gradient
  fill, hover/tap tooltip, dashed comparison series, `role="img"` + `sr-only` data table), `Sparkline`,
  `AnimatedNumber` (reduced-motion aware).

**Decision (per §20):** reuse the existing hand-rolled SVG/HTML approach. It already satisfies every
requirement — doughnut + horizontal bar, responsive sizing, theme-aware colours (CSS variables),
accessible labels, reduced-motion, no layout shift — at **zero added bundle cost**. A library would only
add weight and a second styling system. **No chart library was installed.**

## 3. Components reused (unchanged public API)

`SectionCard`, `SegmentedControl` (chart/metric/filter toggles), `StatusPill`, `Badge`, `EmptyState`,
`ErrorState`, `CardSkeleton`, `KpiSkeleton`, `KPIGrid`, `Reveal`, `AreaChart`, `Sparkline`,
`AnimatedNumber`, `DashboardHero`, `useDashboardData`, `buildComparison`, `paymentStatusMeta`.

## 4. Components refactored / added

**Added**

- [lib/dashboard/chart-tokens.ts](../apps/web/src/lib/dashboard/chart-tokens.ts) — central colour tokens +
  pure transforms: `dashboardChartTokens`, `paymentMethodColorMap`, `categoryChartColorScale`,
  `buildPaymentBreakdown` (metric-aware, minor-method grouping), `buildCategoryBars`,
  `formatDashboardCurrency`, `formatDashboardPercentage`, `formatCategoryMetric`,
  `createAccessibleChartSummary`.
- [components/dashboard/data-charts.tsx](../apps/web/src/components/dashboard/data-charts.tsx) — reusable
  `Doughnut`, `HorizontalBars`, `ChartDataTable` primitives.

**Refactored**

- `MetricCard` / `Trend` — hero gradient + tinted-surface + coloured-icon-well treatments (`surface`,
  `iconAccent`).
- `SectionCard` — optional `headerClassName` / `iconClassName` for subtle tinted headers.
- `PaymentMethodsCard` → interactive doughnut + legend + chart/data toggle + Amount/Transactions toggle.
- `TopCategoriesCard` → ranked horizontal bars + Revenue/Units/Sales metric toggle + chart/data toggle.
- `QuickBooksHealthCard` → split **Connection** vs **Operational** status + segmented health bar.
- `AdminAlerts` (Business Attention) → severity left-accent + tinted rows + critical/warning counts + filter.
- `InventoryAttentionCard` → semantic icon wells (+ TODO for image/category/mapping breakdowns).
- `RecentActivityCard` → per-status activity-type icon glyphs (table + card modes).
- `AreaChart` — Flow-Aqua line/area, Digital-Slate dashed comparison, Volt-Lime selected marker.

## 5. Chart-selection rationale

| Section | Chart | Why |
|---|---|---|
| Sales Performance | Area line + comparison | Trend over time; previous-period overlay for context. |
| Payment Methods | **Doughnut** (~70% cutout) | Part-to-whole of *collected revenue*; centre carries the total. |
| Top Categories | **Sorted horizontal bars** | Accurate **rank + compare**; a pie can't be read precisely (§10). |
| QuickBooks Health | Segmented status bar | Compact healthy/waiting/failed composition from real counts. |

## 6. Colour strategy (three layers, per §5)

- **Layer 1 — Brand:** Kinetic Teal (primary), Flow Aqua (secondary), Volt Lime (small highlights only —
  selected point, current-period accent; never a large surface).
- **Layer 2 — Semantic:** Success/Warning/Error/Info retain their meanings and are **never** used as
  decorative chart series.
- **Layer 3 — Neutral:** Midnight/dark-card surfaces, Slate text, neutral dividers carry most of the UI.

All colours are CSS custom properties centralised in [globals.css](../apps/web/src/app/globals.css)
(`--pm-*` payment identity, `--cat-*` category ramp, `--sem-chart-highlight`) and referenced only through
[chart-tokens.ts](../apps/web/src/lib/dashboard/chart-tokens.ts). **No raw hex lives in feature components.**
Payment-method colours follow the approved mapping (Cash=Teal, Card=Aqua, Bank=Info, QR=Lime, Credit=Slate,
Other=Grey); the darkest hues are lifted in dark mode for contrast.

## 7. Accessibility strategy (§19)

- Every chart has an accessible `role="img"` label **and** a plain-language text summary built by
  `createAccessibleChartSummary` (real percentages, not tooltip-only).
- A visible **Data** view (`ChartViewToggle` → `ChartDataTable`) exposes exact values to *all* users, not
  just screen readers.
- Non-colour identification everywhere: rank badges, text labels, status dots + text, activity glyphs.
- Legend rows and bars are real focusable `<button>`s (keyboard select + navigate).
- Reduced motion respected globally (CSS) and in `AnimatedNumber`; doughnut/bars animate once on mount only.
- Focus ring is Flow Aqua in both themes; contrast tuned per theme.

## 8. Responsive strategy (§17)

Container-query driven (`@container`) so the grid reflows to *content* width (sidebar expand/collapse) not
just viewport. Sales Performance 8-col / attention 4-col on desktop; Payment + Categories + QuickBooks
balance to thirds; Recent Activity table collapses to cards below `560px` content width; doughnut legend
sits below the ring; horizontal bars stay horizontal at every size. No horizontal overflow (`min-w-0`
guards throughout).

## 9. Data limitations & honesty (§22)

Real API data only — nothing fabricated.

- **Payment transaction counts** and **category units/sales counts** were **not** previously exposed. Rather
  than invent them, a small **additive** backend change now returns them (`_count` on the payment `groupBy`;
  `COUNT(DISTINCT sale)` + `SUM(quantity)` in the category query). Existing consumers ignore the new fields.
  If counts are absent (0), the Amount/Transactions toggle hides itself gracefully.
- **QuickBooks** "missing mappings" count and "last successful sync" time are not in the API →
  `TODO(api)` left in code; the card shows only real values (waiting / failed).
- **Inventory** exposes only out-of-stock / low-stock today → `TODO(api)` for image/category/mapping rows.
- All displayed percentages derive from the **same total** the chart represents (metric-consistent).
- Handled: zero values, negative/refund amounts (filtered to positive for shares), single-method 100%,
  unknown payment types (→ Other), >6 methods (→ largest 5 + Other), very small % (1-decimal), large LKR.

## 10. Testing

The **web workspace had no test runner** (only `@hardware-pos/api` has Jest — 41 tests still passing). The
pure transforms in `chart-tokens.ts` are isolated and framework-free specifically so they are unit-testable;
Vitest specs cover payment breakdown (multi/one-100%/none/Other/toggle), category bars
(sort/metric/contribution), grouping, percentage formatting and accessible summaries. Quality gates —
**typecheck, lint, production build** — all pass for both apps.

## 11. Manual review checklist

**Dark mode** — verify Net Sales hero gradient legible (white text, lime trend); doughnut segments distinct
on Midnight (Cash teal lifted); category bars read as one Teal→Aqua system; QuickBooks never shows
"Connected" beside red; Business Attention accents subtle (no full-red rows); no horizontal scroll at
1440/1280/1024/tablet/mobile; sidebar collapse reflows KPIs.

**Light mode** — Axlo Cloud canvas, white cards; aqua/teal surfaces stay readable (no saturated card
backgrounds); Volt-Lime highlight uses the darkened light-mode value; tinted headers subtle; contrast holds.
