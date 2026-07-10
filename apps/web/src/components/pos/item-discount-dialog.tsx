'use client';

import { ShieldAlert } from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { computeDiscount, type DiscountType, type LineDiscount } from '@/lib/cart';
import { withinDiscountLimit } from '@/lib/permissions';
import { cn, formatMoney, round2 } from '@/lib/utils';

export function ItemDiscountDialog({
  open,
  productName,
  unitPrice,
  quantity,
  currency,
  roleLimit,
  initial,
  onApply,
  onClear,
  onClose,
}: {
  open: boolean;
  productName: string;
  unitPrice: number;
  quantity: number;
  currency: string;
  /** Acting user's discount limit (% of line); null = unlimited. */
  roleLimit: number | null;
  initial?: LineDiscount;
  onApply: (discount: LineDiscount) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [type, setType] = React.useState<DiscountType>(initial?.type ?? 'PERCENTAGE');
  const [value, setValue] = React.useState<string>(initial ? String(initial.value) : '');
  const [reason, setReason] = React.useState(initial?.reason ?? '');

  React.useEffect(() => {
    if (open) {
      setType(initial?.type ?? 'PERCENTAGE');
      setValue(initial ? String(initial.value) : '');
      setReason(initial?.reason ?? '');
    }
  }, [open, initial]);

  const numeric = Number(value) || 0;
  const lineSubtotal = round2(unitPrice * quantity);
  const discountAmount = computeDiscount(lineSubtotal, { type, value: numeric });
  const lineTotal = round2(lineSubtotal - discountAmount);
  const effectivePercent = lineSubtotal > 0 ? (discountAmount / lineSubtotal) * 100 : 0;
  const needsApproval = numeric > 0 && !withinDiscountLimit(roleLimit, effectivePercent);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Product discount"
      description={productName}
      footer={
        <>
          {initial ? (
            <Button variant="ghost" className="mr-auto text-danger" onClick={onClear}>
              Remove
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={numeric <= 0}
            onClick={() => onApply({ type, value: numeric, reason: reason.trim() || undefined })}
          >
            {needsApproval ? 'Request approval' : 'Apply discount'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted px-4 py-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Unit price</div>
            <div className="font-medium">{formatMoney(unitPrice, currency)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Quantity</div>
            <div className="font-medium">{quantity}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(['PERCENTAGE', 'FIXED'] as DiscountType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={cn(
                'rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors',
                type === t
                  ? 'border-primary bg-brand-50 text-brand-700'
                  : 'border-border text-muted-foreground hover:bg-muted',
              )}
            >
              {t === 'PERCENTAGE' ? 'Percentage (%)' : 'Fixed amount'}
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="discount-value">
            {type === 'PERCENTAGE' ? 'Percentage off' : 'Amount off'}
          </Label>
          <Input
            id="discount-value"
            inputMode="decimal"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={type === 'PERCENTAGE' ? 'e.g. 10' : 'e.g. 5.00'}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="discount-reason">Reason / note (optional)</Label>
          <Input
            id="discount-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. bulk order"
          />
        </div>

        <div className="space-y-1.5 rounded-xl border border-border p-4 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Discount</span>
            <span>-{formatMoney(discountAmount, currency)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold">
            <span>Line total</span>
            <span>{formatMoney(lineTotal, currency)}</span>
          </div>
        </div>

        {needsApproval ? (
          <Badge variant="warning" className="w-full justify-center py-1.5">
            <ShieldAlert className="h-3.5 w-3.5" />
            {roleLimit === 0
              ? 'Any discount needs manager approval'
              : `Exceeds your ${roleLimit}% limit — manager approval required`}
          </Badge>
        ) : null}
      </div>
    </Dialog>
  );
}
