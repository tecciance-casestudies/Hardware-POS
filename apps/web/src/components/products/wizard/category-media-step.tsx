'use client';

import Link from 'next/link';
import { ImagePlus, Loader2, Settings2, Trash2, UploadCloud } from 'lucide-react';
import * as React from 'react';

import { ProductImage } from '@/components/product-image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { CategoryNode } from '@/lib/products-api';
import { Field, InfoPanel, StepHeader } from './fields';
import type { FormState, SetField } from './types';

export function CategoryMediaStep({
  form,
  set,
  setCategory,
  categories,
  imageSrc,
  imageBusy,
  onPickFile,
  onRemoveImage,
  stepLabel,
}: {
  form: FormState;
  set: SetField;
  setCategory: (categoryId: string) => void;
  categories: CategoryNode[];
  imageSrc: string | null;
  imageBusy: boolean;
  onPickFile: (file: File) => void;
  onRemoveImage: () => void;
  stepLabel: string;
}) {
  const fileInput = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const subcategories = categories.find((c) => c.id === form.categoryId)?.subcategories ?? [];

  const handleFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (f) onPickFile(f);
  };

  return (
    <div className="space-y-5">
      <StepHeader
        eyebrow={stepLabel}
        title="Category & image"
        description="Group the product and add a photo — both help cashiers find it quickly in the POS."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Category */}
        <div className="space-y-4 rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Category</h3>
            <Button asChild variant="link" size="sm">
              <Link href="/products/categories">
                <Settings2 className="mr-1 h-3.5 w-3.5" /> Manage categories
              </Link>
            </Button>
          </div>

          <Field label="Main category" htmlFor="field-category">
            <Select id="field-category" value={form.categoryId} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Subcategory" htmlFor="field-subcategory">
            <Select
              id="field-subcategory"
              value={form.subcategoryId}
              onChange={(e) => set('subcategoryId', e.target.value)}
              disabled={subcategories.length === 0}
            >
              <option value="">
                {!form.categoryId
                  ? 'Select a category first'
                  : subcategories.length === 0
                    ? 'No subcategories'
                    : 'None'}
              </option>
              {subcategories.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>

          {form.categoryId && subcategories.length === 0 ? (
            <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              No subcategories have been added to this category.{' '}
              <Link href="/products/categories" className="text-primary hover:underline">
                Add a subcategory
              </Link>
              .
            </p>
          ) : null}
        </div>

        {/* Image */}
        <div className="space-y-3 rounded-2xl border border-border bg-surface p-5">
          <h3 className="text-sm font-semibold">Product image</h3>

          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />

          {imageSrc ? (
            <div className="space-y-3">
              <ProductImage src={imageSrc} alt={form.name || 'Product image'} className="aspect-square w-full rounded-xl" />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={imageBusy}
                  leftIcon={imageBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  onClick={() => fileInput.current?.click()}
                >
                  Replace
                </Button>
                <Button variant="ghost" className="text-danger" disabled={imageBusy} onClick={onRemoveImage} aria-label="Remove image">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFiles(e.dataTransfer.files);
              }}
              className={cn(
                'flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors',
                dragOver ? 'border-brand-600 bg-brand-50' : 'border-border bg-muted/30 hover:bg-muted',
              )}
            >
              {imageBusy ? (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              ) : (
                <UploadCloud className="h-8 w-8 text-muted-foreground" />
              )}
              <span className="text-sm font-medium">Upload or drag &amp; drop an image</span>
              <span className="text-xs text-muted-foreground">Square image recommended · PNG, JPG or WebP · max 5 MB</span>
            </button>
          )}

          <Field label="Image alt text" htmlFor="field-alt" help="A short description used for accessibility.">
            <Input
              id="field-alt"
              value={form.imageAltText}
              onChange={(e) => set('imageAltText', e.target.value)}
              placeholder="Describe the image"
            />
          </Field>
        </div>
      </div>

      <InfoPanel>A clear product image helps cashiers find the item faster.</InfoPanel>
    </div>
  );
}
