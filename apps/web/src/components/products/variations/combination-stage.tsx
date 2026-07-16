'use client';

import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  combinationFormula,
  variantLabel,
} from '@/lib/variations/variation-combination-utils';
import type { VariationStore } from '@/lib/variations/variation-store';

/**
 * Stage 2 — live combination preview with warnings, then Generate / Regenerate.
 * Generation is confirmed through a review dialog whenever variants already exist
 * or the count is large, so nothing is silently destroyed and the tab never freezes.
 */
export function CombinationStage({
  store,
  baseSku,
  onGenerated,
}: {
  store: VariationStore;
  baseSku: string;
  onGenerated: () => void;
}) {
  const { data, analysis } = store;
  const [dialog, setDialog] = React.useState<null | 'regenerate' | 'large'>(null);
  const [busy, setBusy] = React.useState(false);
  const hasVariants = data.variants.length > 0;

  const preview = React.useMemo(
    () => store.previewGenerate(),
    // recompute whenever attributes/variants change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.attributes, data.variants],
  );

  const blocking =
    analysis.count === 0 ||
    analysis.overMax ||
    analysis.duplicateAttributeNames.length > 0 ||
    analysis.duplicateOptionAttributes.length > 0;

  const runGenerate = () => {
    setBusy(true);
    // Defer so the spinner paints before the (synchronous) Cartesian build.
    setTimeout(() => {
      store.generate(baseSku);
      setBusy(false);
      setDialog(null);
      onGenerated();
    }, 20);
  };

  const onGenerateClick = () => {
    if (blocking) return;
    if (analysis.overHigh) {
      setDialog('large');
      return;
    }
    if (hasVariants && (preview.addedKeys.length > 0 || preview.removed.length > 0)) {
      setDialog('regenerate');
      return;
    }
    runGenerate();
  };

  return (
    <div className="space-y-5">
      {/* Live formula */}
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Combination preview</h3>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-brand-700">
              {combinationFormula(data.attributes)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.attributes
              .filter((a) => a.options.length > 0)
              .map((a) => (
                <div key={a.id} className="rounded-xl border border-border px-3 py-2 text-center">
                  <div className="text-base font-semibold leading-none">{a.options.length}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {a.name.trim() || 'Attribute'}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Warnings */}
      <Warnings store={store} />

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="lg"
          leftIcon={hasVariants ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          disabled={blocking || busy}
          isLoading={busy}
          onClick={onGenerateClick}
        >
          {hasVariants ? 'Regenerate variants' : 'Generate variants'}
        </Button>
        {hasVariants ? (
          <p className="text-sm text-muted-foreground">
            {data.variants.length} variant{data.variants.length === 1 ? '' : 's'} generated.
            Unchanged combinations keep their price, stock and SKU.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            This creates one variant per combination. You can edit price &amp; stock next.
          </p>
        )}
      </div>

      {/* Regenerate review dialog */}
      <Dialog
        open={dialog === 'regenerate'}
        onClose={() => setDialog(null)}
        title="Review regeneration"
        description="Existing variants are preserved. Review what changes before applying."
        className="max-w-lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={runGenerate} isLoading={busy}>
              Regenerate safely
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <DiffRow tone="success" count={preview.unchanged.length} label="kept unchanged (SKU, price, cost, stock, status preserved)" />
          <DiffRow tone="brand" count={preview.addedKeys.length} label="new variant(s) will be added" />
          <DiffRow tone="danger" count={preview.removed.length} label="variant(s) will be removed" />
          {preview.removed.length > 0 ? (
            <div className="rounded-xl border border-danger-soft bg-danger-soft p-3">
              <p className="mb-1 font-medium text-danger">These combinations will be removed:</p>
              <ul className="max-h-32 space-y-0.5 overflow-y-auto text-danger/90">
                {preview.removed.slice(0, 30).map((v) => (
                  <li key={v.key}>• {variantLabel(data.attributes, v.selections) || v.sku || v.key}</li>
                ))}
                {preview.removed.length > 30 ? <li>…and {preview.removed.length - 30} more</li> : null}
              </ul>
            </div>
          ) : null}
        </div>
      </Dialog>

      {/* Large-count warning modal */}
      <Dialog
        open={dialog === 'large'}
        onClose={() => setDialog(null)}
        title="That's a lot of variants"
        description={`Generating ${analysis.count} variants may slow down editing on this page.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="warning" onClick={runGenerate} isLoading={busy}>
              Generate anyway
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Consider whether every attribute is necessary — fewer options keep the matrix fast and
          easier to manage. You can always add more later.
        </p>
      </Dialog>
    </div>
  );
}

function DiffRow({
  tone,
  count,
  label,
}: {
  tone: 'success' | 'brand' | 'danger';
  count: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          'grid h-8 w-10 shrink-0 place-items-center rounded-lg text-sm font-semibold',
          tone === 'success' && 'bg-success-soft text-success',
          tone === 'brand' && 'bg-brand-50 text-brand-700',
          tone === 'danger' && 'bg-danger-soft text-danger',
        )}
      >
        {count}
      </span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function Warnings({ store }: { store: VariationStore }) {
  const { analysis } = store;
  const items: { tone: 'warning' | 'danger'; text: string }[] = [];

  if (analysis.count === 0) {
    items.push({ tone: 'warning', text: 'Add at least one attribute with one or more options to generate variants.' });
  }
  for (const name of analysis.emptyAttributes) {
    items.push({ tone: 'warning', text: `"${name}" has no options yet and will be ignored.` });
  }
  for (const name of analysis.duplicateAttributeNames) {
    items.push({ tone: 'danger', text: `Duplicate attribute name: "${name}". Rename it before generating.` });
  }
  for (const name of analysis.duplicateOptionAttributes) {
    items.push({ tone: 'danger', text: `"${name}" contains duplicate option values.` });
  }
  if (analysis.overMax) {
    items.push({ tone: 'danger', text: `${analysis.count} combinations is over the limit — reduce options before generating.` });
  } else if (analysis.overHigh) {
    items.push({ tone: 'warning', text: `${analysis.count} combinations is a lot and may slow down editing.` });
  } else if (analysis.overWarn) {
    items.push({ tone: 'warning', text: `${analysis.count} combinations — larger sets are harder to manage.` });
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-success-soft bg-success-soft px-4 py-3 text-sm text-success">
        <CheckCircle2 className="h-4 w-4" />
        Ready to generate — no issues detected.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li
          key={i}
          className={cn(
            'flex items-start gap-2 rounded-xl border px-4 py-3 text-sm',
            it.tone === 'warning' && 'border-warning-soft bg-warning-soft text-warning',
            it.tone === 'danger' && 'border-danger-soft bg-danger-soft text-danger',
          )}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{it.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** Tiny spinner block used while restoring/generating elsewhere. */
export function InlineLoading({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}
