import { api, authorizedFetch } from './api';
import type { Session } from './auth';

export type ProductSyncStatus = 'NOT_SYNCED' | 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';

/** A product as managed in the POS (mirrors the API Product, decimals as numbers). */
export interface ManagedProduct {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  baseSku: string | null;
  batchCode: string | null;
  description: string | null;
  brand: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
  unitType: string | null;
  unitPrice: number;
  costPrice: number | null;
  quantityOnHand: number;
  reorderLevel: number | null;
  imageUrl: string | null;
  imageAltText: string | null;
  trackInventory: boolean;
  taxable: boolean;
  requiresWarehousePickup: boolean;
  isActive: boolean;
  isDraft: boolean;
  quickbooksItemId: string | null;
  syncStatus: ProductSyncStatus;
  lastSyncedAt: string | null;
}

export interface ProductsPage {
  items: ManagedProduct[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProductsQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  categoryId?: string;
  subcategoryId?: string;
  isActive?: 'true' | 'false';
  isDraft?: 'true' | 'false';
  syncStatus?: ProductSyncStatus;
  stockStatus?: 'IN' | 'OUT';
}

export interface ProductInput {
  name: string;
  sku?: string | null;
  barcode?: string | null;
  baseSku?: string | null;
  batchCode?: string | null;
  description?: string | null;
  brand?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  unitType?: string | null;
  unitPrice: number;
  costPrice?: number | null;
  quantityOnHand?: number;
  reorderLevel?: number | null;
  imageAltText?: string | null;
  trackInventory?: boolean;
  taxable?: boolean;
  requiresWarehousePickup?: boolean;
  isActive?: boolean;
  isDraft?: boolean;
}

export interface Category {
  id: string;
  name: string;
  productCount?: number;
}

/** A subcategory nested under a category. */
export interface Subcategory {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
}

/** A category with its nested subcategories (the `/categories` tree shape). */
export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  quickbooksItemId: string | null;
  productCount: number;
  subcategoryCount: number;
  subcategories: Subcategory[];
}

export interface CategoryInput {
  name: string;
  slug?: string;
  description?: string | null;
  imageUrl?: string | null;
  sortOrder?: number;
}

