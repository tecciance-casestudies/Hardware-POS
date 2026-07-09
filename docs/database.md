# Database

> Placeholder — the Prisma schema currently defines no models (foundation only).
> See `packages/database/prisma/schema.prisma`.

## Engine

- PostgreSQL
- Prisma ORM (`packages/database`)

## Role

This database holds the POS's **local operational data** and a **product cache**
for fast checkout. QuickBooks Online remains the accounting and inventory master.

## Planned models

| Model              | Purpose                                                        |
| ------------------ | -------------------------------------------------------------- |
| `User`             | PIN login, roles (cashier / manager / admin)                   |
| `Product`          | Local cache of QuickBooks items, prices, and stock             |
| `Customer`         | Local cache of QuickBooks customers                            |
| `Sale` / `SaleItem`| Completed sales and line items, product-wise discounts         |
| `Payment`          | Payments recorded against sales                                |
| `SyncLog`          | QuickBooks sync status, errors, and retry tracking             |

## Conventions (planned)

- UUID primary keys.
- `createdAt` / `updatedAt` timestamps on every table.
- QuickBooks entity IDs stored alongside local records to correlate sync state.
