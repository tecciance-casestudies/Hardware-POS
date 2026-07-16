/**
 * documentTemplateService — resolves the business / document profile used to
 * render printable A4 documents on the frontend.
 *
 * A real per-tenant document profile IS available from the settings API
 * (`GET /settings` → `documents`), so this adapter reads that first and caches
 * the result in LocalStorage. If the API is unavailable (offline / not yet
 * migrated on some deployment) it falls back to the cached copy, then to a
 * built-in mock default — so the print flow never breaks.
 *
 * Keeping this behind a service (instead of inside the A4 component) means the
 * component takes a plain typed `DocumentProfile` and the data source can be
 * swapped without touching the UI.
 *
 * TODO(backend): the sale record does not yet carry branch / register / cashier
 * or full customer contact fields — those are sourced from the session/profile
 * here. When the sales API exposes them per-sale, read them from the sale.
 */
import { fetchSettings, type DocumentSettings } from './settings-api';
import type { Session } from './session-store';

export type DocumentProfile = DocumentSettings;

/** Branch / register / cashier + business fallback for a printed sale document. */
export interface SaleDocumentMeta {
  businessName: string;
  branchName: string;
  registerName: string;
  cashierName: string;
}

const LS_KEY = 'hpos.documentProfile';

/** Mock default used only when neither the API nor a cached profile is available. */
export const DEFAULT_DOCUMENT_PROFILE: DocumentProfile = {
  companyName: null,
  addressLine: null,
  phone: null,
  email: null,
  taxNumber: null,
  logoUrl: null,
  signatureUrl: null,
  stampUrl: null,
  footerText: 'Thank you for your business!',
  accentColor: '#1d4ed8',
  logoAlignment: 'LEFT',
  logoSize: 'MEDIUM',
  marginStyle: 'STANDARD',
  defaultPaperSize: 'A4',
  orientation: 'PORTRAIT',
  showProductImages: false,
  showSku: true,
  showTaxColumn: true,
  showDiscountColumn: true,
  showCustomerTaxNumber: true,
  showPageNumbers: true,
  defaultBillFormat: 'A4',
  signatureFields: true,
};

function readCache(): DocumentProfile | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? ({ ...DEFAULT_DOCUMENT_PROFILE, ...JSON.parse(raw) } as DocumentProfile) : null;
  } catch {
    return null;
  }
}

function writeCache(profile: DocumentProfile): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(profile));
  } catch {
    /* ignore quota / unavailable storage */
  }
}

/** Resolve the document profile: live settings API → LocalStorage cache → mock default. */
export async function getDocumentProfile(session: Session): Promise<DocumentProfile> {
  try {
    const settings = await fetchSettings(session);
    writeCache(settings.documents);
    return settings.documents;
  } catch {
    return readCache() ?? DEFAULT_DOCUMENT_PROFILE;
  }
}

/** Synchronous cached read (for instant first paint before the API resolves). */
export function getCachedDocumentProfile(): DocumentProfile {
  return readCache() ?? DEFAULT_DOCUMENT_PROFILE;
}

/** Build the branch/register/cashier meta for a sale from the current session. */
export function saleMetaFromSession(session: Session, profile: DocumentProfile): SaleDocumentMeta {
  return {
    businessName: profile.companyName || 'Hardware POS',
    branchName: session.branchName,
    registerName: session.registerName,
    cashierName: session.user.name,
  };
}
