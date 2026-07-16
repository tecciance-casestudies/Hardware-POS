'use client';

import {
  ChevronDown,
  ChevronUp,
  Copy,
  GripVertical,
  MoreVertical,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { VariationAttribute } from '@/lib/variations/types';
import type { VariationStore } from '@/lib/variations/variation-store';

import { Chip } from './shared';

const QUICK_START = ['Color', 'Size', 'Finish'];

export function AttributeBuilder({ store }: { store: VariationStore }) {
  const { data } = store;

  if (data.attributes.length === 0) {
    return <AttributeEmptyState store={store} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Variation attributes</h3>
          <p className="text-xs text-muted-foreground">
            Add up to a few axes (e.g. Color, Size, Finish). Every combination becomes a variant.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {data.attributes.map((attr, i) => (
          <AttributeCard
            key={attr.id}
            store={store}
            attribute={attr}
            index={i}
            total={data.attributes.length}
          />
        ))}
      </div>

      <Button variant="outline" leftIcon={<Plus className="h-4 w-4" />} onClick={() => store.addAttribute()}>
        Add another attribute
      </Button>
    </div>
  );
}

function AttributeEmptyState({ store }: { store: VariationStore }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-8 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-600">
        <Sparkles className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-base font-semibold">No variation attributes yet</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Create attributes such as Color, Size, Finish, Material, Length, Pack Size, or any
        custom option. Each attribute&rsquo;s values are combined into variants.
      </p>
      <div className="mt-5 flex flex-col items-center gap-3">
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => store.addAttribute()}>
          Add first attribute
        </Button>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs text-muted-foreground">Quick start:</span>
          {QUICK_START.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => store.addAttribute(name)}
              className="rounded-lg border border-border bg-surface px-3 py-1 text-xs font-medium hover:bg-muted"
            >
              {name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AttributeCard({
  store,
  attribute,
  index,
  total,
}: {
  store: VariationStore;
  attribute: VariationAttribute;
  index: number;
  total: number;
}) {
  const [draft, setDraft] = React.useState('');
  const [rejected, setRejected] = React.useState<string[]>([]);
  const [menuOpen, setMenuOpen] = React.useState(false);

  const nameCollision = store.data.attributes.some(
    (a) => a.id !== attribute.id && a.name.trim() && a.name.trim().toLowerCase() === attribute.name.trim().toLowerCase(),
  );

  const commit = () => {
    const value = draft.trim();
    if (!value) return;
    const rej = store.addOptions(attribute.id, draft);
    setRejected(rej);
    setDraft('');
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start gap-2">
        <span
          className="mt-2.5 hidden cursor-grab text-muted-foreground sm:block"
          aria-hidden
          title="Drag to reorder (or use the move actions)"
        >
          <GripVertical className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="grid gap-1.5">
            <Label htmlFor={`attr-${attribute.id}`}>Attribute name</Label>
            <Input
              id={`attr-${attribute.id}`}
              value={attribute.name}
              onChange={(e) => store.renameAttribute(attribute.id, e.target.value)}
              placeholder="e.g. Color, Size, Finish"
              aria-invalid={nameCollision || undefined}
              className={cn(nameCollision && 'border-danger focus-visible:ring-danger')}
            />
            {nameCollision ? (
              <p className="text-xs text-danger">Another attribute already uses this name.</p>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`opt-${attribute.id}`}>Options</Label>
            {attribute.options.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {attribute.options.map((o) => (
                  <Chip
                    key={o.id}
                    tone="brand"
                    onRemove={() => store.removeOption(attribute.id, o.id)}
                    removeLabel={`Remove ${o.value}`}
                  >
                    {o.value}
                  </Chip>
                ))}
              </div>
            ) : null}
            <div className="flex gap-2">
              <Input
                id={`opt-${attribute.id}`}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  if (rejected.length) setRejected([]);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    commit();
                  }
                }}
                placeholder="Type a value and press Enter"
                aria-describedby={`opt-hint-${attribute.id}`}
              />
              <Button variant="outline" onClick={commit} disabled={!draft.trim()}>
                Add
              </Button>
            </div>
            <p id={`opt-hint-${attribute.id}`} className="text-xs text-muted-foreground">
              Press Enter or type a comma to add. Duplicate values are skipped.
            </p>
            {rejected.length ? (
              <p className="text-xs text-warning">
                Already added: {rejected.join(', ')}
              </p>
            ) : null}
          </div>
        </div>

        {/* Actions: one primary-ish "add option" affordance is the input above;
            secondary actions live in a compact More menu. */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Attribute actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
          {menuOpen ? (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
              <div
                role="menu"
                className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg"
              >
                <MenuItem
                  icon={<ChevronUp className="h-4 w-4" />}
                  disabled={index === 0}
                  onClick={() => {
                    store.moveAttribute(attribute.id, 'up');
                    setMenuOpen(false);
                  }}
                >
                  Move up
                </MenuItem>
                <MenuItem
                  icon={<ChevronDown className="h-4 w-4" />}
                  disabled={index === total - 1}
                  onClick={() => {
                    store.moveAttribute(attribute.id, 'down');
                    setMenuOpen(false);
                  }}
                >
                  Move down
                </MenuItem>
                <MenuItem
                  icon={<Copy className="h-4 w-4" />}
                  onClick={() => {
                    store.duplicateAttribute(attribute.id);
                    setMenuOpen(false);
                  }}
                >
                  Duplicate
                </MenuItem>
                <MenuItem
                  icon={<Trash2 className="h-4 w-4" />}
                  destructive
                  onClick={() => {
                    store.removeAttribute(attribute.id);
                    setMenuOpen(false);
                  }}
                >
                  Delete
                </MenuItem>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  children,
  onClick,
  disabled,
  destructive,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-40',
        destructive && 'text-danger hover:bg-danger-soft',
      )}
    >
      {icon}
      {children}
    </button>
  );
}
