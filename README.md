# Aussie Deal Hub

Workspace verification contract for the current slice against the local compose-backed Postgres and Redis services:

```bash
docker compose up -d postgres redis
export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub
export SHADOW_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub_shadow
psql postgresql://postgres:postgres@127.0.0.1:5432/postgres -c "DROP DATABASE IF EXISTS aussie_deals_hub_shadow"
psql postgresql://postgres:postgres@127.0.0.1:5432/postgres -c "CREATE DATABASE aussie_deals_hub_shadow"
pnpm install --frozen-lockfile
pnpm verify
pnpm --filter @aussie-deal-hub/db exec prisma migrate diff --exit-code --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "$SHADOW_DATABASE_URL"
pnpm --filter @aussie-deal-hub/db db:migrate
pnpm test:db
```

The GitHub workflow in `.github/workflows/verify.yml` verifies those same build/test/migrate entrypoints against a service PostgreSQL instance, exercises the legacy `db:push -> db:migrate` upgrade path, and also runs the container smoke checks.

Container boot contract:

```bash
docker compose up -d --build
```

Compose already includes `db-init`, so the containerized path does not need an extra host-side `db:migrate` invocation.

`db:migrate` is safe for both fresh databases and legacy non-empty databases that were previously bootstrapped with `db:push`: it only auto-marks the checked-in baseline as applied when `_prisma_migrations` is missing and the live database still matches the checked-in Prisma schema, then runs `prisma migrate deploy`.

The checked-in migrations ensure the default admin catalog rows, canonical ingestion sources, and canonical selected public price snapshots exist for fresh stacks; they do not rewrite existing runtime rows that already diverged.
For legacy databases that already contain customized source or snapshot rows, the migrations add the canonical baseline rows alongside those existing rows instead of trying to reconcile semantic duplicates.

`pnpm verify` runs the repeatable workspace contract:

```bash
pnpm build
pnpm test
```

`pnpm build` includes:

- Prisma schema validation through `@aussie-deal-hub/db`
- API entry type-checking through `@aussie-deal-hub/api`

## Production environment

Set runtime variables in your process manager or deployment platform before starting the services. A complete example is in `.env.example`.

| Variable | Used by | Required | Notes |
| --- | --- | --- | --- |
| `NODE_ENV` | api | yes | Use `production` outside local development. |
| `API_HOST` | api | yes | Bind host for the Express server. |
| `API_PORT` | api | yes | API listen port. |
| `DATABASE_URL` | api, db | yes | PostgreSQL connection string used by Prisma. |
| `REDIS_URL` | api | yes | Redis connection string. |
| `SESSION_SECRET` | api | yes | Must be at least 16 characters. |
| `EMAIL_FROM` | api, worker | yes | Sender address for outbound mail flows. |
| `SMTP_HOST` | api, worker | yes in production | SMTP server hostname. |
| `SMTP_PORT` | api, worker | yes in production | SMTP server port. |
| `SMTP_SECURE` | api, worker | optional | Set to `1`/`true` for implicit TLS; defaults to `0`. |
| `SMTP_USER` | api, worker | optional | SMTP auth username; must be paired with `SMTP_PASS`. |
| `SMTP_PASS` | api, worker | optional | SMTP auth password; must be paired with `SMTP_USER`. |
| `API_BASE_URL` | web | yes | Server-side base URL that web uses to call the API. |
| `NEXT_PUBLIC_SITE_URL` | web | yes | Public site origin used for canonical URLs and sitemap output. |
| `SITE_URL` | web | optional | Legacy fallback for `NEXT_PUBLIC_SITE_URL`. |
| `PUBLIC_SEEDED_DEALS_ENABLED` | web | optional | Force-enable (`1`) or disable (`0`) seeded fallback deals. Production defaults to disabled. |
| `ADMIN_API_BASE_URL` | admin | yes | Base URL that admin uses to call the API. |
| `ADMIN_BASIC_AUTH_USERNAME` | admin | optional | Enables HTTP Basic Auth on the admin app when paired with a password. |
| `ADMIN_BASIC_AUTH_PASSWORD` | admin | optional | Password for admin HTTP Basic Auth. |
| `ADMIN_BASIC_AUTH_REALM` | admin | optional | Override the HTTP Basic Auth browser prompt realm. |
| `WORKER_POLL_INTERVAL_MS` | worker | optional | Poll interval for the background review/publish loop. |
| `WORKER_INGEST_ENABLED` | worker | optional | Set to `0` to disable automatic source polling and lead ingestion. |
| `WORKER_REVIEW_ENABLED` | worker | optional | Set to `0` to disable automatic draft generation for pending leads. |
| `WORKER_PUBLISH_ENABLED` | worker | optional | Set to `0` to disable automatic publishing of due reviewed leads. |
| `WORKER_DIGEST_ENABLED` | worker | optional | Set to `0` to disable automatic digest delivery for eligible daily and weekly subscribers. |
| `WORKER_STATE_PATH` | api, worker | optional | Shared state file used for worker heartbeat and admin runtime visibility. |
| `WORKER_STALE_AFTER_MS` | api, worker | optional | Maximum heartbeat age before the worker is reported stale. |
| `RUN_DB_TESTS` | test only | optional | Only needed for direct Vitest invocations; `pnpm test:db` sets it automatically. |

