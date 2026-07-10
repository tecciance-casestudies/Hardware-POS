# Deployment Plan

How to build, configure, and ship Hardware POS (`apps/web`, `apps/api`, PostgreSQL).

> Planning document. Choose concrete hosts to match the client's setup; the plan below is
> host-agnostic and works on a single VM, Docker, or a PaaS.

## 1. Environments

| Environment | Purpose                         | QBO connection            |
| ----------- | ------------------------------- | ------------------------- |
| Local       | Development                     | QBO **sandbox**           |
| Staging     | Pre-prod verification / UAT     | QBO **sandbox**           |
| Production  | Live store                      | QBO **production** company |

Each environment has its own PostgreSQL database and its own QBO OAuth credentials.

## 2. Artifacts

- **API** (`apps/api`): `pnpm --filter @hardware-pos/api build` → `dist/`, run `node dist/main.js`.
- **Web** (`apps/web`): `pnpm --filter @hardware-pos/web build` → `next start` (or a static/edge
  target depending on host).
- **Database** (`packages/database`): Prisma migrations applied with `prisma migrate deploy`.

A single Turborepo build produces both apps: `pnpm build`.

## 3. Configuration & secrets

Provide via environment variables / a secrets manager — never commit `.env`.

| Variable                          | Used by      | Notes                                   |
| --------------------------------- | ------------ | --------------------------------------- |
| `DATABASE_URL`                    | api, prisma  | PostgreSQL connection string            |
| `API_PORT`                        | api          | default 4000                            |
| `WEB_ORIGIN`                      | api          | CORS allow-list for the front-end       |
| `NEXT_PUBLIC_API_URL`             | web          | Base API URL (public)                   |
| `QBO_CLIENT_ID` / `QBO_CLIENT_SECRET` | api      | QBO OAuth app credentials               |
| `QBO_REDIRECT_URI`                | api          | Must match the QBO app config           |
| `QBO_ENVIRONMENT`                 | api          | `sandbox` \| `production`               |
| `JWT_SECRET` *(to add)*           | api          | Signs cashier session tokens            |
| `TOKEN_ENCRYPTION_KEY` *(to add)* | api          | Encrypts stored QBO tokens at rest      |

Copy from the `.env.example` files at the repo root and in each app/package.

## 4. Database migrations

- Author migrations in dev: `pnpm db:migrate` (`prisma migrate dev`).
- Apply in staging/production during release: `prisma migrate deploy` (idempotent, no prompts).
- Run migrations **before** starting the new API version.
- Back up the database before each production migration.

## 5. Release flow (CI/CD)

Recommended pipeline (e.g. GitHub Actions) on every push / PR:

1. `pnpm install --frozen-lockfile`
2. `pnpm lint` and `pnpm typecheck`
3. `pnpm test`
4. `pnpm build`
5. On merge to the release branch: build images/artifacts, run `prisma migrate deploy`,
   deploy API, then deploy web.

> No CI workflow exists in the repo yet — add `.github/workflows/ci.yml` running steps 1–4.

## 6. Runtime topology

```
        ┌──────────────┐        ┌──────────────┐        ┌──────────────┐
Browser │  apps/web    │  HTTPS │  apps/api    │  TCP   │ PostgreSQL   │
(till)  │  Next.js     │───────▶│  NestJS      │───────▶│              │
        └──────────────┘        └──────┬───────┘        └──────────────┘
                                       │ OAuth2 / Accounting API
                                       ▼
                                ┌──────────────┐
                                │ QuickBooks   │
                                │ Online       │
                                └──────────────┘
```

- Terminate TLS at a reverse proxy in front of both apps.
- The sync scheduler/worker runs in the API process (or a separate worker using the same image
  and `DATABASE_URL`) so failed syncs keep retrying independently of user traffic.

## 7. Post-deploy checklist

- [ ] `GET /v1/health` returns `ok`.
- [ ] Web loads and can reach the API (`NEXT_PUBLIC_API_URL` correct, CORS allows `WEB_ORIGIN`).
- [ ] QBO connection shows `connected: true` for the right `realmId` and environment.
- [ ] A test catalog refresh populates the product cache.
- [ ] A test sale completes locally and reaches `SYNCED` (creates the expected QBO document).
- [ ] Sync log records attempts; a forced failure can be retried.

## 8. Backups & monitoring

- Automated PostgreSQL backups with a tested restore procedure.
- Alert on: API health failures, growing `FAILED` sync backlog, and QBO token refresh errors.
- Retain `SyncLog` for audit; consider archiving old rows periodically.
