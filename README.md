# Aussie Deal Hub

Minimal deploy contract for the current slice:

```bash
pnpm install
docker compose up -d
pnpm --filter @aussie-deal-hub/db db:push
pnpm --filter @aussie-deal-hub/db seed
pnpm verify
```

GitHub Actions runs the same contract from `.github/workflows/verify.yml` on `main` pushes and pull requests:

```bash
pnpm install --frozen-lockfile
pnpm verify
```

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
| `EMAIL_FROM` | api | yes | Sender address for outbound mail flows. |
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
| `WORKER_DIGEST_ENABLED` | worker | optional | Set to `0` to disable automatic daily digest delivery for eligible subscribers. |
| `WORKER_STATE_PATH` | api, worker | optional | Shared state file used for worker heartbeat and admin runtime visibility. |
| `WORKER_STALE_AFTER_MS` | api, worker | optional | Maximum heartbeat age before the worker is reported stale. |
| `RUN_DB_TESTS` | test only | optional | Set to `1` to include DB-backed persistence tests. |

## Containerized stack

To boot the full local stack with Postgres, Redis, API, web, and admin:

```bash
docker compose up -d --build
```

Compose now includes:

- `db-init` to apply the Prisma schema and seed baseline data
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
docker compose up -d
```

Apply the Prisma schema and seed the baseline data:

```bash
pnpm --filter @aussie-deal-hub/db db:push
pnpm --filter @aussie-deal-hub/db seed
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

If you also want the DB-backed persistence tests gated by `RUN_DB_TESTS`, run:

```bash
RUN_DB_TESTS=1 pnpm test
```

To verify the API slice in isolation, run:

```bash
pnpm --filter @aussie-deal-hub/api build
```
