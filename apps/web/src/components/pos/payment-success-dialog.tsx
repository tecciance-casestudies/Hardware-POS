'use client';

import { CheckCircle2, Clock, Printer, Plus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import type { CompletedSale } from '@/lib/sales';
import { formatMoney } from '@/lib/utils';

export function PaymentSuccessDialog({
  open,
  sale,
  currency,
  printing,
  onPrintReceipt,
  onNewSale,
}: {
  open: boolean;
  sale: CompletedSale | null;
  currency: string;
  printing: boolean;
  onPrintReceipt: () => void;
  onNewSale: () => void;
}) {
  if (!sale) return null;

  return (
    <Dialog open={open} onClose={onNewSale} className="max-w-sm">
      <div className="flex flex-col items-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success">
          <CheckCircle2 className="h-8 w-8" />
        </span>
        <h2 className="mt-3 text-lg font-semibold">Payment complete</h2>
        <p className="text-sm text-muted-foreground">Sale {sale.saleNumber}</p>

        <div className="mt-5 w-full space-y-2 rounded-xl border border-border p-4 text-sm">
          <Row label="Amount paid" value={formatMoney(sale.paidAmount, currency)} />
          {sale.balanceAmount > 0 ? (
            <Row label="Balance due" value={formatMoney(sale.balanceAmount, currency)} strong />
          ) : null}
          <div className="flex items-center justify-between pt-1">
            <span className="text-muted-foreground">Sync status</span>
            <Badge variant="warning">
              <Clock className="h-3.5 w-3.5" />
              Waiting to Sync
            </Badge>
          </div>
        </div>

        <div className="mt-5 grid w-full grid-cols-1 gap-2">
          <Button variant="outline" size="lg" onClick={onPrintReceipt} disabled={printing}>
            <Printer className="h-4 w-4" />
            {printing ? 'Preparing…' : 'Print customer receipt'}
          </Button>
          <Button size="lg" onClick={onNewSale}>
            <Plus className="h-4 w-4" />
            New sale
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? 'font-semibold text-danger' : 'font-medium'}>{value}</span>
    </div>
  );
}
