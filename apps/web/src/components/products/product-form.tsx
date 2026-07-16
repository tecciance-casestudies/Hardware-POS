'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { ArrowLeft, ArrowRight, ClipboardCheck, Save } from 'lucide-react';

import { BasicInformationStep } from '@/components/products/wizard/basic-information-step';
import { CategoryMediaStep } from '@/components/products/wizard/category-media-step';
import { PricingInventoryStep } from '@/components/products/wizard/pricing-inventory-step';
import { ProductTypeStep } from '@/components/products/wizard/product-type-step';
import {
  ProductWizardProgress,
  type ProgressItem,
} from '@/components/products/wizard/product-wizard-progress';
import { ProductWizardSummary } from '@/components/products/wizard/product-wizard-summary';
import { ReviewStep, type ReviewIssue } from '@/components/products/wizard/review-step';
import { VariationSetupStep } from '@/components/products/wizard/variation-setup-step';
import {
  initialFormState,
  numOrNull,
  type FieldErrors,
  type FormState,
  type ProductType,
  type StepKey,
  type StepStatus,
} from '@/components/products/wizard/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import type { Session } from '@/lib/auth';
import { productDraftService } from '@/lib/product-draft';
import {
  createProduct,
  deleteProductImage,
  updateProduct,
  uploadProductImage,
  type CategoryNode,
  type ManagedProduct,
  type ProductInput,
} from '@/lib/products-api';
import { variantValidationIssues } from '@/lib/variations/variation-combination-utils';
import { useVariationStore, variationMockService } from '@/lib/variations/variation-store';

const STEP_LABELS: Record<StepKey, string> = {
  type: 'Product Type',
  basic: 'Basic Information',
  category: 'Category & Image',
  pricing: 'Price & Stock',
  variations: 'Variations',
  review: 'Review',
};

function buildSteps(type: ProductType): StepKey[] {
  return type === 'variations'
    ? ['type', 'basic', 'category', 'pricing', 'variations', 'review']
    : ['type', 'basic', 'category', 'pricing', 'review'];
}

