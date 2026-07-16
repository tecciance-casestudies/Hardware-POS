'use client';

import {
  ArrowDownUp,
  ChevronDown,
  Columns3,
  Filter as FilterIcon,
  Layers,
  Pencil,
  Search,
  SlidersHorizontal,
  Wand2,
  X,
} from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { PriceMode, Variant } from '@/lib/variations/types';
import {
  variantChips,
  variantLabel,
  variantValidationIssues,
} from '@/lib/variations/variation-combination-utils';
import type { VariationStore } from '@/lib/variations/variation-store';

import { StatPill, StockBadge, effectivePrice, formatLkr, stockStateOf } from './shared';

type FilterKey =
  | 'active'
  | 'inactive'
  | 'in'
  | 'low'
  | 'out'
  | 'base'
  | 'custom'
  | 'no-sku'
  | 'no-barcode'
  | 'no-price';

const FILTER_GROUPS: { label: string; options: { key: FilterKey; label: string }[] }[] = [
  {
    label: 'Status',
    options: [
      { key: 'active', label: 'Active' },
      { key: 'inactive', label: 'Inactive' },
    ],
  },
  {
    label: 'Stock',
    options: [
      { key: 'in', label: 'In stock' },
      { key: 'low', label: 'Low stock' },
      { key: 'out', label: 'Out of stock' },
    ],
  },
  {
    label: 'Price',
    options: [
      { key: 'base', label: 'Uses base price' },
      { key: 'custom', label: 'Custom price' },
    ],
  },
  {
    label: 'Missing',
    options: [
      { key: 'no-sku', label: 'Missing SKU' },
      { key: 'no-barcode', label: 'Missing barcode' },
      { key: 'no-price', label: 'Missing price' },
    ],
  },
];

type SortField = 'combination' | 'sku' | 'price' | 'cost' | 'stock' | 'reorder';

