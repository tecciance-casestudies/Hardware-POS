# Requirements

Hardware POS — a cashier sales front-end connected with **QuickBooks Online (QBO)**.

QBO stays the system of record. The POS is a fast, offline-tolerant checkout terminal
that reads catalog/inventory data from QBO and pushes completed sales back to it.

## 1. Source-of-truth boundary

QuickBooks Online is authoritative for:

- Products / items
- Inventory (quantity on hand)
- Prices
- Accounting (ledgers, taxes, chart of accounts)
- Reports

The POS is authoritative for:

- Cashier sessions and login
- The in-progress cart
- Manual, product-wise discounts applied at the till
- The local sales record and its sync state

> **Rule:** the POS never edits stock or prices directly in QBO. It only creates
> Sales Receipts, Invoices, and Payments. Inventory decrements happen in QBO as a
> side effect of those documents.

## 2. Actors / roles

| Role      | Capabilities                                                                 |
| --------- | ---------------------------------------------------------------------------- |
| Cashier   | Log in with PIN, search products, build a cart, take payment, print receipts |
| Manager   | Everything a cashier can do, plus approve high discounts, view all sales     |
| Admin     | Manage users, configure the QBO connection, view sync logs, retry syncs      |

## 3. Functional requirements

### 3.1 Authentication

- **FR-1** Cashiers log in with a numeric PIN.
- **FR-2** A discount above a configurable threshold requires a **manager PIN** to approve
  (manager does not need to log out the cashier; it is an inline approval).

### 3.2 Catalog & search

- **FR-3** Product search by name / SKU against the local product cache.
- **FR-4** Barcode search: scanning a barcode resolves to a single product and adds it to the cart.
- **FR-5** The product cache is refreshed from QBO on a schedule and on demand.

### 3.3 Cart & pricing

- **FR-6** Add, update quantity, and remove line items.
- **FR-7** Apply a **product-wise manual discount** (percentage or fixed amount) per line item.
- **FR-8** Show running subtotal, discount total, tax, and grand total.
- **FR-9** Discounts at or below the threshold apply immediately; above it, they are held
  pending manager approval before the sale can complete.

### 3.4 Customer

- **FR-10** Optionally attach a customer (searched from the local customer cache) to a sale.
- **FR-11** A customer is **required** for credit/partial sales (invoices), optional for cash sales.

### 3.5 Payment & completion

- **FR-12** Take payment (cash, card — recorded as a payment method + amount).
- **FR-13** Determine the transaction type from amount paid vs. total (see §4).
- **FR-14** Persist the sale locally first, then enqueue it for QBO sync.

### 3.6 Receipt

- **FR-15** Print a receipt on completion and support reprint from sales history.

### 3.7 History & sync visibility

- **FR-16** Sales history list with per-sale **sync status** (pending / syncing / synced / failed).
- **FR-17** A **sync log** view showing each sync attempt, its result, and any error.
- **FR-18** Manual **retry** of a failed sync.

## 4. Transaction rules

| Condition                          | POS records        | Pushed to QuickBooks Online      |
| ---------------------------------- | ------------------ | -------------------------------- |
| Amount paid **>= total** (paid)    | Sale (type RECEIPT) | **Sales Receipt**                |
| Amount paid **< total** (credit)   | Sale (type INVOICE) | **Invoice** + **Payment** for the amount paid |
| Return / exchange                  | *(phase 2)*        | Refund / Credit Memo flow *(later)* |

- A fully paid sale carries no balance and maps cleanly to a Sales Receipt.
- A partial/credit sale creates an Invoice for the full amount, then a Payment applied to it
  for the portion collected; the remaining balance stays open in QBO.

## 5. Non-functional requirements

- **NFR-1 Fast checkout:** product lookup and add-to-cart respond from the local cache
  (target < 100 ms), independent of QBO latency.
- **NFR-2 Resilient sync:** if QBO is unreachable, the sale is saved locally and retried;
  no sale is lost because sync failed.
- **NFR-3 Idempotency:** retries must not create duplicate QBO documents (see
  [quickbooks-integration.md](./quickbooks-integration.md)).
- **NFR-4 Auditability:** every sync attempt is logged with timestamp, status, and error.
- **NFR-5 Security:** PINs are stored hashed; QBO OAuth tokens are stored encrypted at rest.

## 6. Out of scope (for now)

- Returns / exchanges / refunds (planned as a later phase).
- Editing products, prices, or stock from the POS.
- Multi-currency (QBO company currency is assumed).
- Purchase orders and supplier management (handled in QBO).
