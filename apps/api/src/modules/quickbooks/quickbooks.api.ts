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

/**
 * Query all Items from a QuickBooks company. The caller filters by type; we pull
 * everything (up to 1000) so inventory and non-inventory items are both returned.
 */
export async function queryItems(params: {
  apiBase: string;
  realmId: string;
  accessToken: string;
}): Promise<QboItem[]> {
  const query = encodeURIComponent('select * from Item maxresults 1000');
  const url = `${params.apiBase}/v3/company/${params.realmId}/query?minorversion=65&query=${query}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`QuickBooks item query failed (${res.status}): ${detail}`);
  }

  const json = (await res.json()) as QueryResponse;
  return json.QueryResponse?.Item ?? [];
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

/** POST a JSON entity to the Accounting API and return the parsed response. */
async function postEntity<T>(
  params: RequestParams,
  entity: 'salesreceipt' | 'invoice' | 'payment',
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
