'use client';

import * as React from 'react';

import type { CategoryNode } from '@/lib/products-api';

import { BasicInformationStep } from './basic-information-step';
import { CategoryMediaStep } from './category-media-step';
import { StepHeader } from './fields';
import type { FieldErrors, FormState, ProductType, SetField } from './types';

/**
 * Step 1 of the simplified flow — merges the old Basic Information, Category and
 * Image steps into one "Product details" screen. Reuses the existing step
 * components in `embedded` mode (their own headers/info panels suppressed) so
 * every field and behaviour is preserved verbatim.
 */
export function ProductDetailsStep({
  form,
  set,
  setCategory,
  errors,
  productType,
  categories,
  imageSrc,
  imageBusy,
  onPickFile,
  onRemoveImage,
}: {
  form: FormState;
  set: SetField;
  setCategory: (categoryId: string) => void;
  errors: FieldErrors;
  productType: ProductType;
  categories: CategoryNode[];
  imageSrc: string | null;
  imageBusy: boolean;
  onPickFile: (file: File) => void;
  onRemoveImage: () => void;
}) {
  return (
    <div className="space-y-6">
      <StepHeader
        eyebrow="Step 1 of 3"
        title="Product details"
        description="Enter the information cashiers and customers will use to identify this product."
      />

      <BasicInformationStep
        form={form}
        set={set}
        errors={errors}
        productType={productType}
        embedded
      />

      <CategoryMediaStep
        form={form}
        set={set}
        setCategory={setCategory}
        categories={categories}
        imageSrc={imageSrc}
        imageBusy={imageBusy}
        onPickFile={onPickFile}
        onRemoveImage={onRemoveImage}
        embedded
      />
    </div>
  );
}
