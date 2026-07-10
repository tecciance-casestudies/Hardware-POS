# Getting Started

Run the Hardware POS monorepo locally. The stack is a Next.js front-end (`apps/web`), a NestJS API
(`apps/api`), a Prisma/PostgreSQL data layer (`packages/database`), and shared code
(`packages/shared`).

> QuickBooks Online is the source of truth for inventory, prices and accounting. The POS is the
> cashier front-end. **You do not need QuickBooks credentials to run and demo the app** — only to
> exercise the QuickBooks connect/sync features (see [QuickBooks setup](#quickbooks-setup-optional)).

## Prerequisites

- **Node.js ≥ 20** and **pnpm ≥ 9** (`npm install -g pnpm`)
- **PostgreSQL** — either:
  - **Docker** (recommended) — the repo ships a `docker-compose.yml` that runs Postgres 16 with the
    right database/credentials/port already configured, or
  - your own **PostgreSQL 14+** running locally (or a remote connection string).

## Quick start (with Docker)

```bash
# 1. Install workspace dependencies
pnpm install

# 2. Create local env files from the examples (defaults already match docker-compose)
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp packages/database/.env.example packages/database/.env

# 3. Start the database, generate the Prisma client, run migrations, and seed demo data
pnpm setup

# 4. Run the web + API together
pnpm dev
```

- Web → <http://localhost:3000>
- API → <http://localhost:4000/v1> (health check: <http://localhost:4000/v1/health>)

`pnpm setup` is a convenience wrapper for `db:up` → `db:generate` → `db:deploy` → `db:seed`. To do it
by hand (or on subsequent runs) use the individual scripts below.

### Sign in with the seeded accounts

| Role | How to sign in |
| --- | --- |
| Owner | `owner@hardwarepos.test` / `password123` |
| Accountant | `accountant@hardwarepos.test` / `password123` |
| Manager | PIN `2222` |
| Cashier | PIN `1111` |

All seeded data belongs to tenant `tnt_dev`; PIN logins resolve the tenant from the `x-tenant-id`
header (`tnt_dev`), which the front-end sends for you. The seed also loads 10 hardware products.

## Quick start (without Docker)

If you already run PostgreSQL locally, skip `db:up` and just point `DATABASE_URL` at your instance.

```bash
pnpm install
cp .env.example .env && cp apps/api/.env.example apps/api/.env \
  && cp apps/web/.env.example apps/web/.env && cp packages/database/.env.example packages/database/.env

# Edit DATABASE_URL in apps/api/.env AND packages/database/.env to match your DB, e.g.
#   postgresql://<user>:<pass>@localhost:5432/hardware_pos?schema=public
# Create the database first if it doesn't exist:  createdb hardware_pos

pnpm db:generate      # generate the Prisma client
pnpm db:deploy        # apply migrations
pnpm db:seed          # load demo tenant, users and products
pnpm dev
```

## Environment variables

Each app reads its own `.env` (copied from the matching `.env.example`). Defaults work out of the box
with the bundled Docker database.

| File | Key | Purpose |
| --- | --- | --- |
| `apps/api/.env` | `DATABASE_URL` | PostgreSQL connection (Prisma). |
| | `API_PORT` | API port (default `4000`). |
| | `WEB_ORIGIN` | Allowed CORS origin (default `http://localhost:3000`). |
| | `JWT_SECRET` | Secret used to sign session JWTs — **set a long random value**. |
| | `JWT_EXPIRES_IN` | Session lifetime (default `12h`). |
| | `TOKEN_ENCRYPTION_KEY` | Encrypts stored QuickBooks tokens at rest (required for QuickBooks). |
| | `QUICKBOOKS_*` | QuickBooks OAuth app config (optional — see below). |
| | `SYNC_WORKER_*` | Background sync-worker tuning (sensible defaults; `SYNC_WORKER_ENABLED=false` disables it). |
| `packages/database/.env` | `DATABASE_URL` | Same connection string — used by the Prisma CLI (migrate/seed/studio). |
| `apps/web/.env` | `NEXT_PUBLIC_API_URL` | API base URL exposed to the browser (default `http://localhost:4000/v1`). |

> Keep `DATABASE_URL` identical in `apps/api/.env` and `packages/database/.env`.

## QuickBooks setup (optional)

To exercise Connect / product sync / sales sync against QuickBooks:

1. Create a sandbox app at <https://developer.intuit.com> and copy its keys.
2. In `apps/api/.env` set `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_CLIENT_SECRET`, and a strong
   `TOKEN_ENCRYPTION_KEY`. Keep `QUICKBOOKS_ENVIRONMENT=sandbox`.
3. Add `http://localhost:4000/v1/quickbooks/callback` as a redirect URI in the Intuit app.
4. Sign in as Owner/Admin, open **QuickBooks → Connect**, and authorize the sandbox company.

Tokens are encrypted at rest and never sent to the browser. Without these keys the app runs fine; the
QuickBooks screens simply show "not connected."

## Useful scripts

| Command | Description |
| --- | --- |
| `pnpm setup` | Start DB (Docker) + generate client + migrate + seed. |
| `pnpm dev` | Run web + API together (Turborepo). |
| `pnpm dev:web` / `pnpm dev:api` | Run one app. |
| `pnpm build` | Build all packages. |
| `pnpm typecheck` | Type-check all packages. |
| `pnpm lint` / `pnpm format` | Lint / format the repo. |
| `pnpm test` | Run tests across the monorepo. |
| `pnpm db:up` / `pnpm db:down` | Start / stop the Docker Postgres (data is kept). |
| `pnpm db:reset` | Drop the Docker DB volume, recreate, migrate and re-seed. |
| `pnpm db:generate` | Generate the Prisma client. |
| `pnpm db:migrate` | Create + apply a new migration (dev). |
| `pnpm db:deploy` | Apply existing migrations (no prompts). |
| `pnpm db:seed` | Seed demo data. |
| `pnpm db:studio` | Open Prisma Studio. |

## Troubleshooting

- **`Can't reach database server` / `ECONNREFUSED`** — the DB isn't up. Run `pnpm db:up` (Docker) or
  start your local Postgres, and confirm `DATABASE_URL` host/port/credentials.
- **Port already in use** — something else is on `3000`/`4000`/`5432`. Stop it, or change `API_PORT`
  (`apps/api/.env`), the web dev port (`apps/web`), or the compose port mapping.
- **`@prisma/client did not initialize yet`** — run `pnpm db:generate` (and re-run after changing
  `schema.prisma`).
- **401 on API calls** — you need a bearer token; sign in first (`POST /v1/auth/login` or
  `/v1/auth/pin-login`).
- **Migrations out of sync in dev** — `pnpm db:reset` recreates the Docker database from scratch.
- **Docker image won't pull** — `pnpm db:up` needs access to Docker Hub (`postgres:16`); on a
  restricted network use the "without Docker" path against a local/remote Postgres instead.
