# Architecture

> Placeholder — to be expanded.

## Overview

QuickBooks Online is the **inventory and accounting source of truth**. The POS is
a fast cashier sales front-end that:

- **pulls** products, prices, and stock from QuickBooks, and
- **pushes** completed sales, invoices, and payments back to QuickBooks.

Stock is never edited independently in both systems. The POS keeps a local
product cache for fast checkout; if sync fails, sales are saved and retried
later.

## Monorepo layout

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

## Components

| Layer                | Package                  | Responsibility                                            |
| -------------------- | ------------------------ | --------------------------------------------------------- |
| Cashier front-end    | `apps/web`               | Product search, cart, discounts, payment, receipt, sync UI |
| Backend API          | `apps/api`               | Auth, sales processing, discount rules, sync orchestration |
| Local database       | `packages/database`      | Cached products, customers, sales, payments, sync logs      |
| QuickBooks service   | (future module in `api`) | OAuth 2.0 + Accounting API, product/sale/payment sync       |
| Shared contracts     | `packages/shared`        | Types and enums shared by web and api                       |

## Transaction mapping (planned)

- Fully paid sale → QuickBooks **Sales Receipt**
- Partial / credit sale → QuickBooks **Invoice + Payment**
- Return / exchange → **Refund / Credit** flow