export function VariantMatrix({
  store,
  basePrice,
  selectedKeys,
  onToggleKey,
  onToggleAll,
  editedKeys,
  onEditVariant,
  onOpenBulk,
  markEdited,
}: {
  store: VariationStore;
  basePrice: number;
  selectedKeys: string[];
  onToggleKey: (key: string) => void;
  onToggleAll: (keys: string[]) => void;
  editedKeys: Set<string>;
  onEditVariant: (v: Variant) => void;
  onOpenBulk: () => void;
  markEdited: (k: string) => void;
}) {
  const { data } = store;
  const [search, setSearch] = React.useState('');
  const [filters, setFilters] = React.useState<Set<FilterKey>>(new Set());
  const [sortField, setSortField] = React.useState<SortField>('combination');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');
  const [showFilters, setShowFilters] = React.useState(false);
  // Simplified table by default; barcode/cost/reorder are the "advanced" columns.
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [showQuickSetup, setShowQuickSetup] = React.useState(true);

  const selected = React.useMemo(() => new Set(selectedKeys), [selectedKeys]);

  const stats = React.useMemo(() => {
    let active = 0;
    let outOfStock = 0;
    let custom = 0;
    let missingSku = 0;
    for (const v of data.variants) {
      if (v.active) active += 1;
      if (v.stock <= 0) outOfStock += 1;
      if (v.price != null) custom += 1;
      if (!v.sku.trim()) missingSku += 1;
    }
    return { total: data.variants.length, active, outOfStock, custom, missingSku };
  }, [data.variants]);

  const visible = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = data.variants.filter((v) => {
      // search
      if (q) {
        const hay = `${variantLabel(data.attributes, v.selections)} ${v.sku} ${v.barcode}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      // grouped filters — OR within a group, AND across groups
      const state = stockStateOf(v);
      const statusF: FilterKey[] = [];
      if (filters.has('active')) statusF.push('active');
      if (filters.has('inactive')) statusF.push('inactive');
      if (statusF.length && !((filters.has('active') && v.active) || (filters.has('inactive') && !v.active)))
        return false;

      const stockF = ['in', 'low', 'out'].filter((k) => filters.has(k as FilterKey));
      if (stockF.length && !stockF.includes(state)) return false;

      if (filters.has('base') || filters.has('custom')) {
        const isBase = v.price == null;
        if (!((filters.has('base') && isBase) || (filters.has('custom') && !isBase))) return false;
      }

      const missing: boolean[] = [];
      if (filters.has('no-sku')) missing.push(!v.sku.trim());
      if (filters.has('no-barcode')) missing.push(!v.barcode.trim());
      if (filters.has('no-price')) missing.push(v.price == null && data.priceMode === 'individual');
      if (missing.length && !missing.some(Boolean)) return false;

      return true;
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      switch (sortField) {
        case 'sku':
          av = a.sku.toLowerCase();
          bv = b.sku.toLowerCase();
          break;
        case 'price':
          av = effectivePrice(a, basePrice);
          bv = effectivePrice(b, basePrice);
          break;
        case 'cost':
          av = a.cost ?? -1;
          bv = b.cost ?? -1;
          break;
        case 'stock':
          av = a.stock;
          bv = b.stock;
          break;
        case 'reorder':
          av = a.reorderLevel ?? -1;
          bv = b.reorderLevel ?? -1;
          break;
        default:
          av = variantLabel(data.attributes, a.selections).toLowerCase();
          bv = variantLabel(data.attributes, b.selections).toLowerCase();
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return rows;
  }, [data.variants, data.attributes, data.priceMode, search, filters, sortField, sortDir, basePrice]);

  const toggleFilter = (key: FilterKey) =>
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const visibleKeys = visible.map((v) => v.key);
  const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every((k) => selected.has(k));

  // Grouping
  const groups = React.useMemo(() => {
    if (!data.groupBy) return null;
    const attr = data.attributes.find((a) => a.id === data.groupBy);
    if (!attr) return null;
    const map = new Map<string, { label: string; rows: Variant[] }>();
    for (const opt of attr.options) map.set(opt.id, { label: opt.value, rows: [] });
    for (const v of visible) {
      const optId = v.selections[attr.id];
      const bucket = optId ? map.get(optId) : undefined;
      if (bucket) bucket.rows.push(v);
    }
    return [...map.entries()].map(([id, g]) => ({ id, ...g })).filter((g) => g.rows.length > 0);
  }, [data.groupBy, data.attributes, visible]);

  const invalidCount = React.useMemo(
    () => data.variants.filter((v) => variantValidationIssues(v, data.priceMode).length > 0).length,
    [data.variants, data.priceMode],
  );

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <StatPill label="Total variants" value={stats.total} tone="brand" />
        <StatPill label="Active" value={stats.active} tone="success" />
        <StatPill label="Out of stock" value={stats.outOfStock} tone={stats.outOfStock ? 'warning' : 'neutral'} />
        <StatPill label="Custom price" value={stats.custom} />
        <StatPill label="Missing SKU" value={stats.missingSku} tone={stats.missingSku ? 'danger' : 'neutral'} />
      </div>

      {/* Price strategy + grouping */}
      <div className="grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="price-mode">Price strategy</Label>
          <Select
            id="price-mode"
            value={data.priceMode}
            onChange={(e) => store.setPriceMode(e.target.value as PriceMode)}
          >
            <option value="single">One price for all variants</option>
            <option value="base-overrides">Base price + custom overrides</option>
            <option value="individual">Individual price per variant</option>
          </Select>
          <p className="text-xs text-muted-foreground">
            {data.priceMode === 'single'
              ? `Every variant sells at the base price (${formatLkr(basePrice)}).`
              : data.priceMode === 'individual'
                ? 'Each variant needs its own price.'
                : `Defaults to the base price (${formatLkr(basePrice)}); override any variant.`}
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="group-by">Group by</Label>
          <Select
            id="group-by"
            value={data.groupBy ?? ''}
            onChange={(e) => store.setGroupBy(e.target.value || null)}
          >
            <option value="">No grouping (flat list)</option>
            {data.attributes
              .filter((a) => a.options.length > 0)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name.trim() || 'Attribute'}
                </option>
              ))}
          </Select>
          <p className="text-xs text-muted-foreground">Collapse variants into groups for large sets.</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search combinations, SKU, barcode"
            className="pl-9"
            aria-label="Search variants"
          />
        </div>
        <Button
          variant={showFilters || filters.size ? 'secondary' : 'outline'}
          leftIcon={<FilterIcon className="h-4 w-4" />}
          onClick={() => setShowFilters((s) => !s)}
        >
          Filter{filters.size ? ` (${filters.size})` : ''}
        </Button>
        <div className="flex items-center gap-1">
          <div className="relative">
            <ArrowDownUp className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="w-40 pl-9"
              aria-label="Sort by"
            >
              <option value="combination">Combination</option>
              <option value="sku">SKU</option>
              <option value="price">Selling price</option>
              <option value="cost">Cost</option>
              <option value="stock">Stock</option>
              <option value="reorder">Reorder level</option>
            </Select>
          </div>
          <Button
            variant="outline"
            size="icon"
            aria-label={`Sort ${sortDir === 'asc' ? 'ascending' : 'descending'}`}
            onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
          >
            <span className="text-sm font-semibold">{sortDir === 'asc' ? '↑' : '↓'}</span>
          </Button>
        </div>
        <Button
          variant="outline"
          leftIcon={<Columns3 className="h-4 w-4" />}
          onClick={() => setShowAdvanced((s) => !s)}
          aria-pressed={showAdvanced}
          title="Show or hide advanced columns (barcode, cost, reorder level)"
        >
          {showAdvanced ? 'Hide advanced' : 'Advanced columns'}
        </Button>
        <Button
          leftIcon={<SlidersHorizontal className="h-4 w-4" />}
          disabled={selectedKeys.length === 0}
          onClick={onOpenBulk}
        >
          Bulk edit{selectedKeys.length ? ` (${selectedKeys.length})` : ''}
        </Button>
      </div>

      {/* Quick setup: apply values to every combination before fine-tuning rows */}
      {data.variants.length > 0 ? (
        <QuickSetup
          store={store}
          basePrice={basePrice}
          open={showQuickSetup}
          onToggle={() => setShowQuickSetup((s) => !s)}
          onApplied={(keys) => keys.forEach(markEdited)}
        />
      ) : null}

      {/* Filter panel */}
      {showFilters ? (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Filters</h4>
            {filters.size ? (
              <button
                type="button"
                onClick={() => setFilters(new Set())}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <X className="h-3 w-3" /> Clear filters
              </button>
            ) : null}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FILTER_GROUPS.map((group) => (
              <div key={group.label}>
                <div className="mb-1.5 text-xs font-medium text-muted-foreground">{group.label}</div>
                <div className="flex flex-wrap gap-1.5">
                  {group.options.map((opt) => {
                    const on = filters.has(opt.key);
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleFilter(opt.key)}
                        className={cn(
                          'rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors',
                          on
                            ? 'border-brand-600 bg-brand-50 text-brand-700'
                            : 'border-border bg-surface hover:bg-muted',
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {invalidCount > 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-danger-soft bg-danger-soft px-4 py-2.5 text-sm text-danger">
          <Badge variant="danger">{invalidCount}</Badge>
          {invalidCount === 1 ? 'variant needs attention' : 'variants need attention'} — highlighted below.
        </div>
      ) : null}

      {/* Empty (no matches) */}
      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {data.variants.length === 0
            ? 'No variants generated yet. Go back to Combinations and generate them.'
            : 'No variants match your search or filters.'}
          {data.variants.length > 0 && (search || filters.size) ? (
            <div className="mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setFilters(new Set());
                }}
              >
                Clear search &amp; filters
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          {/* Desktop / landscape table */}
          <div className="hidden overflow-x-auto rounded-2xl border border-border lg:block">
            <table className={cn('w-full border-collapse text-sm', showAdvanced ? 'min-w-[64rem]' : 'min-w-[44rem]')}>
              <thead className="sticky top-0 z-10 bg-muted/70 backdrop-blur">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="sticky left-0 z-20 w-10 bg-muted/70 px-3 py-2.5">
                    <input
                      type="checkbox"
                      aria-label="Select all visible variants"
                      checked={allVisibleSelected}
                      onChange={() => onToggleAll(visibleKeys)}
                      className="h-4 w-4 rounded border-border"
                    />
                  </th>
                  <th className="sticky left-10 z-20 bg-muted/70 px-3 py-2.5 font-medium">Variation</th>
                  <th className="px-3 py-2.5 font-medium">SKU</th>
                  {showAdvanced ? <th className="px-3 py-2.5 font-medium">Barcode</th> : null}
                  <th className="px-3 py-2.5 text-right font-medium">Selling price</th>
                  {showAdvanced ? <th className="px-3 py-2.5 text-right font-medium">Cost</th> : null}
                  <th className="px-3 py-2.5 text-right font-medium">Stock</th>
                  {showAdvanced ? <th className="px-3 py-2.5 text-right font-medium">Reorder</th> : null}
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 text-right font-medium">Edit</th>
                </tr>
              </thead>
              {groups ? (
                groups.map((g) => (
                  <GroupBody
                    key={g.id}
                    title={g.label}
                    rows={g.rows}
                    store={store}
                    basePrice={basePrice}
                    selected={selected}
                    editedKeys={editedKeys}
                    onToggleKey={onToggleKey}
                    onEditVariant={onEditVariant}
                    markEdited={markEdited}
                    showAdvanced={showAdvanced}
                  />
                ))
              ) : (
                <tbody>
                  {visible.map((v) => (
                    <MatrixRow
                      key={v.key}
                      variant={v}
                      store={store}
                      basePrice={basePrice}
                      selected={selected.has(v.key)}
                      edited={editedKeys.has(v.key)}
                      onToggleKey={onToggleKey}
                      onEditVariant={onEditVariant}
                      markEdited={markEdited}
                      showAdvanced={showAdvanced}
                    />
                  ))}
                </tbody>
              )}
            </table>
          </div>

          {/* Portrait / phone cards */}
          <div className="space-y-2 lg:hidden">
            {groups
              ? groups.map((g) => (
                  <CardGroup
                    key={g.id}
                    title={g.label}
                    rows={g.rows}
                    store={store}
                    basePrice={basePrice}
                    selected={selected}
                    editedKeys={editedKeys}
                    onToggleKey={onToggleKey}
                    onEditVariant={onEditVariant}
                  />
                ))
              : visible.map((v) => (
                  <VariantCard
                    key={v.key}
                    variant={v}
                    store={store}
                    basePrice={basePrice}
                    selected={selected.has(v.key)}
                    edited={editedKeys.has(v.key)}
                    onToggleKey={onToggleKey}
                    onEditVariant={onEditVariant}
                  />
                ))}
          </div>
        </>
      )}
    </div>
  );
}

// --- table row ---

function GroupBody({
  title,
  rows,
  store,
  basePrice,
  selected,
  editedKeys,
  onToggleKey,
  onEditVariant,
  markEdited,
  showAdvanced,
}: {
  title: string;
  rows: Variant[];
  store: VariationStore;
  basePrice: number;
  selected: Set<string>;
  editedKeys: Set<string>;
  onToggleKey: (k: string) => void;
  onEditVariant: (v: Variant) => void;
  markEdited: (k: string) => void;
  showAdvanced: boolean;
}) {
  const [open, setOpen] = React.useState(true);
  return (
    <tbody>
      <tr className="border-t border-border bg-muted/40">
        <td colSpan={showAdvanced ? 10 : 7} className="px-3 py-2">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-2 text-sm font-semibold"
            aria-expanded={open}
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform', !open && '-rotate-90')} />
            {title}
            <Badge variant="neutral">{rows.length}</Badge>
          </button>
        </td>
      </tr>
      {open
        ? rows.map((v) => (
            <MatrixRow
              key={v.key}
              variant={v}
              store={store}
              basePrice={basePrice}
              selected={selected.has(v.key)}
              edited={editedKeys.has(v.key)}
              onToggleKey={onToggleKey}
              onEditVariant={onEditVariant}
              markEdited={markEdited}
              showAdvanced={showAdvanced}
            />
          ))
        : null}
    </tbody>
  );
}

function MatrixRow({
  variant,
  store,
  basePrice,
  selected,
  edited,
  onToggleKey,
  onEditVariant,
  markEdited,
  showAdvanced,
}: {
  variant: Variant;
  store: VariationStore;
  basePrice: number;
  selected: boolean;
  edited: boolean;
  onToggleKey: (k: string) => void;
  onEditVariant: (v: Variant) => void;
  markEdited: (k: string) => void;
  showAdvanced: boolean;
}) {
  const issues = variantValidationIssues(variant, store.data.priceMode);
  const invalid = issues.length > 0;
  const usesBase = variant.price == null;
  const priceLocked = store.data.priceMode === 'single';
  // Every inline edit persists via the store and flags the row as touched.
  const upd = (patch: Partial<Variant>) => {
    store.updateVariant(variant.key, patch);
    markEdited(variant.key);
  };

  return (
    <tr
      className={cn(
        'border-t border-border/70 transition-colors',
        selected && 'bg-brand-50/50',
        edited && !selected && 'bg-warning-soft/40',
        invalid && 'bg-danger-soft/40',
      )}
    >
      <td className={cn('sticky left-0 z-10 bg-surface px-3 py-2', selected && 'bg-brand-50', invalid && 'bg-danger-soft')}>
        <input
          type="checkbox"
          aria-label={`Select ${variantLabel(store.data.attributes, variant.selections)}`}
          checked={selected}
          onChange={() => onToggleKey(variant.key)}
          className="h-4 w-4 rounded border-border"
        />
      </td>
      <td className={cn('sticky left-10 z-10 min-w-[12rem] bg-surface px-3 py-2', selected && 'bg-brand-50', invalid && 'bg-danger-soft')}>
        <div className="font-medium">{variantLabel(store.data.attributes, variant.selections)}</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {variantChips(store.data.attributes, variant.selections).map((c) => (
            <span key={c.attribute} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {c.value}
            </span>
          ))}
        </div>
        {invalid ? <div className="mt-1 text-xs text-danger">{issues[0]}</div> : null}
      </td>
      <td className="px-3 py-2">
        <CellInput
          value={variant.sku}
          onChange={(val) => upd({ sku: val })}
          placeholder="SKU"
          invalid={!variant.sku.trim()}
        />
      </td>
      {showAdvanced ? (
        <td className="px-3 py-2">
          <CellInput
            value={variant.barcode}
            onChange={(val) => upd({ barcode: val })}
            placeholder="—"
          />
        </td>
      ) : null}
      <td className="px-3 py-2 text-right">
        {priceLocked ? (
          <span className="text-muted-foreground">{formatLkr(basePrice)}</span>
        ) : usesBase ? (
          <button
            type="button"
            onClick={() => upd({ price: basePrice })}
            className="text-xs text-primary hover:underline"
            title="Set a custom price"
          >
            Base · {formatLkr(basePrice)}
          </button>
        ) : (
          <div className="flex items-center justify-end gap-1">
            <NumberCell
              value={variant.price ?? 0}
              onChange={(n) => upd({ price: n })}
              align="right"
            />
            {store.data.priceMode === 'base-overrides' ? (
              <button
                type="button"
                aria-label="Revert to base price"
                title="Revert to base price"
                onClick={() => upd({ price: null })}
                className="rounded p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </div>
        )}
      </td>
      {showAdvanced ? (
        <td className="px-3 py-2 text-right">
          <NumberCell
            value={variant.cost}
            nullable
            onChange={(n) => upd({ cost: n })}
            align="right"
            placeholder="—"
          />
        </td>
      ) : null}
      <td className="px-3 py-2 text-right">
        <NumberCell
          value={variant.stock}
          onChange={(n) => upd({ stock: Math.max(0, n ?? 0) })}
          align="right"
        />
      </td>
      {showAdvanced ? (
        <td className="px-3 py-2 text-right">
          <NumberCell
            value={variant.reorderLevel}
            nullable
            onChange={(n) => upd({ reorderLevel: n })}
            align="right"
            placeholder="—"
          />
        </td>
      ) : null}
      <td className="px-3 py-2">
        <StockBadge variant={variant} />
      </td>
      <td className="px-3 py-2 text-right">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Edit variant"
          onClick={() => onEditVariant(variant)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
}

// --- portrait cards ---

function CardGroup({
  title,
  rows,
  store,
  basePrice,
  selected,
  editedKeys,
  onToggleKey,
  onEditVariant,
}: {
  title: string;
  rows: Variant[];
  store: VariationStore;
  basePrice: number;
  selected: Set<string>;
  editedKeys: Set<string>;
  onToggleKey: (k: string) => void;
  onEditVariant: (v: Variant) => void;
}) {
  const [open, setOpen] = React.useState(true);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 py-2 text-sm font-semibold"
        aria-expanded={open}
      >
        <ChevronDown className={cn('h-4 w-4 transition-transform', !open && '-rotate-90')} />
        <Layers className="h-4 w-4 text-muted-foreground" />
        {title}
        <Badge variant="neutral">{rows.length}</Badge>
      </button>
      {open ? (
        <div className="space-y-2">
          {rows.map((v) => (
            <VariantCard
              key={v.key}
              variant={v}
              store={store}
              basePrice={basePrice}
              selected={selected.has(v.key)}
              edited={editedKeys.has(v.key)}
              onToggleKey={onToggleKey}
              onEditVariant={onEditVariant}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function VariantCard({
  variant,
  store,
  basePrice,
  selected,
  edited,
  onToggleKey,
  onEditVariant,
}: {
  variant: Variant;
  store: VariationStore;
  basePrice: number;
  selected: boolean;
  edited: boolean;
  onToggleKey: (k: string) => void;
  onEditVariant: (v: Variant) => void;
}) {
  const issues = variantValidationIssues(variant, store.data.priceMode);
  return (
    <div
      className={cn(
        'rounded-2xl border p-3',
        issues.length ? 'border-danger bg-danger-soft/30' : 'border-border bg-surface',
        selected && 'ring-2 ring-ring',
        edited && !issues.length && 'border-warning',
      )}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          aria-label={`Select ${variantLabel(store.data.attributes, variant.selections)}`}
          checked={selected}
          onChange={() => onToggleKey(variant.key)}
          className="mt-1 h-5 w-5 rounded border-border"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium">{variantLabel(store.data.attributes, variant.selections)}</div>
            <StockBadge variant={variant} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Price</div>
              <div className="font-medium">{formatLkr(effectivePrice(variant, basePrice))}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Stock</div>
              <div className="font-medium">{variant.stock}</div>
            </div>
          </div>
          {variant.sku.trim() ? (
            <div className="mt-2 text-xs text-muted-foreground">SKU: {variant.sku}</div>
          ) : (
            <div className="mt-2 text-xs text-danger">Missing SKU</div>
          )}
          {issues.length ? <div className="mt-1 text-xs text-danger">{issues[0]}</div> : null}
          <div className="mt-2">
            <Button
              variant="outline"
              size="sm"
              fullWidth
              leftIcon={<Pencil className="h-4 w-4" />}
              onClick={() => onEditVariant(variant)}
            >
              Edit
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- quick bulk setup (apply to all before fine-tuning) ---

function QuickSetup({
  store,
  basePrice,
  open,
  onToggle,
  onApplied,
}: {
  store: VariationStore;
  basePrice: number;
  open: boolean;
  onToggle: () => void;
  onApplied: (keys: string[]) => void;
}) {
  const [price, setPrice] = React.useState('');
  const [stock, setStock] = React.useState('');
  const [reorder, setReorder] = React.useState('');
  const [note, setNote] = React.useState<string | null>(null);

  const allKeys = store.data.variants.map((v) => v.key);
  const flash = (msg: string) => {
    onApplied(allKeys);
    setNote(msg);
  };

  const applyPrice = () => {
    if (price.trim() === '') return;
    store.bulkUpdate(allKeys, () => ({ price: Number(price) }));
    flash(`Selling price applied to ${allKeys.length} combinations`);
  };
  const applyStock = () => {
    if (stock.trim() === '') return;
    store.bulkUpdate(allKeys, () => ({ stock: Math.max(0, Number(stock) || 0) }));
    flash(`Starting stock applied to ${allKeys.length} combinations`);
  };
  const applyReorder = () => {
    if (reorder.trim() === '') return;
    store.bulkUpdate(allKeys, () => ({ reorderLevel: Number(reorder) }));
    flash(`Low-stock alert applied to ${allKeys.length} combinations`);
  };
  const useBaseForAll = () => {
    store.bulkUpdate(allKeys, () => ({ price: null }));
    flash(`All combinations now use the base price (${formatLkr(basePrice)})`);
  };

  return (
    <div className="rounded-2xl border border-brand-100 bg-brand-50/40 p-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="inline-flex items-center gap-2 text-sm font-semibold">
          <Wand2 className="h-4 w-4 text-brand-600" />
          Quick setup — apply to every combination
        </span>
        <ChevronDown className={cn('h-4 w-4 transition-transform', !open && '-rotate-90')} />
      </button>
      {open ? (
        <>
          <p className="mt-1 text-xs text-muted-foreground">
            Set a starting selling price, stock and low-stock alert for all combinations at once, then
            adjust only the exceptions below.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <ApplyField
              label="Selling price for all (Rs.)"
              value={price}
              onChange={setPrice}
              placeholder={String(basePrice)}
              onApply={applyPrice}
            />
            <ApplyField
              label="Starting stock for all"
              value={stock}
              onChange={setStock}
              placeholder="0"
              onApply={applyStock}
            />
            <ApplyField
              label="Low-stock alert for all"
              value={reorder}
              onChange={setReorder}
              placeholder="0"
              onApply={applyReorder}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={useBaseForAll}>
              Use base price for all
            </Button>
            {note ? <span className="text-xs font-medium text-success">{note}</span> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function ApplyField({
  label,
  value,
  onChange,
  placeholder,
  onApply,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onApply: () => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2">
        <Input
          inputMode="decimal"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onApply();
            }
          }}
        />
        <Button variant="secondary" onClick={onApply} disabled={value.trim() === ''}>
          Apply
        </Button>
      </div>
    </div>
  );
}

// --- editable cells ---

function CellInput({
  value,
  onChange,
  placeholder,
  invalid,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  invalid?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        'h-9 w-28 rounded-lg border bg-surface px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        invalid ? 'border-danger/50' : 'border-border',
      )}
    />
  );
}

function NumberCell({
  value,
  onChange,
  align = 'left',
  nullable,
  placeholder,
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  align?: 'left' | 'right';
  nullable?: boolean;
  placeholder?: string;
}) {
  return (
    <input
      inputMode="decimal"
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '') {
          onChange(nullable ? null : 0);
          return;
        }
        const n = Number(raw);
        if (!Number.isNaN(n)) onChange(n);
      }}
      className={cn(
        'h-9 w-20 rounded-lg border border-border bg-surface px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        align === 'right' && 'text-right',
      )}
    />
  );
}
