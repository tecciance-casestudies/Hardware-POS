import { QuickBooksSalesSyncService } from './quickbooks-sales-sync.service';

/**
 * The invoice date a POS sale carries must survive into the QuickBooks document,
 * otherwise a backdated sale is filed on the day it was keyed in — the one thing
 * backdating exists to prevent. `buildDocumentBody` is private, so reach it the
 * way the sync path does and assert on the wire body it produces.
 */
type BodyBuilder = (
  sale: unknown,
  lines: unknown[],
  customerRef: unknown,
) => { TxnDate?: string; DocNumber?: string; CustomerRef?: unknown };

function buildBody(sale: Record<string, unknown>) {
  const svc = new QuickBooksSalesSyncService(
    null as never,
    null as never,
    null as never,
    null as never,
  );
  const build = (svc as unknown as { buildDocumentBody: BodyBuilder }).buildDocumentBody.bind(svc);
  return build({ saleNumber: 'S-000001', taxAmount: 0, ...sale }, [], null);
}

describe('QuickBooks sales sync — TxnDate', () => {
  it('files the document under the sale’s invoice date, not today', () => {
    const body = buildBody({ completedAt: new Date(2026, 7, 1, 14, 23), createdAt: new Date() });
    expect(body.TxnDate).toBe('2026-08-01');
  });

  it('falls back to createdAt when a sale has no completedAt', () => {
    const body = buildBody({ completedAt: null, createdAt: new Date(2026, 2, 9, 10, 0) });
    expect(body.TxnDate).toBe('2026-03-09');
  });

  it('reports the local calendar day for a late-evening sale', () => {
    // `toISOString().slice(0, 10)` would roll this to the 2nd east of UTC.
    const body = buildBody({ completedAt: new Date(2026, 7, 1, 23, 45), createdAt: new Date() });
    expect(body.TxnDate).toBe('2026-08-01');
  });

  it('sends a bare calendar date with no time component', () => {
    const body = buildBody({ completedAt: new Date(2026, 11, 25, 8, 5), createdAt: new Date() });
    expect(body.TxnDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('still carries the document number alongside the date', () => {
    const body = buildBody({
      saleNumber: 'S-000042',
      completedAt: new Date(2026, 7, 1),
      createdAt: new Date(),
    });
    expect(body.DocNumber).toBe('S-000042');
    expect(body.TxnDate).toBe('2026-08-01');
  });
});
