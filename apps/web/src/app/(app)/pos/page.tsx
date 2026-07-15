'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Minus,
  NotebookPen,
  Plus,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
  UserPlus,
  Warehouse,
} from 'lucide-react';

import { CustomerCombobox } from '@/components/pos/customer-combobox';
import { ItemDiscountDialog } from '@/components/pos/item-discount-dialog';
import { ItemNoteDialog } from '@/components/pos/item-note-dialog';
import { ManagerApprovalDialog } from '@/components/pos/manager-approval-dialog';
import { OrderDiscountDialog } from '@/components/pos/order-discount-dialog';
import { QuickAddCustomerDialog } from '@/components/pos/quick-add-customer-dialog';
import { ProductImage } from '@/components/product-image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useAuth } from '@/lib/auth';
import { computeLine, computeTotals, type LineDiscount, type OrderDiscount } from '@/lib/cart';
import { useCheckoutData, type ClientProduct } from '@/lib/catalog';
import { ORDER_DISCOUNT_KEY, requestDiscountApproval } from '@/lib/discounts';
import { Permission, discountLimitFor, withinDiscountLimit } from '@/lib/permissions';
import { usePosCart } from '@/lib/pos-cart';
import { cn, formatMoney, round2 } from '@/lib/utils';

const PAGE_SIZES = [20, 30, 40, 50];

interface PendingLineApproval {
  productId: string;
  discount: LineDiscount;
  percent: number;
}