export function ProductForm({
  session,
  categories,
  product,
  isAdmin,
}: {
  session: Session;
  categories: CategoryNode[];
  product?: ManagedProduct;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const editing = !!product;
  const productId = product?.id ?? null;

  const [form, setForm] = React.useState<FormState>(() => initialFormState(product));
  const [imageUrl, setImageUrl] = React.useState<string | null>(product?.imageUrl ?? null);
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = React.useState<string | null>(null);
  const [step, setStep] = React.useState<StepKey>('type');
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [saving, setSaving] = React.useState(false);
  const [imageBusy, setImageBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = React.useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const dirty = React.useRef(false);

  const variations = useVariationStore(productId);
  const productType: ProductType = variations.data.enabled ? 'variations' : 'simple';

  const qbManaged = !!product?.quickbooksItemId;
  const stockLocked = qbManaged && !isAdmin;

  const set = React.useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    dirty.current = true;
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  const setCategory = React.useCallback((categoryId: string) => {
    dirty.current = true;
    setForm((f) => ({ ...f, categoryId, subcategoryId: '' }));
  }, []);

  // Restore a locally-saved draft (create mode only — edit mode trusts the server).
  React.useEffect(() => {
    if (editing) return;
    const draft = productDraftService.load(null);
    if (draft) {
      setForm(draft.fields);
      setStep(draft.step >= 0 ? (buildSteps(draft.productType)[draft.step] ?? 'type') : 'type');
      setDraftSavedAt(draft.savedAt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    return () => {
      if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    };
  }, [pendingPreview]);

  const steps = React.useMemo(() => buildSteps(productType), [productType]);

  // Keep the current step valid if the flow shape changes (variations ↔ simple).
  React.useEffect(() => {
    if (!steps.includes(step)) setStep('pricing');
  }, [steps, step]);

  const stepIndex = steps.indexOf(step);
  const isLast = stepIndex === steps.length - 1;
  const previewSrc = pendingPreview ?? imageUrl;

  // ---- validation ----
  const validate = React.useCallback(
    (key: StepKey): FieldErrors => {
      const e: FieldErrors = {};
      if (key === 'basic') {
        if (!form.name.trim()) e.name = 'Please enter a product name before continuing.';
        const bc = form.barcode.trim();
        if (bc && !/^[A-Za-z0-9-]{4,}$/.test(bc)) e.barcode = 'Enter a valid barcode (letters or numbers).';
      }
      if (key === 'pricing') {
        if (form.unitPrice.trim() === '' || Number.isNaN(Number(form.unitPrice))) {
          e.unitPrice = 'Enter a valid selling price.';
        } else if (Number(form.unitPrice) < 0) {
          e.unitPrice = 'Price cannot be negative.';
        }
      }
      return e;
    },
    [form],
  );

  const invalidVariantCount = variations.data.enabled
    ? variations.data.variants.filter((v) => variantValidationIssues(v, variations.data.priceMode).length > 0).length
    : 0;
  const missingSkuCount = variations.data.variants.filter((v) => !v.sku.trim()).length;
  const totalVariantStock = variations.data.variants.reduce((n, v) => n + (Number(v.stock) || 0), 0);

  const stepStatus = React.useCallback(
    (key: StepKey): StepStatus => {
      if (key === step) return 'current';
      if (key === 'type') return 'complete';
      if (key === 'category') return form.categoryId ? 'complete' : 'optional';
      if (key === 'variations') {
        if (invalidVariantCount > 0) return 'attention';
        return variations.data.variants.length > 0 ? 'complete' : 'todo';
      }
      const errs = validate(key);
      if (Object.keys(errs).length > 0) return steps.indexOf(key) < stepIndex ? 'attention' : 'todo';
      if (key === 'review') return 'todo';
      return steps.indexOf(key) < stepIndex ? 'complete' : 'todo';
    },
    [step, form.categoryId, invalidVariantCount, variations.data.variants.length, validate, steps, stepIndex],
  );

  // Furthest step the user may jump forward to.
  const maxReachable = React.useMemo(() => {
    let reach = 0;
    for (let i = 0; i < steps.length; i += 1) {
      reach = i;
      const s = stepStatus(steps[i]!);
      if (s !== 'complete' && s !== 'optional' && s !== 'current') break;
    }
    return Math.max(reach, stepIndex);
  }, [steps, stepStatus, stepIndex]);

  const progressItems: ProgressItem[] = steps.map((key, i) => ({
    key,
    label: STEP_LABELS[key],
    status: stepStatus(key),
    clickable: i <= maxReachable,
  }));

  const goTo = (key: StepKey) => {
    const target = steps.indexOf(key);
    if (target < 0) return;
    if (target <= maxReachable) {
      setError(null);
      setStep(key);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const focusFirstError = () => {
    window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>('[aria-invalid="true"]');
      el?.focus();
    }, 0);
  };

  const goNext = () => {
    const errs = validate(step);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      focusFirstError();
      return;
    }
    setErrors({});
    if (isLast) {
      void submit();
      return;
    }
    setStep(steps[stepIndex + 1]!);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBack = () => {
    if (stepIndex <= 0) return;
    setError(null);
    setStep(steps[stepIndex - 1]!);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ---- image ----
  const onPickFile = async (file: File) => {
    dirty.current = true;
    setError(null);
    if (editing && product) {
      setImageBusy(true);
      try {
        const updated = await uploadProductImage(session, product.id, file);
        setImageUrl(updated.imageUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Image upload failed');
      } finally {
        setImageBusy(false);
      }
    } else {
      if (pendingPreview) URL.revokeObjectURL(pendingPreview);
      setPendingFile(file);
      setPendingPreview(URL.createObjectURL(file));
    }
  };

  const onRemoveImage = async () => {
    dirty.current = true;
    setError(null);
    if (editing && product && imageUrl) {
      setImageBusy(true);
      try {
        await deleteProductImage(session, product.id);
        setImageUrl(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not remove image');
      } finally {
        setImageBusy(false);
      }
    } else {
      if (pendingPreview) URL.revokeObjectURL(pendingPreview);
      setPendingFile(null);
      setPendingPreview(null);
    }
  };

  // ---- draft ----
  const saveDraft = () => {
    const savedAt = productDraftService.save(productId, {
      fields: form,
      productType,
      step: stepIndex,
    });
    setDraftSavedAt(savedAt);
  };

  // ---- submit ----
  const buildInput = (): ProductInput => ({
    name: form.name.trim(),
    sku: form.sku.trim() || null,
    barcode: form.barcode.trim() || null,
    brand: form.brand.trim() || null,
    categoryId: form.categoryId || null,
    subcategoryId: form.subcategoryId || null,
    unitType: form.unitType.trim() || null,
    unitPrice: Number(form.unitPrice) || 0,
    costPrice: numOrNull(form.costPrice),
    quantityOnHand: Number(form.quantityOnHand) || 0,
    reorderLevel: numOrNull(form.reorderLevel),
    description: form.description.trim() || null,
    imageAltText: form.imageAltText.trim() || null,
    trackInventory: form.trackInventory,
    taxable: form.taxable,
    requiresWarehousePickup: form.requiresWarehousePickup,
    isActive: form.isActive,
  });

  const submit = async () => {
    const basicErr = validate('basic');
    const priceErr = validate('pricing');
    if (Object.keys(basicErr).length) {
      setErrors(basicErr);
      goTo('basic');
      focusFirstError();
      return;
    }
    if (Object.keys(priceErr).length) {
      setErrors(priceErr);
      goTo('pricing');
      focusFirstError();
      return;
    }
    if (invalidVariantCount > 0) {
      setError(`${invalidVariantCount} variant${invalidVariantCount === 1 ? '' : 's'} need attention.`);
      goTo('variations');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const input = buildInput();
      if (editing && product) {
        if (stockLocked) delete (input as Partial<ProductInput>).quantityOnHand;
        await updateProduct(session, product.id, input);
        productDraftService.clear(productId);
        router.push(`/products/${product.id}`);
      } else {
        const created = await createProduct(session, input);
        // Move draft variation setup onto the new product id + clear the form draft.
        // TODO(backend): POST generated variants to a real /products/:id/variants endpoint.
        variationMockService.promoteDraft(created.id);
        productDraftService.clear(null);
        if (pendingFile) {
          try {
            await uploadProductImage(session, created.id, pendingFile);
          } catch {
            /* image can be added later from edit */
          }
        }
        router.push(`/products/${created.id}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save product');
      setSaving(false);
    }
  };

  const cancel = () => {
    if (dirty.current || variations.data.enabled) setConfirmCancel(true);
    else router.back();
  };

  // ---- derived summary/review data ----
  const category = categories.find((c) => c.id === form.categoryId) ?? null;
  const subcategory = category?.subcategories.find((s) => s.id === form.subcategoryId) ?? null;
  const completedSteps = steps.filter((k) => stepStatus(k) === 'complete').length;

  const priceModeLabel =
    variations.data.priceMode === 'single'
      ? 'One price for all'
      : variations.data.priceMode === 'individual'
        ? 'Individual prices'
        : 'Base price + overrides';

  const reviewIssues: ReviewIssue[] = [];
  if (!form.name.trim()) reviewIssues.push({ label: 'Add a product name', step: 'basic' });
  if (form.unitPrice.trim() === '' || Number.isNaN(Number(form.unitPrice)))
    reviewIssues.push({ label: 'Set a valid selling price', step: 'pricing' });
  if (productType === 'variations') {
    if (variations.data.variants.length === 0)
      reviewIssues.push({ label: 'No combinations generated yet', step: 'variations' });
    if (invalidVariantCount > 0)
      reviewIssues.push({ label: `${invalidVariantCount} variant(s) need attention`, step: 'variations' });
    if (missingSkuCount > 0)
      reviewIssues.push({ label: `${missingSkuCount} variant(s) missing SKU`, step: 'variations' });
  }

  const completedLabels: string[] = [];
  if (form.name.trim()) completedLabels.push('Basic information complete');
  if (form.categoryId) completedLabels.push('Category selected');
  if (previewSrc) completedLabels.push('Image added');
  if (form.unitPrice.trim() !== '' && !Number.isNaN(Number(form.unitPrice))) completedLabels.push('Pricing complete');
  if (productType === 'variations' && variations.data.variants.length > 0)
    completedLabels.push(`${variations.data.variants.length} combinations generated`);

  const nextIsReview = !isLast && steps[stepIndex + 1] === 'review';
  const primaryLabel = isLast ? (editing ? 'Save changes' : 'Create product') : nextIsReview ? 'Review product' : 'Continue';
  const primaryIcon = isLast ? <Save className="h-4 w-4" /> : nextIsReview ? <ClipboardCheck className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />;

  return (
    <div className="space-y-5 pb-28">
      {/* Header: title + status + progress */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{editing ? 'Edit product' : 'Add product'}</h1>
            <p className="text-sm text-muted-foreground">A guided setup — one step at a time.</p>
          </div>
          <Badge variant={editing ? (form.isActive ? 'success' : 'neutral') : 'primary'}>
            {editing ? (form.isActive ? 'Active' : 'Inactive') : 'New'}
          </Badge>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-2 shadow-sm">
          <ProductWizardProgress items={progressItems} current={step} onStep={goTo} />
        </div>
      </div>

      {/* Mobile/tablet collapsible summary */}
      <ProductWizardSummary
        variant="collapsible"
        data={{
          form,
          productType,
          imageSrc: previewSrc,
          categoryName: category?.name ?? null,
          subcategoryName: subcategory?.name ?? null,
          variantCount: variations.data.variants.length,
          completedSteps,
          totalSteps: steps.length,
        }}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Current step */}
        <div className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          {step === 'type' ? (
            <ProductTypeStep value={productType} onChange={(t) => variations.setEnabled(t === 'variations')} />
          ) : null}
          {step === 'basic' ? (
            <BasicInformationStep
              form={form}
              set={set}
              errors={errors}
              productType={productType}
              stepLabel={`Step ${stepIndex + 1} of ${steps.length}`}
            />
          ) : null}
          {step === 'category' ? (
            <CategoryMediaStep
              form={form}
              set={set}
              setCategory={setCategory}
              categories={categories}
              imageSrc={previewSrc}
              imageBusy={imageBusy}
              onPickFile={onPickFile}
              onRemoveImage={onRemoveImage}
              stepLabel={`Step ${stepIndex + 1} of ${steps.length}`}
            />
          ) : null}
          {step === 'pricing' ? (
            <PricingInventoryStep
              form={form}
              set={set}
              errors={errors}
              productType={productType}
              stockLocked={stockLocked}
              computedVariantStock={productType === 'variations' ? totalVariantStock : null}
              stepLabel={`Step ${stepIndex + 1} of ${steps.length}`}
            />
          ) : null}
          {step === 'variations' ? (
            <VariationSetupStep
              store={variations}
              baseSku={form.sku}
              basePrice={Number(form.unitPrice) || 0}
              stepLabel={`Step ${stepIndex + 1} of ${steps.length}`}
            />
          ) : null}
          {step === 'review' ? (
            <ReviewStep
              form={form}
              productType={productType}
              categoryName={category?.name ?? null}
              subcategoryName={subcategory?.name ?? null}
              imageSrc={previewSrc}
              completed={completedLabels}
              issues={reviewIssues}
              onGoTo={goTo}
              stepLabel={`Step ${stepIndex + 1} of ${steps.length}`}
              variation={
                productType === 'variations'
                  ? {
                      attributes: variations.data.attributes.length,
                      combinations: variations.data.variants.length,
                      priceModeLabel,
                      totalStock: totalVariantStock,
                      outOfStock: variations.data.variants.filter((v) => v.stock <= 0).length,
                      missingSku: missingSkuCount,
                      needAttention: invalidVariantCount,
                    }
                  : null
              }
            />
          ) : null}
        </div>

        {/* Desktop summary rail */}
        <ProductWizardSummary
          data={{
            form,
            productType,
            imageSrc: previewSrc,
            categoryName: category?.name ?? null,
            subcategoryName: subcategory?.name ?? null,
            variantCount: variations.data.variants.length,
            completedSteps,
            totalSteps: steps.length,
          }}
        />
      </div>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 z-30 rounded-2xl border border-border bg-surface/95 px-4 py-3 shadow-[0_-4px_12px_rgba(15,23,42,0.05)] backdrop-blur">
        {error ? <p className="mb-2 text-sm text-danger">{error}</p> : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={stepIndex === 0 ? cancel : goBack}>
              <ArrowLeft className="h-4 w-4" /> {stepIndex === 0 ? 'Cancel' : 'Back'}
            </Button>
            {!editing ? (
              <Button variant="outline" onClick={saveDraft}>
                Save draft
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            {draftSavedAt ? <span className="hidden text-xs text-muted-foreground sm:inline">Draft saved locally</span> : null}
            <Button size="lg" onClick={goNext} isLoading={saving} disabled={saving} rightIcon={saving ? undefined : primaryIcon}>
              {primaryLabel}
            </Button>
          </div>
        </div>
      </div>

      {/* Cancel confirmation */}
      <Dialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="Discard changes?"
        description="You have unsaved changes on this product."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmCancel(false)}>
              Keep editing
            </Button>
            <Button variant="destructive" onClick={() => router.back()}>
              Discard &amp; leave
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Tip: use <strong>Save draft</strong> to keep your progress locally before leaving.
        </p>
      </Dialog>
    </div>
  );
}
