'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  Delete,
  Landmark,
  Plus,
  Printer,
  QrCode,
  ReceiptText,
  ScrollText,
  Split,
  Trash2,
  type LucideIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/lib/auth';
import { computeLine, computeTotals } from '@/lib/cart';
import { useCheckoutData } from '@/lib/catalog';
import { usePosCart } from '@/lib/pos-cart';
import { printCustomerReceipt, type ReceiptContext } from '@/lib/receipt-print';
import {
  completeSale,
  DEV_BRANCH_ID,
  DEV_REGISTER_ID,
  type CompletedSale,
  type CompleteSaleDto,
  type PaymentMethodCode,
} from '@/lib/sales';
import { cn, formatMoney, round2 } from '@/lib/utils';

type Mode = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'QR_PAYMENT' | 'CHECK' | 'SPLIT' | 'PARTIAL' | 'CREDIT';

interface MethodOption {
  key: Mode;
  label: string;
  Icon: LucideIcon;
}

const METHODS: MethodOption[] = [
  { key: 'CASH', label: 'Cash', Icon: Banknote },
  { key: 'CARD', label: 'Card', Icon: CreditCard },
  { key: 'BANK_TRANSFER', label: 'Bank Transfer', Icon: Landmark },
  { key: 'QR_PAYMENT', label: 'QR Payment', Icon: QrCode },
  { key: 'CHECK', label: 'Cheque', Icon: ScrollText },
  { key: 'SPLIT', label: 'Split Payment', Icon: Split },
  { key: 'PARTIAL', label: 'Partial Payment', Icon: Coins },
  { key: 'CREDIT', label: 'Credit / Pay Later', Icon: Clock },
];

const SPLIT_METHODS: { value: PaymentMethodCode; label: string }[] = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'QR_PAYMENT', label: 'QR Payment' },
  { value: 'CHECK', label: 'Cheque' },
];

interface SplitLine {
  id: number;
  method: PaymentMethodCode;
  amount: string;
  reference: string;
}

let splitLineSeq = 1;

