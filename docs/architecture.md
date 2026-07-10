# Architecture

Hardware POS is a monorepo. The cashier front-end talks to a backend API, which owns a
local PostgreSQL database and orchestrates all synchronization with **QuickBooks Online (QBO)**.

## 1. Principles

- **QBO is the source of truth** for products, inventory, prices, accounting, and reports.
- The POS keeps a **local cache** of products and customers so checkout is fast and does not
  depend on QBO being reachable.
- Sales are written **locally first**, then synced to QBO asynchronously.
- The POS never mutates stock or prices in QBO directly — inventory changes as a side effect
  of the Sales Receipts / Invoices it creates.

## 2. Monorepo layout

```
hardware-pos/
├── apps/
│   ├── web/        Next.js + TypeScript cashier front-end
│   └── api/        NestJS + TypeScript backend & sync orchestration
├── packages/
│   ├── database/   Prisma schema + client (PostgreSQL)
│   └── shared/     Shared TypeScript types, enums, constants
└── docs/           Project documentation
```

## 3. Components

| Layer               | Package                 | Responsibility                                                        |
| ------------------- | ----------------------- | -------------------------------------------------------------------- |
| Cashier front-end   | `apps/web`              | PIN login, search, cart, discounts, payment, receipt, history, sync UI |
| Backend API         | `apps/api`              | Auth, sales processing, discount/approval rules, sync orchestration   |
| Local database      | `packages/database`     | Cached products & customers, sales, payments, sync logs               |
| QuickBooks module   | `apps/api` (feature)    | OAuth 2.0, catalog pull, sale/payment push, retry & idempotency        |
| Shared contracts    | `packages/shared`       | Types, enums (roles, sale/sync status) shared by web and api           |

The QuickBooks integration lives as a feature module **inside** `apps/api` (e.g.
`src/quickbooks/`), not as a separate service — it shares the same database and job runner.

## 4. High-level data flow

```
        pull (scheduled + on-demand)                push (async, per sale)
QBO  ───────────────────────────────▶  POS DB  ───────────────────────────────▶  QBO
 items / prices / qty-on-hand      (product &      Sales Receipt / Invoice+Payment
                                    customer cache,
                                    sales, sync log)
      apps/web  ◀── REST /v1 ──▶  apps/api  ◀── Prisma ──▶  PostgreSQL
```

- **Inbound (QBO → POS):** a sync job reads items and customers from QBO and upserts them into
  the local cache. Products carry their QBO item id, price, and quantity on hand.
- **Outbound (POS → QBO):** completing a sale writes a `Sale` row and enqueues a sync job that
  creates the matching QBO document, then records the returned QBO id back on the sale.

## 5. Checkout sequence (outbound)

```
Cashier        apps/web            apps/api                 PostgreSQL         QBO
  │  add items    │                    │                        │              │
  │──────────────▶│  POST /v1/sales    │                        │              │
  │  take payment │───────────────────▶│  create Sale (local)   │              │
  │               │                    │───────────────────────▶│              │
  │               │  201 + receipt data│◀───────────────────────│              │
  │◀──────────────│                    │  enqueue sync job       │              │
  │  print        │                    │────── async ───────────────────────▶ │  create
  │               │                    │  update Sale.qboId,     │             SalesReceipt
  │               │                    │  write SyncLog          │◀──────────── │  / Invoice
```

The cashier is never blocked on QBO: the `201` returns as soon as the sale is committed
locally. Sync status is surfaced afterward in history and the sync log.

## 6. Sync orchestration

- Outbound syncs run as **jobs** with status `PENDING → SYNCING → SYNCED | FAILED`.
- Failed jobs are retried with backoff and can be **retried manually** from the sync log UI.
- Every attempt writes a `SyncLog` row (entity type, entity id, status, error, timestamp).
- Idempotency keys prevent duplicate QBO documents on retry — see
  [quickbooks-integration.md](./quickbooks-integration.md).

## 7. Technology

| Concern        | Choice                                   |
| -------------- | ---------------------------------------- |
| Front-end      | Next.js (App Router) + TypeScript + Tailwind |
| Back-end       | NestJS + TypeScript                      |
| Database       | PostgreSQL via Prisma ORM                |
| Package tooling| pnpm workspaces + Turborepo              |
| API style      | REST, versioned under `/v1`              |
| QBO access     | OAuth 2.0 + Accounting API               |

See [api-spec.md](./api-spec.md), [database-model.md](./database-model.md), and
[deployment-plan.md](./deployment-plan.md) for the details of each layer.
