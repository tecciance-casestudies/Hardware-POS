'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Trash2, UserPlus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ProductImage } from '@/components/product-image';
import { QuickAddCustomerDialog } from '@/components/pos/quick-add-customer-dialog';
import { useAuth } from '@/lib/auth';
import { Permission } from '@/lib/permissions';
import { fetchProducts, type ManagedProduct } from '@/lib/products-api';
import { fetchCustomers, type ManagedCustomer } from '@/lib/customers-api';
import {
  createQuotation,
  createRevision,
  updateQuotation,
  previewQuotation,
  type DiscountType,
  type QuotationDetail,
  type QuotationItemInput,
  type QuotationPreview,
} from '@/lib/quotations';
import { formatMoney, cn } from '@/lib/utils';

interface Line {
  key: string;
  productId: string | null;
  productName: string;
  sku: string | null;
  imageUrl: string | null;
  unitType: string | null;
  quantity: number;
  unitPrice: number;
  discountType: DiscountType | '';
  discountValue: number;
  itemNote: string;
}

interface Props {
  mode: 'create' | 'edit' | 'revision';
  initial?: QuotationDetail;
}

let keySeq = 0;
const nextKey = () => `l${keySeq++}`;

function lineFromProduct(p: ManagedProduct): Line {
  return {
    key: nextKey(),
    productId: p.id,
    productName: p.name,
    sku: p.sku,
    imageUrl: p.imageUrl,
    unitType: p.unitType,
    quantity: 1,
    unitPrice: p.unitPrice,
    discountType: '',
    discountValue: 0,
    itemNote: '',
  };
}