export default function PosPage() {
  const { session, hasPermission } = useAuth();
  const router = useRouter();
  const data = useCheckoutData(session!);
  const cart = usePosCart();
  const canAddCustomer = hasPermission(Permission.CUSTOMER_MANAGE);

  const [query, setQuery] = React.useState('');
  const [category, setCategory] = React.useState('All');
  const [subcategory, setSubcategory] = React.useState('All');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [noteFor, setNoteFor] = React.useState<string | null>(null);
  const [discountFor, setDiscountFor] = React.useState<string | null>(null);
  const [pendingApproval, setPendingApproval] = React.useState<PendingLineApproval | null>(null);
  const [orderDiscountOpen, setOrderDiscountOpen] = React.useState(false);
  const [pendingOrderApproval, setPendingOrderApproval] = React.useState<{
    discount: OrderDiscount;
    percent: number;
  } | null>(null);
  const [quickAddOpen, setQuickAddOpen] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  };

  // Keep the cart's product snapshots aligned with each fresh catalog load,
  // so stock warnings reflect sales made on other registers.
  React.useEffect(() => {
    if (!data.loading && !data.error) cart.refreshProducts(data.products);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.products, data.loading, data.error]);

  // ── catalog filtering + pagination ─────────────────────────────────────────
  const categories = ['All', ...data.categories];
  const activeCategory = data.categoryTree.find((c) => c.name === category);
  const subcategories =
    category !== 'All' && activeCategory && activeCategory.subcategories.length > 0
      ? ['All', ...activeCategory.subcategories.map((s) => s.name)]
      : [];
  const q = query.trim().toLowerCase();
  const filtered = React.useMemo(
    () =>
      data.products.filter((p) => {
        const matchesCat = category === 'All' || p.categoryName === category;
        const matchesSub = subcategory === 'All' || p.subcategoryName === subcategory;
        const matchesQuery =
          !q ||
          p.name.toLowerCase().includes(q) ||
          (p.sku ?? '').toLowerCase().includes(q) ||
          (p.barcode ?? '').toLowerCase().includes(q);
        return matchesCat && matchesSub && matchesQuery;
      }),
    [data.products, category, subcategory, q],
  );

  React.useEffect(() => setPage(1), [q, category, subcategory, pageSize]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageProducts = filtered.slice((page - 1) * pageSize, page * pageSize);

  const addToCart = (product: ClientProduct) => {
    cart.addToCart(product);
    showToast(`${product.name} added`);
  };

  // Barcode/scanner: Enter adds an exact barcode/SKU match, else the sole result.
  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const exact = filtered.find(
      (p) => (p.barcode ?? '').toLowerCase() === q || (p.sku ?? '').toLowerCase() === q,
    );
    const target = exact ?? (filtered.length === 1 ? filtered[0] : undefined);
    if (target) {
      addToCart(target);
      setQuery('');
    }
  };

  // ── discounts ──────────────────────────────────────────────────────────────
  const handleLineDiscountApply = (productId: string, discount: LineDiscount) => {
    const item = cart.items.find((it) => it.product.id === productId);
    if (!item) return;
    const line = computeLine({ ...item, discount });
    const percent = line.lineSubtotal > 0 ? (line.discountAmount / line.lineSubtotal) * 100 : 0;
    if (withinDiscountLimit(discountLimitFor(session!.user.role), percent)) {
      cart.setLineDiscount(productId, discount);
      setDiscountFor(null);
    } else {
      setPendingApproval({ productId, discount, percent });
      setDiscountFor(null);
    }
  };

  const handleApproveLine = async (managerPin: string, note: string): Promise<string | null> => {
    if (!pendingApproval) return 'No pending discount';
    const { productId, discount } = pendingApproval;
    const res = await requestDiscountApproval(session!, {
      managerPin,
      productId,
      discountType: discount.type,
      discountValue: discount.value,
      reason: note || discount.reason,
    });
    if (res.approved && res.approvalToken) {
      cart.setLineDiscount(
        productId,
        { ...discount, reason: note || discount.reason },
        res.approvalToken,
        res.approvedByUserId ?? undefined,
      );
      setPendingApproval(null);
      showToast('Discount approved by manager');
      return null;
    }
    return res.reason ?? 'Not approved';
  };

  const totals = computeTotals(cart.items, data.settings.taxRatePercent, cart.orderDiscount);
  const orderBase = round2(totals.subtotal - totals.totalDiscount);

  const handleOrderDiscountApply = (discount: OrderDiscount) => {
    const amount =
      discount.type === 'PERCENTAGE'
        ? round2((orderBase * discount.value) / 100)
        : Math.min(orderBase, round2(discount.value));
    const percent = orderBase > 0 ? (amount / orderBase) * 100 : 0;
    if (withinDiscountLimit(discountLimitFor(session!.user.role), percent)) {
      cart.setOrderDiscount(discount);
      setOrderDiscountOpen(false);
    } else {
      setPendingOrderApproval({ discount, percent });
      setOrderDiscountOpen(false);
    }
  };

  const handleApproveOrder = async (managerPin: string, note: string): Promise<string | null> => {
    if (!pendingOrderApproval) return 'No pending discount';
    const { discount } = pendingOrderApproval;
    const res = await requestDiscountApproval(session!, {
      managerPin,
      productId: ORDER_DISCOUNT_KEY,
      discountType: discount.type,
      discountValue: discount.value,
      reason: note || discount.reason,
    });
    if (res.approved && res.approvalToken) {
      cart.setOrderDiscount({ ...discount, reason: note || discount.reason }, res.approvalToken);
      setPendingOrderApproval(null);
      showToast('Order discount approved by manager');
      return null;
    }
    return res.reason ?? 'Not approved';
  };

  // Every picked customer passes through cart.addCustomer, so the name of the
  // current selection is always resolvable from the cart's own list.
  const selectedCustomerName =
    cart.addedCustomers.find((c) => c.id === cart.customerId)?.name ?? null;

  const noteItem = cart.items.find((it) => it.product.id === noteFor);
  const discountItem = cart.items.find((it) => it.product.id === discountFor);
  const approvalItem = cart.items.find((it) => it.product.id === pendingApproval?.productId);

  const currency = data.settings.currency;

  return (
    <div className="grid gap-5 lg:grid-cols-[1.9fr_1fr]">
      {/* ── Catalog ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Search products or scan barcode…"
              className="pl-10"
            />
          </div>
        </div>

        {data.error ? (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Couldn&apos;t load the product catalog: {data.error}
            </span>
            <Button variant="outline" size="sm" onClick={data.reload}>
              Retry
            </Button>
          </div>
        ) : null}

        {/* Single-line, horizontally scrollable filter rows: vertical footprint
            stays constant no matter how many categories exist. */}
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => {
                setCategory(c);
                setSubcategory('All');
              }}
              className={cn(
                'shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                category === c
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-border',
              )}
            >
              {c}
            </button>
          ))}
        </div>

        {subcategories.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
            {subcategories.map((s) => (
              <button
                key={s}
                onClick={() => setSubcategory(s)}
                className={cn(
                  'shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  subcategory === s
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-border',
                )}
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}

        {data.loading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Loading products…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {pageProducts.map((p) => {
                const outOfStock = p.quantityOnHand <= 0;
                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    disabled={outOfStock}
                    className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition-all hover:border-primary hover:shadow disabled:opacity-60"
                  >
                    <div className="relative">
                      <ProductImage
                        src={p.imageUrl}
                        alt={p.name}
                        rounded="rounded-none"
                        className="aspect-square w-full border-0"
                      />
                      {p.requiresWarehousePickup ? (
                        <span className="absolute left-1.5 top-1.5 rounded-md bg-warning-soft/90 p-1 text-warning">
                          <Warehouse className="h-3.5 w-3.5" />
                        </span>
                      ) : null}
                      <span className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground opacity-0 shadow transition-opacity group-hover:opacity-100">
                        <Plus className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-2">
                      <div className="line-clamp-2 min-h-8 text-xs font-medium leading-tight">
                        {p.name}
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {p.sku ?? p.barcode ?? ''}
                      </div>
                      <div className="mt-1.5 flex items-end justify-between">
                        <span className="text-sm font-semibold text-primary">
                          {formatMoney(p.unitPrice, currency)}
                        </span>
                        <span
                          className={cn(
                            'text-[11px]',
                            outOfStock ? 'font-medium text-danger' : 'text-muted-foreground',
                          )}
                        >
                          {outOfStock ? 'Out' : `${p.quantityOnHand}${p.unitType ? ' ' + p.unitType : ''}`}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 ? (
                <p className="col-span-full py-16 text-center text-sm text-muted-foreground">
                  No products match your search.
                </p>
              ) : null}
            </div>

            {/* Pagination */}
            {filtered.length > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>Per page</span>
                  <Select
                    value={String(pageSize)}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="w-auto"
                  >
                    {PAGE_SIZES.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </Select>
                  <span className="hidden sm:inline">
                    Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of{' '}
                    {filtered.length}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </Button>
                  <span className="px-2 text-muted-foreground">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* ── Cart ────────────────────────────────────────────────── */}
      <Card className="flex h-fit flex-col lg:sticky lg:top-6">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="text-sm font-semibold">
            Cart{totals.itemCount > 0 ? ` · ${totals.itemCount} item${totals.itemCount > 1 ? 's' : ''}` : ''}
          </div>
          {cart.items.length > 0 ? (
            <button
              onClick={cart.clearCart}
              className="text-xs font-medium text-danger hover:underline"
            >
              Clear cart
            </button>
          ) : null}
        </div>

        <div className="space-y-3 border-b border-border p-4">
          <div className="flex items-center gap-2">
            <CustomerCombobox
              session={session!}
              customerId={cart.customerId}
              customerName={selectedCustomerName}
              onSelect={(customer) =>
                customer ? cart.addCustomer(customer) : cart.setCustomerId('')
              }
            />
            {canAddCustomer ? (
              <Button
                variant="outline"
                size="icon"
                aria-label="Add customer"
                onClick={() => setQuickAddOpen(true)}
              >
                <UserPlus className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>

        <CardContent className="max-h-[52vh] space-y-3 overflow-auto p-4">
          {cart.items.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Tap a product to add it to the cart.
            </p>
          ) : (
            cart.items.map((item) => {
              const line = computeLine(item);
              return (
                <div key={item.product.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-start gap-2.5">
                    <ProductImage
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      className="h-10 w-10 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{item.product.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatMoney(item.product.unitPrice, currency)} each
                      </div>
                    </div>
                    <div className="text-right text-sm font-semibold">
                      {formatMoney(line.lineTotal, currency)}
                      {line.discountAmount > 0 ? (
                        <div className="flex items-center justify-end gap-1 text-xs font-normal text-success">
                          {item.approvalToken ? (
                            <ShieldCheck className="h-3 w-3" aria-label="Manager approved" />
                          ) : null}
                          -{formatMoney(line.discountAmount, currency)}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {line.outOfStock ? (
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-danger">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Only {item.product.quantityOnHand} in stock
                    </div>
                  ) : null}

                  {item.note ? (
                    <div className="mt-2 rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
                      {item.note}
                    </div>
                  ) : null}

                  <div className="mt-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => cart.changeQty(item.product.id, -1)}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => cart.changeQty(item.product.id, 1)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn('h-8 w-8', item.note && 'text-primary')}
                        onClick={() => setNoteFor(item.product.id)}
                        aria-label="Add note"
                      >
                        <NotebookPen className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn('h-8 w-8', item.discount && 'text-primary')}
                        onClick={() => setDiscountFor(item.product.id)}
                        aria-label="Add discount"
                      >
                        <Tag className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-danger"
                        onClick={() => cart.removeItem(item.product.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>

        <div className="space-y-2 border-t border-border p-4 text-sm">
          <Row label="Subtotal" value={formatMoney(totals.subtotal, currency)} />
          <Row label="Product discount" value={`-${formatMoney(totals.totalDiscount, currency)}`} />
          <button
            type="button"
            disabled={cart.items.length === 0}
            onClick={() => setOrderDiscountOpen(true)}
            className={cn(
              'flex w-full items-center rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors',
              'disabled:cursor-not-allowed disabled:opacity-50',
              cart.orderDiscount
                ? 'justify-between border-border bg-muted/40 hover:border-primary'
                : 'justify-center gap-1.5 border-dashed border-primary/50 text-primary hover:bg-brand-50',
            )}
          >
            {cart.orderDiscount ? (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <Tag className="h-4 w-4" />
                  Order discount
                  {cart.orderApprovalToken ? (
                    <ShieldCheck className="h-4 w-4 text-success" aria-label="Manager approved" />
                  ) : null}
                </span>
                <span className="font-semibold text-success">
                  -{formatMoney(totals.orderDiscountAmount, currency)}
                </span>
              </>
            ) : (
              <>
                <Tag className="h-4 w-4" />
                Add discount to entire bill
              </>
            )}
          </button>
          <Row
            label={`Tax (${data.settings.taxRatePercent}%)`}
            value={formatMoney(totals.taxAmount, currency)}
          />
          <div className="flex items-center justify-between border-t border-border pt-2 text-base font-semibold">
            <span>Total</span>
            <span>{formatMoney(totals.total, currency)}</span>
          </div>

          {totals.hasStockIssue ? (
            <div className="flex items-center gap-1.5 rounded-lg bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
              <AlertTriangle className="h-3.5 w-3.5" />
              Some items exceed available stock.
            </div>
          ) : null}

          <Button
            size="lg"
            className="mt-1 w-full"
            disabled={cart.items.length === 0 || totals.hasStockIssue}
            onClick={() => router.push('/pos/payment')}
          >
            Continue to Payment
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {/* ── Dialogs ─────────────────────────────────────────────── */}
      {noteItem ? (
        <ItemNoteDialog
          open={!!noteFor}
          productName={noteItem.product.name}
          initialNote={noteItem.note}
          onSave={(note) => {
            cart.setNote(noteItem.product.id, note);
            setNoteFor(null);
          }}
          onClose={() => setNoteFor(null)}
        />
      ) : null}

      {discountItem ? (
        <ItemDiscountDialog
          open={!!discountFor}
          productName={discountItem.product.name}
          unitPrice={discountItem.product.unitPrice}
          quantity={discountItem.quantity}
          currency={currency}
          roleLimit={discountLimitFor(session!.user.role)}
          initial={discountItem.discount}
          onApply={(d) => handleLineDiscountApply(discountItem.product.id, d)}
          onClear={() => {
            cart.setLineDiscount(discountItem.product.id, undefined);
            setDiscountFor(null);
          }}
          onClose={() => setDiscountFor(null)}
        />
      ) : null}

      {approvalItem && pendingApproval ? (
        <ManagerApprovalDialog
          open={!!pendingApproval}
          productName={approvalItem.product.name}
          discountLabel={formatDiscountLabel(pendingApproval.discount, currency)}
          onApprove={handleApproveLine}
          onClose={() => setPendingApproval(null)}
        />
      ) : null}

      <OrderDiscountDialog
        open={orderDiscountOpen}
        baseAmount={orderBase}
        currency={currency}
        roleLimit={discountLimitFor(session!.user.role)}
        initial={cart.orderDiscount}
        onApply={handleOrderDiscountApply}
        onClear={() => {
          cart.setOrderDiscount(undefined);
          setOrderDiscountOpen(false);
        }}
        onClose={() => setOrderDiscountOpen(false)}
      />

      {pendingOrderApproval ? (
        <ManagerApprovalDialog
          open={!!pendingOrderApproval}
          productName="Order discount"
          discountLabel={formatDiscountLabel(pendingOrderApproval.discount, currency)}
          onApprove={handleApproveOrder}
          onClose={() => setPendingOrderApproval(null)}
        />
      ) : null}

      {canAddCustomer ? (
        <QuickAddCustomerDialog
          open={quickAddOpen}
          session={session!}
          onClose={() => setQuickAddOpen(false)}
          onCreated={(customer) => {
            cart.addCustomer({ id: customer.id, name: customer.name });
            setQuickAddOpen(false);
            showToast(`Customer "${customer.name}" added`);
          }}
        />
      ) : null}

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-foreground px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function formatDiscountLabel(discount: LineDiscount | OrderDiscount, currency: string): string {
  return discount.type === 'PERCENTAGE'
    ? `${discount.value}% off`
    : `${formatMoney(discount.value, currency)} off`;
}
