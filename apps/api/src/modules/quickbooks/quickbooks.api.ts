/** Minimal client for the QuickBooks Online Accounting API. */

export interface QboItem {
  Id: string;
  Name: string;
  Sku?: string;
  Description?: string;
  UnitPrice?: number;
  QtyOnHand?: number;
  Type?: string;
  Active?: boolean;
}

interface QueryResponse {
  QueryResponse?: { Item?: QboItem[] };
}

interface CompanyInfoQueryResponse {
  QueryResponse?: { CompanyInfo?: Array<{ CompanyName?: string }> };
}

interface PreferencesQueryResponse {
  QueryResponse?: {
    Preferences?: Array<{ CurrencyPrefs?: { HomeCurrency?: { value?: string } } }>;
  };
}

/** A reference to another QuickBooks entity (Item, Customer, …). */
export interface QboRef {
  value: string;
  name?: string;
}

/** A single sales line on a SalesReceipt / Invoice. */
export interface QboSalesLine {
  DetailType: 'SalesItemLineDetail';
  Amount: number;
  Description?: string;
  SalesItemLineDetail: {
    ItemRef?: QboRef;
    Qty?: number;
    UnitPrice?: number;
  };
}

/** Body shared by SalesReceipt and Invoice creation. */
export interface QboSalesDocumentInput {
  CustomerRef?: QboRef;
  DocNumber?: string;
  PrivateNote?: string;
  Line: QboSalesLine[];
  TxnTaxDetail?: { TotalTax: number };
}

/**
 * Body shared by RefundReceipt and CreditMemo creation. Same line/tax shape as a
 * sales document; a RefundReceipt additionally names the account the money is
 * paid back from (DepositToAccountRef) and the refund tender (PaymentMethodRef).
 */
export interface QboReturnDocumentInput {
  CustomerRef?: QboRef;
  DocNumber?: string;
  PrivateNote?: string;
  Line: QboSalesLine[];
  TxnTaxDetail?: { TotalTax: number };
  DepositToAccountRef?: QboRef;
  PaymentMethodRef?: QboRef;
}

/** Body for a QuickBooks Payment linked to an Invoice. */
export interface QboPaymentInput {
  CustomerRef: QboRef;
  TotalAmt: number;
  PrivateNote?: string;
  Line: Array<{
    Amount: number;
    LinkedTxn: Array<{ TxnId: string; TxnType: 'Invoice' }>;
  }>;
}

/** A created QuickBooks transaction (only the fields we consume). */
export interface QboDocument {
  Id: string;
  DocNumber?: string;
}

interface RequestParams {
  apiBase: string;
  realmId: string;
  accessToken: string;
}

/** Run a QBO SQL-ish query against the Accounting API and return the parsed JSON. */
async function runQuery<T>(params: RequestParams, query: string): Promise<T> {
  const url = `${params.apiBase}/v3/company/${params.realmId}/query?minorversion=65&query=${encodeURIComponent(query)}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`QuickBooks query failed (${res.status}): ${detail}`);
  }
  return (await res.json()) as T;
}

/**
 * Query all Items from a QuickBooks company. The caller filters by type; we pull
 * everything (up to 1000) so inventory and non-inventory items are both returned.
 */
export async function queryItems(params: RequestParams): Promise<QboItem[]> {
  const json = await runQuery<QueryResponse>(params, 'select * from Item maxresults 1000');
  return json.QueryResponse?.Item ?? [];
}

/** Fetch the connected company's display name and home currency (best-effort fields). */
export async function queryCompanyInfo(
  params: RequestParams,
): Promise<{ companyName: string | null; currency: string | null }> {
  const [company, prefs] = await Promise.all([
    runQuery<CompanyInfoQueryResponse>(params, 'select * from CompanyInfo'),
    runQuery<PreferencesQueryResponse>(params, 'select * from Preferences'),
  ]);
  return {
    companyName: company.QueryResponse?.CompanyInfo?.[0]?.CompanyName ?? null,
    currency: prefs.QueryResponse?.Preferences?.[0]?.CurrencyPrefs?.HomeCurrency?.value ?? null,
  };
}

/** Create a QuickBooks Sales Receipt (used for fully-paid sales). */
export async function createSalesReceipt(
  params: RequestParams,
  body: QboSalesDocumentInput,
): Promise<QboDocument> {
  const json = await postEntity<{ SalesReceipt?: QboDocument }>(params, 'salesreceipt', body);
  return expectEntity(json.SalesReceipt, 'SalesReceipt');
}

/** Create a QuickBooks Invoice (used for credit / partially-paid sales). */
export async function createInvoice(
  params: RequestParams,
  body: QboSalesDocumentInput,
): Promise<QboDocument> {
  const json = await postEntity<{ Invoice?: QboDocument }>(params, 'invoice', body);
  return expectEntity(json.Invoice, 'Invoice');
}

/** Create a QuickBooks Payment linked to an Invoice (records the amount paid). */
export async function createPayment(
  params: RequestParams,
  body: QboPaymentInput,
): Promise<QboDocument> {
  const json = await postEntity<{ Payment?: QboDocument }>(params, 'payment', body);
  return expectEntity(json.Payment, 'Payment');
}

/** Create a QuickBooks Refund Receipt (money paid back for a fully-paid sale). */
export async function createRefundReceipt(
  params: RequestParams,
  body: QboReturnDocumentInput,
): Promise<QboDocument> {
  const json = await postEntity<{ RefundReceipt?: QboDocument }>(params, 'refundreceipt', body);
  return expectEntity(json.RefundReceipt, 'RefundReceipt');
}

/** Create a QuickBooks Credit Memo (credit for a returned invoice / credit sale). */
export async function createCreditMemo(
  params: RequestParams,
  body: QboReturnDocumentInput,
): Promise<QboDocument> {
  const json = await postEntity<{ CreditMemo?: QboDocument }>(params, 'creditmemo', body);
  return expectEntity(json.CreditMemo, 'CreditMemo');
}

/** POST a JSON entity to the Accounting API and return the parsed response. */
async function postEntity<T>(
  params: RequestParams,
  entity: 'salesreceipt' | 'invoice' | 'payment' | 'refundreceipt' | 'creditmemo',
  body: unknown,
): Promise<T> {
  const url = `${params.apiBase}/v3/company/${params.realmId}/${entity}?minorversion=65`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`QuickBooks ${entity} create failed (${res.status}): ${detail}`);
  }
  return (await res.json()) as T;
}

function expectEntity(doc: QboDocument | undefined, kind: string): QboDocument {
  if (!doc?.Id) {
    throw new Error(`QuickBooks ${kind} response did not include an Id`);
  }
  return doc;
}