export interface CategoryUpdate {
  name?: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface SubcategoryInput {
  categoryId: string;
  name: string;
  slug?: string;
  description?: string | null;
  sortOrder?: number;
}

export interface SubcategoryUpdate {
  name?: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

/** Raw product JSON (decimals arrive as strings). */
type ApiProduct = Omit<
  ManagedProduct,
  'unitPrice' | 'costPrice' | 'quantityOnHand' | 'reorderLevel'
> & {
  unitPrice: string | number;
  costPrice: string | number | null;
  quantityOnHand: string | number;
  reorderLevel: string | number | null;
};

function auth(session: Session): { token: string; tenantId: string } {
  return { token: session.token, tenantId: session.user.tenantId };
}

/** Origin serving uploaded images (API base URL without the `/v1` version suffix). */
export function apiOrigin(): string {
  return api.baseUrl.replace(/\/v\d+\/?$/, '');
}

/** Resolve a stored image URL (`/uploads/..`) to an absolute URL the browser can load. */
export function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  // Absolute and local-preview URLs (object/data URLs) pass through untouched.
  if (/^(https?:\/\/|blob:|data:)/.test(url)) return url;
  return `${apiOrigin()}${url}`;
}

function toManaged(p: ApiProduct): ManagedProduct {
  return {
    ...p,
    unitPrice: Number(p.unitPrice),
    costPrice: p.costPrice != null ? Number(p.costPrice) : null,
    quantityOnHand: Number(p.quantityOnHand),
    reorderLevel: p.reorderLevel != null ? Number(p.reorderLevel) : null,
  };
}

function buildQuery(q: ProductsQuery): string {
  const params = new URLSearchParams();
  params.set('page', String(q.page ?? 1));
  params.set('pageSize', String(q.pageSize ?? 25));
  if (q.search) params.set('search', q.search);
  if (q.categoryId) params.set('categoryId', q.categoryId);
  if (q.subcategoryId) params.set('subcategoryId', q.subcategoryId);
  if (q.isActive) params.set('isActive', q.isActive);
  if (q.isDraft) params.set('isDraft', q.isDraft);
  if (q.syncStatus) params.set('syncStatus', q.syncStatus);
  if (q.stockStatus) params.set('stockStatus', q.stockStatus);
  return params.toString();
}

export async function fetchProducts(session: Session, query: ProductsQuery = {}): Promise<ProductsPage> {
  const res = await api.get<{ items: ApiProduct[]; total: number; page: number; pageSize: number }>(
    `/products?${buildQuery(query)}`,
    auth(session),
  );
  return { ...res, items: res.items.map(toManaged) };
}

export async function fetchProduct(session: Session, id: string): Promise<ManagedProduct> {
  return toManaged(await api.get<ApiProduct>(`/products/${id}`, auth(session)));
}

export async function createProduct(session: Session, input: ProductInput): Promise<ManagedProduct> {
  return toManaged(await api.post<ApiProduct>('/products', input, auth(session)));
}

export async function updateProduct(
  session: Session,
  id: string,
  input: Partial<ProductInput>,
): Promise<ManagedProduct> {
  return toManaged(await api.patch<ApiProduct>(`/products/${id}`, input, auth(session)));
}

export async function deactivateProduct(session: Session, id: string): Promise<ManagedProduct> {
  return toManaged(await api.del<ApiProduct>(`/products/${id}`, auth(session)));
}

export async function setProductActive(
  session: Session,
  id: string,
  isActive: boolean,
): Promise<ManagedProduct> {
  return updateProduct(session, id, { isActive });
}

/** Upload a product image (multipart). Returns the updated product. */
export async function uploadProductImage(
  session: Session,
  id: string,
  file: File,
): Promise<ManagedProduct> {
  const form = new FormData();
  form.append('file', file);
  const res = await authorizedFetch(`/products/${id}/image`, session, {
    method: 'POST',
    body: form,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      json?.message ?? (res.status === 413 ? 'Image is too large (max 5MB)' : 'Image upload failed');
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
  return toManaged((json?.data ?? json) as ApiProduct);
}

export async function deleteProductImage(session: Session, id: string): Promise<ManagedProduct> {
  return toManaged(await api.del<ApiProduct>(`/products/${id}/image`, auth(session)));
}

export async function syncProductToQuickBooks(
  session: Session,
  id: string,
): Promise<ManagedProduct> {
  return toManaged(await api.post<ApiProduct>(`/products/${id}/sync-to-quickbooks`, undefined, auth(session)));
}

export async function fetchCategories(session: Session): Promise<Category[]> {
  return api.get<Category[]>('/categories', auth(session));
}

// ── Category tree + management ────────────────────────────────────────────────

/** Fetch the full category tree (categories with nested subcategories). */
export async function fetchCategoryTree(
  session: Session,
  activeOnly = false,
): Promise<CategoryNode[]> {
  return api.get<CategoryNode[]>(`/categories${activeOnly ? '?active=true' : ''}`, auth(session));
}

export async function createCategory(session: Session, input: CategoryInput): Promise<CategoryNode> {
  return api.post<CategoryNode>('/product-categories', input, auth(session));
}

export async function updateCategory(
  session: Session,
  id: string,
  input: CategoryUpdate,
): Promise<CategoryNode> {
  return api.patch<CategoryNode>(`/product-categories/${id}`, input, auth(session));
}

export async function deactivateCategory(session: Session, id: string): Promise<CategoryNode> {
  return api.post<CategoryNode>(`/product-categories/${id}/deactivate`, undefined, auth(session));
}

export async function reactivateCategory(session: Session, id: string): Promise<CategoryNode> {
  return api.post<CategoryNode>(`/product-categories/${id}/reactivate`, undefined, auth(session));
}

export async function reorderCategories(
  session: Session,
  orderedIds: string[],
): Promise<CategoryNode[]> {
  return api.post<CategoryNode[]>('/product-categories/reorder', { orderedIds }, auth(session));
}

export async function createSubcategory(
  session: Session,
  input: SubcategoryInput,
): Promise<Subcategory> {
  return api.post<Subcategory>('/product-subcategories', input, auth(session));
}

export async function updateSubcategory(
  session: Session,
  id: string,
  input: SubcategoryUpdate,
): Promise<Subcategory> {
  return api.patch<Subcategory>(`/product-subcategories/${id}`, input, auth(session));
}

export async function deactivateSubcategory(session: Session, id: string): Promise<Subcategory> {
  return api.post<Subcategory>(`/product-subcategories/${id}/deactivate`, undefined, auth(session));
}

export async function reactivateSubcategory(session: Session, id: string): Promise<Subcategory> {
  return api.post<Subcategory>(`/product-subcategories/${id}/reactivate`, undefined, auth(session));
}

export async function moveSubcategory(
  session: Session,
  id: string,
  categoryId: string,
): Promise<Subcategory> {
  return api.post<Subcategory>(`/product-subcategories/${id}/move`, { categoryId }, auth(session));
}

export async function fetchSubcategories(
  session: Session,
  categoryId: string,
): Promise<Subcategory[]> {
  return api.get<Subcategory[]>(`/product-subcategories?categoryId=${categoryId}`, auth(session));
}
