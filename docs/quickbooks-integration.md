# QuickBooks Online Integration

How the POS connects to **QuickBooks Online (QBO)**, pulls catalog data, and pushes sales.

> Not implemented yet — this is the integration design. Code will live in a `quickbooks`
> feature module inside `apps/api`.

## 1. Principles

- QBO = source of truth for products, inventory, prices, accounting, reports.
- POS = cashier sales workflow with a local product/customer cache.
- The POS never edits stock or prices in QBO. Inventory decrements happen in QBO as a
  side effect of the Sales Receipts / Invoices the POS creates.
- If sync fails, the sale stays saved locally and is retried. No sale is lost.

## 2. Authentication (OAuth 2.0)

- Standard QBO OAuth 2.0 Authorization Code flow.
- Admin connects the company once via `GET /v1/quickbooks/connect` → QBO consent →
  `GET /v1/quickbooks/callback`.
- Store, encrypted at rest: `access_token`, `refresh_token`, `realmId` (company id),
  and token expiry.
- Access tokens are short-lived; **refresh proactively** before expiry and on any `401`.
- Config via environment variables (see `.env.example`):
  `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_REDIRECT_URI`, `QBO_ENVIRONMENT` (`sandbox` | `production`).
- Build against the **sandbox** company first, then flip `QBO_ENVIRONMENT` for production.

## 3. Direction of sync

**Inbound — QBO → POS (cache refresh)**

| QBO entity | Cached as        | Fields used                       |
| ---------- | ---------------- | --------------------------------- |
| Item       | `Product`        | id, name, sku, price, qtyOnHand   |
| Customer   | `Customer`       | id, name, email, phone            |

- Runs on a schedule (e.g. every N minutes) and on demand from the admin UI.
- Upsert by `qboId`. Use QBO's `CDC` (change data capture) / `Metadata.LastUpdatedTime`
  to pull only what changed since the last sync where possible.

**Outbound — POS → QBO (per completed sale)**

| POS record            | QBO document                       |
| --------------------- | ---------------------------------- |
| Sale (type RECEIPT)   | **SalesReceipt**                   |
| Sale (type INVOICE)   | **Invoice** + **Payment**          |
| Payment               | **Payment** (applied to the Invoice) |

## 4. Transaction mapping

| POS event         | Rule                              | QBO result                                   |
| ----------------- | --------------------------------- | -------------------------------------------- |
| Fully paid sale   | `amountPaid >= total`             | Create **SalesReceipt** with the line items  |
| Partial / credit  | `amountPaid < total`             | Create **Invoice** (full amount), then a **Payment** for `amountPaid` applied to it |
| Return / exchange | *(phase 2)*                       | Refund Receipt / Credit Memo *(later)*       |

Line items map to QBO `SalesItemLineDetail` using each product's QBO `Item` id, the sale-time
unit price, quantity, and the product-wise discount (as a line discount or a discount line,
per QBO's model). A customer reference is required on Invoices.

## 5. Idempotency (no duplicates on retry)

Retries must never create a second QBO document for the same sale.

- Generate a stable **idempotency key** per outbound entity (e.g. the local `Sale.id`).
- Before creating a document, check whether `Sale.qboId` is already set — if so, skip creation.
- On create success, persist the returned QBO id (`Sale.qboId`, `Payment.qboId`) **in the same
  transaction** as marking the sync `SYNCED`.
- If a create call times out with an unknown result, **query QBO** (by `DocNumber` / private
  note carrying the idempotency key) before re-creating.

## 6. Sync jobs, status & retry

- Each outbound sale is a job: `PENDING → SYNCING → SYNCED | FAILED`.
- Failures retry with exponential backoff up to a max attempt count, then rest in `FAILED`
  for **manual retry** from the sync log UI.
- Every attempt appends a `SyncLog` row: entity type, direction, status, attempt #, error.
- The POS surfaces per-sale sync status in sales history and a dedicated sync-log screen.

## 7. Error handling

| Failure                         | Handling                                                        |
| ------------------------------- | -------------------------------------------------------------- |
| Token expired (`401`)           | Refresh token, retry the call once                             |
| Rate limited (`429`)            | Back off and retry per `Retry-After`                           |
| Validation error (`400`)        | Mark `FAILED`, log the QBO fault, surface for manual review    |
| Network / `5xx` / timeout       | Retry with backoff; verify idempotently before re-creating     |
| Stale price / item not found    | Flag the sale; trigger a catalog re-sync                        |

## 8. Open questions

- Tax: rely on QBO automated sales tax, or send tax lines explicitly? (Confirm with QBO config.)
- Discounts: represent as per-line discount vs. a discount line item — depends on the QBO
  company's preferences (`Preferences.SalesFormsPrefs`).
- Payment methods & deposit accounts: which QBO accounts back CASH vs. CARD payments.
