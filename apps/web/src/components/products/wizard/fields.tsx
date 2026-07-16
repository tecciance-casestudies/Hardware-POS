'use client';

import { HelpCircle, Info } from 'lucide-react';
import * as React from 'react';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/** Labelled field with optional required marker, hint, help tooltip and inline error. */
export function Field({
  label,
  htmlFor,
  required,
  hint,
  help,
  error,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  help?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={htmlFor} className="flex items-center gap-1.5">
          {label}
          {required ? <span className="text-danger"> *</span> : null}
          {help ? (
            <Tooltip label={help}>
              <span className="text-muted-foreground" aria-label={help}>
                <HelpCircle className="h-3.5 w-3.5" />
              </span>
            </Tooltip>
          ) : null}
        </Label>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
      {error ? (
        <p id={errorId} className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** A bordered toggle row (Track inventory, Taxable, etc.). */
export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border p-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

/** A soft, non-technical guidance panel shown inside a step. */
export function InfoPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
      <span className="text-muted-foreground">{children}</span>
    </div>
  );
}

/** The step title + helper description shown at the top of each step's content. */
export function StepHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold uppercase tracking-wide text-brand-600">{eyebrow}</div>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
