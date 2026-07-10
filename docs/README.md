# Hardware POS — Documentation

This folder holds design and reference documentation for the Hardware POS project.

| Document                                                 | Description                                                    |
| -------------------------------------------------------- | ------------------------------------------------------------- |
| [requirements.md](./requirements.md)                     | Product scope, roles, functional/non-functional requirements. |
| [architecture.md](./architecture.md)                     | System architecture and how the packages fit together.        |
| [database-model.md](./database-model.md)                 | Local PostgreSQL / Prisma data model.                         |
| [quickbooks-integration.md](./quickbooks-integration.md) | QuickBooks Online sync design (OAuth, mapping, retry).        |
| [api-spec.md](./api-spec.md)                             | REST API contract (`/v1`).                                     |
| [deployment-plan.md](./deployment-plan.md)               | Environments, config, migrations, release flow.               |
| [getting-started.md](./getting-started.md)               | How to set up and run the monorepo locally.                   |
| [pos-features.md](./pos-features.md)                     | Cashier front-end feature list.                               |
| [testing/](./testing/README.md)                          | Test strategy: unit/integration plans, manual QA & UAT checklists. |

> QuickBooks Online remains the source of truth for products, inventory, prices, accounting,
> and reports. The POS is the cashier sales front-end. These documents describe the target
> design; features are still being built.