The compose stack keeps `SMTP_*` on local placeholders for smoke verification only. Replace those values with a real mail provider before enabling production login or digest delivery.

## Containerized stack

To boot the full local stack with Postgres, Redis, API, web, and admin:

```bash
docker compose up -d --build
```

Compose now includes:

- `db-init` to apply checked-in Prisma migrations
- `api` with `/v1/health` and `/v1/ready`
- `web` with `/health` and `/ready`
- `admin` with `/health` and `/ready`
- `worker` to continuously review pending leads and publish due reviewed leads

The liveness/readiness split is:

- liveness:
  - `api`: `/v1/health`
  - `web`: `/health`
  - `admin`: `/health`
- readiness:
  - `api`: `/v1/ready`
  - `web`: `/ready`
  - `admin`: `/ready`

## Database bootstrap

If you want to run only Postgres and Redis locally instead of the full app stack:

```bash
docker compose up -d postgres redis
```

Apply the checked-in Prisma migrations:

```bash
export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub
pnpm --filter @aussie-deal-hub/db db:migrate
```

For existing non-empty databases that were previously managed with `db:push`, the wrapper behind `db:migrate` automatically marks `20260425000000_baseline` as applied once before running `prisma migrate deploy` only when `_prisma_migrations` is missing and the live database still matches the checked-in Prisma schema.

Those checked-in migrations also ensure the canonical admin catalogs, runtime sources, and selected public deal snapshots exist for a fresh stack without rewriting already-customized runtime rows.

Then run the DB-backed persistence suite:

```bash
export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub
pnpm test:db
```

If PostgreSQL is not exposed on `127.0.0.1:5432`, set `DATABASE_URL` explicitly before running the suite. For example, the split-deployment layout above uses:

```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:15432/aussie_deals_hub pnpm test:db
```

## Service start commands

Build the workspace once before starting the Next.js apps:

```bash
pnpm build
```

Start the API:

```bash
pnpm --filter @aussie-deal-hub/api start
```

Start the public web app on port `3000`:

```bash
PORT=3000 pnpm --filter @aussie-deal-hub/web start
```

Start the admin app on port `3002`:

```bash
PORT=3002 pnpm --filter @aussie-deal-hub/admin start
```

Start the worker:

```bash
pnpm --filter @aussie-deal-hub/worker start
```

## Existing Host Deployment

For hosts that already run other services and where you need isolated ports instead of taking over `80/443`, use a split deployment:

- infrastructure containers:
  - Postgres on `15432`
  - Redis on `16379`
- host-native app processes:
  - web on `13000`
  - api on `13001`
  - admin on `13002`
  - worker as a portless background service

That mode works well when:

- Docker is available for stateful dependencies
- the host already has other public services
- you want to avoid conflicting with existing ports or reverse proxies

The current repo supports that setup because:

- `apps/api` now starts through `tsx`, so it does not depend on Node 22-only `--experimental-strip-types`
- `admin` browser requests are proxied at runtime through `/v1/[...path]`
- `admin` can be protected with optional HTTP Basic Auth through `ADMIN_BASIC_AUTH_USERNAME` and `ADMIN_BASIC_AUTH_PASSWORD`
- `health` and `ready` endpoints exist for all three app services

If you also want the DB-backed persistence tests, run:

```bash
pnpm test:db
```

To verify the API slice in isolation, run:

```bash
pnpm --filter @aussie-deal-hub/api build
```