export default function PaymentPage() {
  const { session } = useAuth();
  const router = useRouter();
  const data = useCheckoutData(session!);
  const cart = usePosCart();

  const currency = data.settings.currency;
  const totals = computeTotals(cart.items, data.settings.taxRatePercent, cart.orderDiscount);
  const total = totals.total;

  const [mode, setMode] = React.useState<Mode>('CASH');
  const [tendered, setTendered] = React.useState('');
  const [reference, setReference] = React.useState('');
  const [partialAmount, setPartialAmount] = React.useState('');
  const [partialMethod, setPartialMethod] = React.useState<PaymentMethodCode>('CASH');
  const [splitLines, setSplitLines] = React.useState<SplitLine[]>([]);
  const [printAfter, setPrintAfter] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [completed, setCompleted] = React.useState<CompletedSale | null>(null);
  const [receiptCtx, setReceiptCtx] = React.useState<ReceiptContext | null>(null);
  const [printing, setPrinting] = React.useState(false);

  // Selected customers always pass through cart.addCustomer, so the cart's own
  // list is sufficient to resolve the display name.
  const customerName =
    cart.addedCustomers.find((c) => c.id === cart.customerId)?.name ?? 'Walk-in customer';
  const hasCustomer = !!cart.customerId;

  // Redirect back to the cart if it emptied (but not right after a successful sale).
  React.useEffect(() => {
    if (cart.hydrated && cart.items.length === 0 && !completed) {
      router.replace('/pos');
    }
  }, [cart.hydrated, cart.items.length, completed, router]);

  React.useEffect(() => {
    setTendered(total ? total.toFixed(2) : '');
  }, [total]);

  // ── derive payments from the selected mode ─────────────────────────────────
  const splitPaid = round2(splitLines.reduce((s, l) => s + (Number(l.amount) || 0), 0));

  let paidAmount = 0;
  let payments: { method: PaymentMethodCode; amount: number; reference?: string }[] = [];
  if (mode === 'CASH') {
    paidAmount = total;
    payments = [{ method: 'CASH', amount: total }];
  } else if (mode === 'CARD' || mode === 'BANK_TRANSFER' || mode === 'QR_PAYMENT' || mode === 'CHECK') {
    paidAmount = total;
    payments = [{ method: mode, amount: total, reference: reference.trim() || undefined }];
  } else if (mode === 'PARTIAL') {
    paidAmount = round2(Number(partialAmount) || 0);
    payments =
      paidAmount > 0
        ? [{ method: partialMethod, amount: paidAmount, reference: reference.trim() || undefined }]
        : [];
  } else if (mode === 'SPLIT') {
    paidAmount = splitPaid;
    payments = splitLines
      .filter((l) => (Number(l.amount) || 0) > 0)
      .map((l) => ({
        method: l.method,
        amount: round2(Number(l.amount)),
        reference: l.reference.trim() || undefined,
      }));
  } else {
    // CREDIT
    paidAmount = 0;
    payments = [];
  }

  const balance = Math.max(0, round2(total - paidAmount));
  const change =
    mode === 'CASH' ? round2(Math.max(0, (Number(tendered) || 0) - total)) : 0;
  const needsCustomer = paidAmount < total; // partial or credit → invoice needs a customer

  const invalid =
    submitting ||
    cart.items.length === 0 ||
    totals.hasStockIssue ||
    (needsCustomer && !hasCustomer) ||
    (mode === 'CASH' && (Number(tendered) || 0) < total) ||
    (mode === 'PARTIAL' && (paidAmount <= 0 || paidAmount >= total)) ||
    (mode === 'SPLIT' && (payments.length === 0 || paidAmount > total));

  const numpadTarget = mode === 'CASH' ? 'tendered' : mode === 'PARTIAL' ? 'partial' : null;
  const appendDigit = (d: string) => {
    if (!numpadTarget) return;
    const set = numpadTarget === 'tendered' ? setTendered : setPartialAmount;
    set((prev) => {
      if (d === 'back') return prev.slice(0, -1);
      if (d === '.' && prev.includes('.')) return prev;
      return prev + d;
    });
  };

  const quickAmounts = React.useMemo(() => {
    const base = Math.ceil(total);
    const rounds = [base, Math.ceil(base / 500) * 500, Math.ceil(base / 1000) * 1000, Math.ceil(base / 5000) * 5000];
    return [...new Set(rounds)].filter((n) => n >= base).slice(0, 4);
  }, [total]);

  const addSplitLine = () =>
    setSplitLines((lines) => [
      ...lines,
      { id: splitLineSeq++, method: 'CASH', amount: String(balance || ''), reference: '' },
    ]);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const dto: CompleteSaleDto = {
        branchId: DEV_BRANCH_ID,
        registerId: DEV_REGISTER_ID,
        customerId: cart.customerId || undefined,
        items: cart.items.map((it) => ({
          productId: it.product.id,
          quantity: it.quantity,
          discountType: it.discount?.type,
          discountValue: it.discount?.value,
          discountReason: it.discount?.reason,
          approvalToken: it.approvalToken,
        })),
        payments,
        orderDiscountType: cart.orderDiscount?.type,
        orderDiscountValue: cart.orderDiscount?.value,
        orderDiscountReason: cart.orderDiscount?.reason,
        orderApprovalToken: cart.orderApprovalToken,
      };
      const sale = await completeSale(session!, dto);
      const ctx: ReceiptContext = {
        currency,
        customerName,
        items: cart.items,
        subtotal: totals.subtotal,
        totalDiscount: totals.totalDiscount,
        orderDiscount: totals.orderDiscountAmount,
        taxAmount: totals.taxAmount,
        storeName: 'Hardware POS',
      };
      setReceiptCtx(ctx);
      setCompleted(sale);
      cart.clearCart();
      if (printAfter) {
        setPrinting(true);
        try {
          await printCustomerReceipt(session!, sale, ctx);
        } finally {
          setPrinting(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete the sale');
      // The failure may be another register beating us to the stock (or a
      // price change) — refresh the catalog so the cart reflects reality.
      data.reload();
    } finally {
      setSubmitting(false);
    }
  };

  // Push freshly loaded catalog data into the cart's product snapshots so
  // stock warnings and totals track reality after a reload.
  React.useEffect(() => {
    if (!data.loading && !data.error) cart.refreshProducts(data.products);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.products, data.loading, data.error]);

  const printReceipt = async () => {
    if (!completed || !receiptCtx) return;
    setPrinting(true);
    try {
      await printCustomerReceipt(session!, completed, receiptCtx);
    } finally {
      setPrinting(false);
    }
  };

  // ── success screen ─────────────────────────────────────────────────────────
  if (completed) {
    return (
      <SuccessView
        sale={completed}
        currency={currency}
        printing={printing}
        onPrint={printReceipt}
        onViewSale={() => router.push(`/sales/${completed.id}`)}
        onNewSale={() => router.push('/pos')}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Payment</h1>
          <p className="text-sm text-muted-foreground">{customerName}</p>
        </div>
        <Button variant="outline" onClick={() => router.push('/pos')}>
          <ArrowLeft className="h-4 w-4" />
          Back to Cart
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
        {/* Order summary */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Order summary ({totals.itemCount} items)</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-border bg-muted/50 text-left text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Item</th>
                  <th className="px-4 py-2.5 text-right font-medium">Price</th>
                  <th className="px-4 py-2.5 text-right font-medium">Qty</th>
                  <th className="px-4 py-2.5 text-right font-medium">Disc</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {cart.items.map((it) => {
                  const line = computeLine(it);
                  return (
                    <tr key={it.product.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{it.product.name}</div>
                        <div className="text-xs text-muted-foreground">{it.product.sku ?? ''}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right">{formatMoney(it.product.unitPrice, currency)}</td>
                      <td className="px-4 py-2.5 text-right">{it.quantity}</td>
                      <td className="px-4 py-2.5 text-right text-success">
                        {line.discountAmount > 0 ? `-${formatMoney(line.discountAmount, currency)}` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium">{formatMoney(line.lineTotal, currency)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <CardContent className="space-y-1.5 border-t border-border pt-4 text-sm">
            <Row label="Subtotal" value={formatMoney(totals.subtotal, currency)} />
            <Row label="Product discount" value={`-${formatMoney(totals.totalDiscount, currency)}`} tone="success" />
            {totals.orderDiscountAmount > 0 ? (
              <Row label="Order discount" value={`-${formatMoney(totals.orderDiscountAmount, currency)}`} tone="success" />
            ) : null}
            <Row label={`Tax / VAT (${data.settings.taxRatePercent}%)`} value={formatMoney(totals.taxAmount, currency)} />
            <div className="mt-1 flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2.5 text-base font-semibold text-brand-700">
              <span>Grand Total</span>
              <span>{formatMoney(total, currency)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Payment method + entry */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Select payment method</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {METHODS.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => {
                      setMode(m.key);
                      setError(null);
                      if (m.key === 'SPLIT' && splitLines.length === 0) {
                        setSplitLines([{ id: splitLineSeq++, method: 'CASH', amount: total.toFixed(2), reference: '' }]);
                      }
                    }}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center text-xs font-medium transition-colors',
                      mode === m.key
                        ? 'border-primary bg-brand-50 text-brand-700'
                        : 'border-border text-muted-foreground hover:bg-muted',
                    )}
                  >
                    <m.Icon className="h-5 w-5" />
                    {m.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Amount due</span>
                <span className="text-lg font-semibold text-primary">{formatMoney(total, currency)}</span>
              </div>

              {mode === 'CASH' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="tendered">Amount received</Label>
                      <Input id="tendered" inputMode="decimal" value={tendered} onChange={(e) => setTendered(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Change</Label>
                      <div className="flex h-11 items-center rounded-xl bg-success-soft px-4 text-sm font-semibold text-success">
                        {formatMoney(change, currency)}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {quickAmounts.map((n) => (
                      <button
                        key={n}
                        onClick={() => setTendered(n.toFixed(2))}
                        className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                      >
                        {formatMoney(n, currency)}
                      </button>
                    ))}
                  </div>
                  <Numpad onPress={appendDigit} />
                </>
              ) : null}

              {mode === 'CARD' || mode === 'BANK_TRANSFER' || mode === 'QR_PAYMENT' || mode === 'CHECK' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="ref">{mode === 'CHECK' ? 'Cheque number' : 'Reference'} (optional)</Label>
                  <Input id="ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. txn / auth ref" />
                </div>
              ) : null}

              {mode === 'PARTIAL' ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="partial">Amount paid now</Label>
                      <Input id="partial" inputMode="decimal" placeholder="0.00" value={partialAmount} onChange={(e) => setPartialAmount(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pmethod">Paid by</Label>
                      <Select id="pmethod" value={partialMethod} onChange={(e) => setPartialMethod(e.target.value as PaymentMethodCode)}>
                        {SPLIT_METHODS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                  <Numpad onPress={appendDigit} />
                </div>
              ) : null}

              {mode === 'SPLIT' ? (
                <div className="space-y-3">
                  {splitLines.map((l, i) => (
                    <div key={l.id} className="flex items-center gap-2">
                      <Select
                        value={l.method}
                        onChange={(e) =>
                          setSplitLines((ls) => ls.map((x) => (x.id === l.id ? { ...x, method: e.target.value as PaymentMethodCode } : x)))
                        }
                        className="w-36"
                      >
                        {SPLIT_METHODS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </Select>
                      <Input
                        inputMode="decimal"
                        value={l.amount}
                        placeholder="0.00"
                        onChange={(e) => setSplitLines((ls) => ls.map((x) => (x.id === l.id ? { ...x, amount: e.target.value } : x)))}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-danger"
                        aria-label="Remove"
                        onClick={() => setSplitLines((ls) => ls.filter((x) => x.id !== l.id))}
                        disabled={splitLines.length <= 1 && i === 0}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addSplitLine}>
                    <Plus className="h-4 w-4" /> Add payment
                  </Button>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Paid</span>
                    <span className="font-medium">{formatMoney(paidAmount, currency)}</span>
                  </div>
                </div>
              ) : null}

              {mode === 'CREDIT' ? (
                <p className="rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
                  The full amount will be recorded as credit (an Invoice). A customer is required.
                </p>
              ) : null}

              {/* Totals line */}
              <div className="space-y-1.5 border-t border-border pt-3 text-sm">
                <Row label="Paid" value={formatMoney(paidAmount, currency)} />
                <Row label="Balance" value={formatMoney(balance, currency)} tone={balance > 0 ? 'danger' : undefined} />
              </div>

              {totals.hasStockIssue ? (
                <p className="text-sm text-danger">
                  Some items exceed available stock — go back to the cart to adjust quantities.
                </p>
              ) : null}
              {needsCustomer && !hasCustomer ? (
                <p className="text-sm text-warning">Select a customer for a credit or partial sale.</p>
              ) : null}
              {error ? <p className="text-sm text-danger">{error}</p> : null}

              <div className="flex items-center justify-between rounded-xl border border-border p-3">
                <span className="text-sm">Print receipt after payment</span>
                <Switch checked={printAfter} onCheckedChange={setPrintAfter} />
              </div>

              <Button size="lg" className="w-full" disabled={invalid} onClick={submit}>
                {submitting ? 'Completing…' : `Complete Payment · ${formatMoney(total, currency)}`}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Numpad({ onPress }: { onPress: (d: string) => void }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'];
  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((k) => (
        <button
          key={k}
          onClick={() => onPress(k)}
          className="flex h-12 items-center justify-center rounded-xl border border-border text-lg font-medium hover:bg-muted"
        >
          {k === 'back' ? <Delete className="h-5 w-5" /> : k}
        </button>
      ))}
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'danger' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          'font-medium',
          tone === 'success' && 'text-success',
          tone === 'danger' && 'font-semibold text-danger',
          !tone && 'text-foreground',
        )}
      >
        {value}
      </span>
    </div>
  );
}

function SuccessView({
  sale,
  currency,
  printing,
  onPrint,
  onViewSale,
  onNewSale,
}: {
  sale: CompletedSale;
  currency: string;
  printing: boolean;
  onPrint: () => void;
  onViewSale?: () => void;
  onNewSale: () => void;
}) {
  return (
    <Dialog open onClose={onNewSale} className="max-w-sm">
      <div className="flex flex-col items-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success">
          <CheckCircle2 className="h-8 w-8" />
        </span>
        <h2 className="mt-3 text-lg font-semibold">Payment complete</h2>
        <p className="text-sm text-muted-foreground">Sale {sale.saleNumber}</p>

        <div className="mt-5 w-full space-y-2 rounded-xl border border-border p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Amount paid</span>
            <span className="font-medium">{formatMoney(sale.paidAmount, currency)}</span>
          </div>
          {sale.balanceAmount > 0 ? (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Balance due</span>
              <span className="font-semibold text-danger">{formatMoney(sale.balanceAmount, currency)}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between pt-1">
            <span className="text-muted-foreground">Sync status</span>
            <Badge variant="warning">
              <Clock className="h-3.5 w-3.5" />
              Waiting to Sync
            </Badge>
          </div>
        </div>

        <div className="mt-5 grid w-full gap-2">
          <Button variant="outline" size="lg" onClick={onPrint} disabled={printing}>
            <Printer className="h-4 w-4" />
            {printing ? 'Preparing…' : 'Print customer receipt'}
          </Button>
          {onViewSale ? (
            <Button variant="outline" size="lg" onClick={onViewSale}>
              <ReceiptText className="h-4 w-4" />
              View sale
            </Button>
          ) : null}
          <Button size="lg" onClick={onNewSale}>
            <Plus className="h-4 w-4" />
            New sale
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
