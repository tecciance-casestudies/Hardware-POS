'use client';

import * as React from 'react';

import { VariationBuilder } from '@/components/products/variations/variation-builder';
import type { VariationStore } from '@/lib/variations/variation-store';
import { StepHeader } from './fields';

/**
 * Step 5 — the guided variation subflow (Options → Combinations → Price & stock).
 * The heavy lifting lives in the reusable VariationBuilder, rendered in embedded mode
 * so the wizard supplies the surrounding chrome.
 */
export function VariationSetupStep({
  store,
  baseSku,
  basePrice,
  stepLabel,
}: {
  store: VariationStore;
  baseSku: string;
  basePrice: number;
  stepLabel: string;
}) {
  return (
    <div className="space-y-5">
      <StepHeader
        eyebrow={stepLabel}
        title="Variation setup"
        description="Add product options, create combinations, then set price and stock. Everything saves with the product."
      />
      <VariationBuilder store={store} baseSku={baseSku} basePrice={basePrice} embedded />
    </div>
  );
}
