/**
 * Reusable subcategory library — FRONTEND-ONLY MOCK adapter.
 *
 * The backend models a subcategory as belonging to exactly ONE category
 * (`Subcategory.categoryId`, a strict one-to-many tree). The product spec wants
 * subcategories to be *reusable* — a shared library where one subcategory (e.g.
 * "Fasteners") can be assigned to many categories and unassigned from one
 * without deleting it globally.
 *
 * That many-to-many relationship does not exist server-side, so it is emulated
 * here in LocalStorage and kept OUT of UI components. The types mirror the spec.
 *
 * TODO(backend): replace this adapter with a real many-to-many API:
 *   - `MainCategory.assignedSubcategoryIds` ← a join table (category_subcategory)
 *   - GET  /categories/:id/subcategories            (assigned)
 *   - POST /categories/:id/subcategories  { subcategoryId }   (assign existing)
 *   - DELETE /categories/:id/subcategories/:subId            (unassign, keep global)
 *   - GET/POST /subcategory-library                          (shared library CRUD)
 * Until then, assignments made here are local to the browser/tenant.
 */

export interface MainCategory {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
  /** IDs of subcategories from the shared library assigned to this category. */
  assignedSubcategoryIds: string[];
}

export interface Subcategory {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
}

/** Persisted shape: the shared library + per-category assignment lists. */
export interface CategoryAssignmentState {
  /** Shared, reusable subcategory library (assignable to any category). */
  library: Subcategory[];
  /** categoryId → assigned subcategory ids. */
  assignments: Record<string, string[]>;
}

const LS_KEY = 'hpos.categoryAssignments';

function emptyState(): CategoryAssignmentState {
  return { library: [], assignments: {} };
}

function read(): CategoryAssignmentState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<CategoryAssignmentState>;
    return { library: parsed.library ?? [], assignments: parsed.assignments ?? {} };
  } catch {
    return emptyState();
  }
}

function write(state: CategoryAssignmentState): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota / unavailable storage */
  }
}

/** Deterministic id without Date.now/Math.random being required at import time. */
function makeId(name: string, existing: Subcategory[]): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sub';
  let id = `lib_${base}`;
  let n = 2;
  while (existing.some((s) => s.id === id)) id = `lib_${base}-${n++}`;
  return id;
}

export const categoryAssignmentService = {
  getState: read,

  /** The full shared subcategory library. */
  getLibrary(): Subcategory[] {
    return read().library.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  },

  /** Subcategories currently assigned to a category (in assignment order). */
  getAssigned(categoryId: string): Subcategory[] {
    const state = read();
    const ids = state.assignments[categoryId] ?? [];
    return ids
      .map((id) => state.library.find((s) => s.id === id))
      .filter((s): s is Subcategory => !!s);
  },

  /** Create a new shared subcategory in the library. */
  createSubcategory(name: string, description?: string): Subcategory {
    const state = read();
    const sub: Subcategory = {
      id: makeId(name, state.library),
      name: name.trim(),
      description: description?.trim() || undefined,
      isActive: true,
      sortOrder: state.library.length,
    };
    state.library.push(sub);
    write(state);
    return sub;
  },

  /** Assign an existing library subcategory to a category (idempotent). */
  assign(categoryId: string, subcategoryId: string): void {
    const state = read();
    const list = state.assignments[categoryId] ?? [];
    if (!list.includes(subcategoryId)) list.push(subcategoryId);
    state.assignments[categoryId] = list;
    write(state);
  },

  /** Remove an assignment from a category WITHOUT deleting the subcategory globally. */
  unassign(categoryId: string, subcategoryId: string): void {
    const state = read();
    state.assignments[categoryId] = (state.assignments[categoryId] ?? []).filter(
      (id) => id !== subcategoryId,
    );
    write(state);
  },

  /** Delete a subcategory from the library and every assignment (global delete). */
  deleteFromLibrary(subcategoryId: string): void {
    const state = read();
    state.library = state.library.filter((s) => s.id !== subcategoryId);
    for (const cat of Object.keys(state.assignments)) {
      state.assignments[cat] = (state.assignments[cat] ?? []).filter((id) => id !== subcategoryId);
    }
    write(state);
  },

  reset(): void {
    write(emptyState());
  },
};