export function QuotationBuilder({ mode, initial }: Props) {
  const { session, hasPermission } = useAuth();
  const router = useRouter();

  const [products, setProducts] = React.useState<ManagedProduct[]>([]);
  const [customers, setCustomers] = React.useState<ManagedCustomer[]>([]);
  const [addedCustomers, setAddedCustomers] = React.useState<ManagedCustomer[]>([]);
  const [search, setSearch] = React.useState('');
  const [quickAddOpen, setQuickAddOpen] = React.useState(false);

  const [customerId, setCustomerId] = React.useState(initial?.customer?.id ?? '');
  const [lines, setLines] = React.useState<Line[]>(
    initial
      ? initial.items.map((it) => ({
          key: nextKey(),
          productId: it.productId,
          productName: it.productName,
          sku: it.sku,
          imageUrl: it.imageUrl,
          unitType: it.unitType,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discountType: it.discountType ?? '',
          discountValue: it.discountValue ?? 0,
          itemNote: it.itemNote ?? '',
        }))
      : [],
  );
  const [orderDiscountType, setOrderDiscountType] = React.useState<DiscountType | ''>(
    initial?.quotationDiscountType ?? '',
  );
  const [orderDiscountValue, setOrderDiscountValue] = React.useState(
    initial?.quotationDiscountValue ?? 0,
  );
  const [validUntil, setValidUntil] = React.useState(
    initial?.validUntil ? initial.validUntil.slice(0, 10) : '',
  );
  const [notes, setNotes] = React.useState(initial?.notes ?? '');
  const [terms, setTerms] = React.useState(initial?.termsAndConditions ?? '');
  const [changeReason, setChangeReason] = React.useState('');

  const [preview, setPreview] = React.useState<QuotationPreview | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!session) return;
    void fetchProducts(session, { pageSize: 200, isDraft: 'false' }).then((r) =>
      setProducts(r.items.filter((p) => p.isActive !== false)),
    );
    void fetchCustomers(session, { pageSize: 200 }).then((r) => setCustomers(r.items));
  }, [session]);

  const items: QuotationItemInput[] = React.useMemo(
    () =>
      lines.map((l) => ({
        productId: l.productId ?? undefined,
        productName: l.productName,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountType: l.discountType || undefined,
        discountValue: l.discountType ? l.discountValue : undefined,
        itemNote: l.itemNote || undefined,
      })),
    [lines],
  );

  // Debounced server-side recompute — the server is the source of truth.
  React.useEffect(() => {
    if (!session || lines.length === 0) {
      setPreview(null);
      return;
    }
    const handle = window.setTimeout(() => {
      void previewQuotation(session, {
        items,
        quotationDiscountType: orderDiscountType || undefined,
        quotationDiscountValue: orderDiscountType ? orderDiscountValue : undefined,
      })
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 300);
    return () => window.clearTimeout(handle);
  }, [session, items, orderDiscountType, orderDiscountValue, lines.length]);

  if (!session) return null;
  const canAddCustomer = hasPermission(Permission.CUSTOMER_MANAGE);

  const allCustomers = [...addedCustomers, ...customers];
  const filteredProducts = products.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q);
  });

  function addProduct(p: ManagedProduct) {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === p.id);
      if (existing)
        return prev.map((l) => (l.key === existing.key ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, lineFromProduct(p)];
    });
  }

  function patchLine(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  async function save(status: 'DRAFT' | 'SENT') {
    if (!session) return;
    if (lines.length === 0) {
      setError('Add at least one item to the quotation.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const common = {
        customerId: customerId || null,
        quotationDiscountType: orderDiscountType || undefined,
        quotationDiscountValue: orderDiscountType ? orderDiscountValue : undefined,
        validUntil: validUntil || undefined,
        notes: notes || undefined,
        termsAndConditions: terms || undefined,
        items,
      };
      let result: QuotationDetail;
      if (mode === 'edit' && initial) {
        result = await updateQuotation(session, initial.id, { ...common, clearQuotationDiscount: !orderDiscountType });
        if (status === 'SENT') {
          const { markQuotationSent } = await import('@/lib/quotations');
          result = await markQuotationSent(session, initial.id);
        }
      } else if (mode === 'revision' && initial) {
        result = await createRevision(session, initial.id, { ...common, changeReason: changeReason || undefined });
      } else {
        result = await createQuotation(session, { ...common, status });
      }
      router.push(`/quotations/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the quotation');
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.9fr_1fr]">
      {/* Catalog + customer */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="max-w-xs"
          >
            <option value="">Walk-in customer</option>
            {allCustomers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.phone ? ` · ${c.phone}` : ''}
              </option>
            ))}
          </Select>
          {canAddCustomer && (
            <Button
              variant="outline"
              size="icon"
              aria-label="Add customer"
              onClick={() => setQuickAddOpen(true)}
            >
              <UserPlus className="h-4 w-4" />
            </Button>
          )}
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products by name or SKU"
              className="pl-9"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filteredProducts.slice(0, 60).map((p) => (
            <button
              key={p.id}
              onClick={() => addProduct(p)}
              className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition-all hover:border-primary hover:shadow"
            >
              <ProductImage
                src={p.imageUrl}
                alt={p.name}
                rounded="rounded-none"
                className="aspect-square w-full border-0"
              />
              <div className="flex flex-1 flex-col p-2">
                <div className="line-clamp-2 min-h-8 text-xs font-medium leading-tight">{p.name}</div>
                <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{p.sku ?? ''}</div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-sm font-semibold text-primary">
                    {formatMoney(p.unitPrice)}
                  </span>
                  <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                </div>
              </div>
            </button>
          ))}
          {filteredProducts.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
              No products match “{search}”.
            </p>
          )}
        </div>
      </div>

      {/* Quotation panel */}
      <Card className="flex h-fit flex-col lg:sticky lg:top-6">
        <CardHeader className="border-b border-border p-4">
          <CardTitle className="text-base">
            {mode === 'revision' ? 'New revision' : mode === 'edit' ? 'Edit quotation' : 'New quotation'}
          </CardTitle>
        </CardHeader>

        <CardContent className="max-h-[46vh] space-y-2.5 overflow-auto p-3">
          {lines.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Add products to build the quotation.
            </p>
          )}
          {lines.map((l) => (
            <div key={l.key} className="rounded-xl border border-border p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{l.productName}</div>
                  {l.sku && <div className="truncate text-[11px] text-muted-foreground">{l.sku}</div>}
                </div>
                <button
                  onClick={() => removeLine(l.key)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-danger"
                  aria-label="Remove item"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-[11px] text-muted-foreground">
                  Qty
                  <Input
                    type="number"
                    min={0.001}
                    step="any"
                    value={l.quantity}
                    onChange={(e) => patchLine(l.key, { quantity: Number(e.target.value) })}
                    className="mt-0.5 h-9"
                  />
                </label>
                <label className="text-[11px] text-muted-foreground">
                  Unit price
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={l.unitPrice}
                    onChange={(e) => patchLine(l.key, { unitPrice: Number(e.target.value) })}
                    className="mt-0.5 h-9"
                  />
                </label>
                <label className="text-[11px] text-muted-foreground">
                  Discount
                  <Select
                    value={l.discountType}
                    onChange={(e) =>
                      patchLine(l.key, { discountType: e.target.value as DiscountType | '' })
                    }
                    className="mt-0.5 h-9"
                  >
                    <option value="">None</option>
                    <option value="PERCENTAGE">%</option>
                    <option value="FIXED">Rs.</option>
                  </Select>
                </label>
                <label className="text-[11px] text-muted-foreground">
                  Value
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    disabled={!l.discountType}
                    value={l.discountValue}
                    onChange={(e) => patchLine(l.key, { discountValue: Number(e.target.value) })}
                    className="mt-0.5 h-9"
                  />
                </label>
              </div>
              <Input
                value={l.itemNote}
                onChange={(e) => patchLine(l.key, { itemNote: e.target.value })}
                placeholder="Item note (optional)"
                className="mt-2 h-9 text-xs"
              />
            </div>
          ))}
        </CardContent>

        <div className="space-y-2.5 border-t border-border p-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] text-muted-foreground">
              Order discount
              <Select
                value={orderDiscountType}
                onChange={(e) => setOrderDiscountType(e.target.value as DiscountType | '')}
                className="mt-0.5 h-9"
              >
                <option value="">None</option>
                <option value="PERCENTAGE">%</option>
                <option value="FIXED">Rs.</option>
              </Select>
            </label>
            <label className="text-[11px] text-muted-foreground">
              Value
              <Input
                type="number"
                min={0}
                step="any"
                disabled={!orderDiscountType}
                value={orderDiscountValue}
                onChange={(e) => setOrderDiscountValue(Number(e.target.value))}
                className="mt-0.5 h-9"
              />
            </label>
          </div>
          <label className="block text-[11px] text-muted-foreground">
            Valid until
            <Input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="mt-0.5 h-9"
            />
          </label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Quotation notes (optional)"
            className="min-h-14 text-xs"
          />
          <Textarea
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            placeholder="Terms & conditions (optional)"
            className="min-h-14 text-xs"
          />
          {mode === 'revision' && (
            <Input
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              placeholder="Reason for this revision"
              className="h-9 text-xs"
            />
          )}

          <div className="space-y-1 rounded-xl bg-muted/60 p-3 text-sm">
            <Row label="Subtotal" value={formatMoney(preview?.subtotal ?? 0)} />
            {(preview?.productDiscountTotal ?? 0) > 0 && (
              <Row label="Product discounts" value={`- ${formatMoney(preview!.productDiscountTotal)}`} muted />
            )}
            {(preview?.quotationDiscountAmount ?? 0) > 0 && (
              <Row label="Order discount" value={`- ${formatMoney(preview!.quotationDiscountAmount)}`} muted />
            )}
            {(preview?.taxAmount ?? 0) > 0 && (
              <Row label="Tax / VAT" value={formatMoney(preview!.taxAmount)} />
            )}
            <div className="mt-1 flex items-center justify-between border-t border-border pt-1.5 text-base font-semibold">
              <span>Grand total</span>
              <span className="text-primary">{formatMoney(preview?.grandTotal ?? 0)}</span>
            </div>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className={cn('grid gap-2', mode === 'create' ? 'grid-cols-2' : 'grid-cols-1')}>
            {mode === 'create' && (
              <Button variant="outline" disabled={submitting} onClick={() => save('DRAFT')}>
                Save draft
              </Button>
            )}
            <Button disabled={submitting} onClick={() => save(mode === 'create' ? 'SENT' : 'DRAFT')}>
              {mode === 'revision'
                ? 'Save revision'
                : mode === 'edit'
                  ? 'Save changes'
                  : 'Save & send'}
            </Button>
          </div>
        </div>
      </Card>

      <QuickAddCustomerDialog
        open={quickAddOpen}
        session={session}
        onClose={() => setQuickAddOpen(false)}
        onCreated={(customer) => {
          setAddedCustomers((prev) => [customer, ...prev]);
          setCustomerId(customer.id);
          setQuickAddOpen(false);
        }}
      />
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? 'text-muted-foreground' : ''}>{label}</span>
      <span className={muted ? 'text-muted-foreground' : ''}>{value}</span>
    </div>
  );
}
