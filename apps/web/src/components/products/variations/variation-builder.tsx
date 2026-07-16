'use client';

import { CheckCircle2, Info, Layers3, Plus, PowerOff, RefreshCw, Sparkles } from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import type { Variant } from '@/lib/variations/types';
import type { VariationStore } from '@/lib/variations/variation-store';

import { AttributeBuilder } from './attribute-builder';
import { BulkEditDrawer } from './bulk-edit-drawer';
import { CombinationStage } from './combination-stage';
import { StatPill, StepIndicator } from './shared';
import { VariantDetailDrawer } from './variant-detail-drawer';
import { VariantMatrix } from './variant-matrix';

/**
 * The three-stage variation builder, embedded inside the Product form (no routes).
 * Owns per-session UI state (step, selection, edited rows, drawers); all variation
 * data lives in the passed-in `store`.
 */
export function VariationBuilder({
  store,
  baseSku,
  basePrice,
  embedded = false,
}: {
  store: VariationStore;
  baseSku: string;
  basePrice: number;
  /** Inside the product wizard the step chrome replaces the overview header. */
  embedded?: boolean;
}) {
  const { data, analysis } = store;
  const [step, setStep] = React.useState<1 | 2 | 3>(() => (data.variants.length > 0 ? 3 : 1));
  const [selectedKeys, setSelectedKeys] = React.useState<string[]>([]);
  const [editedKeys, setEditedKeys] = React.useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<Variant | null>(null);
  const [flash, setFlash] = React.useState<string | null>(null);
  const [confirmDisable, setConfirmDisable] = React.useState(false);

  const reached: 1 | 2 | 3 = data.variants.length > 0 ? 3 : analysis.count > 0 ? 2 : 1;

  // Never leave the user on a step they can no longer reach.
  React.useEffect(() => {
    setStep((s) => (s > reached ? reached : s));
  }, [reached]);

  const showFlash = React.useCallback((msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash((cur) => (cur === msg ? null : cur)), 2500);
  }, []);

  const markEdited = React.useCallback(
    (key: string) => setEditedKeys((prev) => (prev.has(key) ? prev : new Set(prev).add(key))),
    [],
  );

  const toggleKey = React.useCallback(
    (key: string) =>
      setSelectedKeys((prev) =>
        prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
      ),
    [],
  );

  const toggleAll = React.useCallback((keys: string[]) => {
    setSelectedKeys((prev) => {
      const all = keys.every((k) => prev.includes(k));
      return all ? prev.filter((k) => !keys.includes(k)) : [...new Set([...prev, ...keys])];
    });
  }, []);

  const optionCount = data.attributes.reduce((n, a) => n + a.options.length, 0);
  const priceModeLabel =
    data.priceMode === 'single'
      ? 'One price for all'
      : data.priceMode === 'individual'
        ? 'Individual prices'
        : 'Base price + overrides';

  return (
    <div className="space-y-5" id="variations-section">
      {/* Overview header (hidden inside the wizard, which provides its own chrome) */}
      {embedded ? null : (
      <div className="rounded-2xl border border-brand-100 bg-brand-50/50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-white">
              <Layers3 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold tracking-tight">Product variations</h3>
                <Badge variant="primary">
                  <CheckCircle2 className="h-3 w-3" /> Variations enabled
                </Badge>
              </div>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Build attributes like Color, Size or Finish, generate every combination, then set
                price &amp; stock per variant. Everything saves with the product.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.variants.length > 0 ? (
              <Button
                variant="outline"
                leftIcon={<RefreshCw className="h-4 w-4" />}
                onClick={() => setStep(2)}
              >
                Regenerate
              </Button>
            ) : null}
            <Button
              leftIcon={data.variants.length > 0 ? <Plus className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              onClick={() => {
                if (data.attributes.length === 0) store.addAttribute();
                setStep(data.attributes.length === 0 ? 1 : analysis.count > 0 ? 2 : 1);
              }}
            >
              {data.attributes.length === 0 ? 'Add attribute' : 'Generate variants'}
            </Button>
          </div>
        </div>

        {/* Summary stats */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <StatPill label="Attributes" value={data.attributes.length} />
          <StatPill label="Option values" value={optionCount} />
          <StatPill label="Combinations" value={analysis.count} tone="brand" />
          <StatPill label="Generated" value={data.variants.length} />
          <StatPill label="Price mode" value={<span className="text-sm">{priceModeLabel}</span>} />
          <StatPill label="Stock" value={<span className="text-sm">Individual</span>} />
        </div>

        {data.attributes.length === 0 ? (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-brand-100 bg-surface px-4 py-3 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
            <span className="text-muted-foreground">
              Start by adding your first attribute (e.g. <strong>Color</strong>). Add its values, then
              move to <strong>Combinations</strong> to generate variants.
            </span>
          </div>
        ) : null}
      </div>
      )}

      {flash ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-success-soft bg-success-soft px-4 py-2.5 text-sm text-success"
        >
          <CheckCircle2 className="h-4 w-4" />
          {flash}
        </div>
      ) : null}

      {/* Substep indicator: Options → Combinations → Price & stock */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StepIndicator current={step} reached={reached} onStep={setStep} />
        {embedded ? null : (
          <Button
            variant="ghost"
            size="sm"
            className="text-danger hover:bg-danger-soft"
            leftIcon={<PowerOff className="h-4 w-4" />}
            onClick={() => setConfirmDisable(true)}
          >
            Disable variations
          </Button>
        )}
      </div>

      {/* Stage content */}
      <div>
        {step === 1 ? <AttributeBuilder store={store} /> : null}
        {step === 2 ? (
          <CombinationStage
            store={store}
            baseSku={baseSku}
            onGenerated={() => {
              setEditedKeys(new Set());
              setStep(3);
              showFlash('Variants generated');
            }}
          />
        ) : null}
        {step === 3 ? (
          <VariantMatrix
            store={store}
            basePrice={basePrice}
            selectedKeys={selectedKeys}
            onToggleKey={toggleKey}
            onToggleAll={toggleAll}
            editedKeys={editedKeys}
            markEdited={markEdited}
            onEditVariant={setDetail}
            onOpenBulk={() => setBulkOpen(true)}
          />
        ) : null}
      </div>

      {/* Step nav footer */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button variant="ghost" disabled={step === 1} onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}>
          Back
        </Button>
        {step < 3 ? (
          <Button
            variant="outline"
            disabled={step >= reached}
            onClick={() => setStep((s) => (s < reached ? ((s + 1) as 1 | 2 | 3) : s))}
          >
            Next
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">
            {store.saving ? 'Saving…' : store.lastSavedAt ? 'All changes saved locally' : ''}
          </span>
        )}
      </div>

      {/* Bulk edit drawer */}
      <BulkEditDrawer
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        store={store}
        baseSku={baseSku}
        selectedKeys={selectedKeys}
        onClearSelection={() => setSelectedKeys([])}
        onApplied={(msg) => {
          selectedKeys.forEach(markEdited);
          showFlash(msg);
        }}
      />

      {/* Variant detail drawer */}
      <VariantDetailDrawer
        open={!!detail}
        onClose={() => setDetail(null)}
        variant={detail}
        attributes={data.attributes}
        basePrice={basePrice}
        priceMode={data.priceMode}
        onSave={(key, patch) => {
          store.updateVariant(key, patch);
          markEdited(key);
          showFlash('Variant saved');
        }}
      />

      {/* Disable confirmation */}
      <Dialog
        open={confirmDisable}
        onClose={() => setConfirmDisable(false)}
        title="Disable variations?"
        description="This product becomes a simple product again."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDisable(false)}>
              Keep variations
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                store.setEnabled(false);
                setConfirmDisable(false);
              }}
            >
              Disable variations
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Your attributes and generated variants stay saved locally, so you can re-enable variations
          later without losing this setup.
        </p>
      </Dialog>
    </div>
  );
}
