# Getting Started

> Placeholder — to be expanded.

## Prerequisites

- Node.js >= 20
- pnpm >= 9 (`npm install -g pnpm`)
- PostgreSQL 14+ running locally (or a connection string to a remote instance)

## Setup

```bash
# 1. Install dependencies for every workspace
pnpm install

# 2. Create local env files from the examples
cp .env.example .env
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env
cp packages/database/.env.example packages/database/.env

# 3. Generate the Prisma client
pnpm db:generate
```

## Running in development

```bash
# Run web + api together
pnpm dev

# Or run individually
pnpm dev:web   # Next.js  → http://localhost:3000
pnpm dev:api   # NestJS   → http://localhost:4000/v1
```

## Useful scripts

| Command             | Description                                  |
| ------------------- | -------------------------------------------- |
| `pnpm build`        | Build all packages via Turborepo             |
| `pnpm lint`         | Lint all packages                            |
| `pnpm typecheck`    | Type-check all packages                      |
| `pnpm test`         | Run tests across the monorepo                |
| `pnpm format`       | Format the repo with Prettier                |
| `pnpm db:migrate`   | Run Prisma migrations (dev)                  |
| `pnpm db:studio`    | Open Prisma Studio                           |
