# Aussie Deal Hub

Workspace verification contract for the current slice against the local compose-backed Postgres and Redis services:

```bash
docker compose up -d postgres redis
export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub
export SHADOW_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub_shadow
psql postgresql://postgres:postgres@127.0.0.1:5432/postgres -c "DROP DATABASE IF EXISTS aussie_deals_hub_shadow"
psql postgresql://postgres:postgres@127.0.0.1:5432/postgres -c "CREATE DATABASE aussie_deals_hub_shadow"
pnpm install --frozen-lockfile
pnpm --filter @aussie-deal-hub/db exec prisma migrate diff --exit-code --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "$SHADOW_DATABASE_URL"
pnpm --filter @aussie-deal-hub/db db:migrate
pnpm verify
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
pnpm --filter @aussie-deal-hub/db db:migrate  # when DATABASE_URL is set, unless VERIFY_DB=0
pnpm test:db  # when DATABASE_URL is set, unless VERIFY_DB=0
```

`pnpm verify` will automatically run `pnpm --filter @aussie-deal-hub/db db:migrate` and include the DB-backed persistence suite whenever `DATABASE_URL` is set. You can still run the persistence suite directly with:

```bash
export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub
pnpm test:db
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

When `/v1/ready` returns `ok: false`, the web and admin `/ready` proxies preserve that readiness payload, and the readiness smoke surfaces the failing `dependencies` keys directly in the error output.
The worker runtime readiness target is stricter than the startup grace window: the smoke only passes after `/v1/admin/runtime/worker` reports `ok: true` with `status: "ok"` from a fresh completed worker pass, so `status: "starting"` or an attempted-but-not-completed first pass do not count as a verified deploy.
Dependency values stay coarse and safe: expect summaries such as `connection_failed`, `timeout`, `schema_mismatch`, `authentication_failed`, or `unavailable` instead of raw exception text.

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

If PostgreSQL is not exposed on `127.0.0.1:5432`, set `DATABASE_URL` explicitly before running the suite. For example, the split-deployment layout above uses:

```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:15432/aussie_deals_hub pnpm test:db
```

## Runtime backup

Create a PostgreSQL runtime backup with:

```bash
export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub
pnpm runtime:backup
```

The script requires `pg_dump` in `PATH`, expands `DATABASE_URL` into libpq runtime settings without placing credentials on the `pg_dump` command line, and writes a custom-format dump into `backups/` by default. Override the destination directory with `BACKUP_DIR` or the filename prefix with `BACKUP_PREFIX` when you need a different runtime layout.

## Runtime restore

Restore a PostgreSQL runtime backup with:

```bash
export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub
BACKUP_FILE=backups/aussie-deal-hub-20260429T101112Z.dump RESTORE_CONFIRM=restore pnpm runtime:restore
```

Create a fresh runtime backup with `pnpm runtime:backup` before restoring. Stop the api, web, admin, and worker processes before running restore.

This operation is destructive because it runs `pg_restore --clean --if-exists` against the target database. The script requires `pg_restore` in `PATH`, only accepts custom-format `.dump` artifacts created by `pnpm runtime:backup`, resolves `BACKUP_FILE` from the current working directory, and expands `DATABASE_URL` into libpq runtime settings without placing credentials on the `pg_restore` command line. The explicit `RESTORE_CONFIRM=restore` gate is required on every invocation to reduce accidental restores.

## Release bundle

Create a curated deployment bundle from the current checkout with:

```bash
pnpm release:bundle
pnpm release:rehearse
```

The script stages a curated deployment bundle under `release/`, copies the checked-in runtime files needed for deployment, keeps the checked-in `.dockerignore` so downloaded bundles can be reinstalled and rebuilt cleanly, skips generated directories such as `.next`, `coverage`, `backups`, and writes a `release-manifest.json` with the bundle timestamp and git SHA. Override the output root with `RELEASE_DIR` when you need to stage the bundle somewhere else.

The `Release bundle` GitHub Actions workflow is available through `workflow_dispatch`. It reruns `pnpm verify`, invokes `pnpm release:bundle`, and uploads the staged `release/` directory with `actions/upload-artifact` while preserving the checked-in dotfiles that the bundle needs at runtime.

Run `pnpm release:rehearse` from the repo root to resolve the newest staged bundle under `release/`, reinstalls workspace dependencies there, boots the staged stack with `docker compose up -d --build`, reruns `smoke:container-health`, `smoke:readiness`, and `smoke:routes`, then dumps compose logs on failure and tears the stack back down. Override the bundle root with `RELEASE_REHEARSE_ROOT` when you want to rehearse a specific extracted artifact directory.

The same workflow then downloads the uploaded artifact into a clean directory and runs `RELEASE_REHEARSE_ROOT=. pnpm release:rehearse` inside that extracted bundle so the uploaded deployment artifact itself is what gets rebuilt and smoke-tested.

## Deploy release bundle

Deploy a reviewed release bundle to a remote host with:

```bash
RELEASE_DEPLOY_ROOT=release/aussie-deal-hub-release-20260430T120000Z-abcdef123456 \
DEPLOY_HOST=deploy.example.com \
DEPLOY_USER=deploy \
DEPLOY_PATH=/srv/aussie-deal-hub \
DEPLOY_SSH_KEY_PATH=$HOME/.ssh/aussie-deal-hub \
DEPLOY_RUNTIME_API_BASE_URL=https://api.example.com \
DEPLOY_RUNTIME_WEB_BASE_URL=https://www.example.com \
DEPLOY_RUNTIME_ADMIN_BASE_URL=https://admin.example.com \
pnpm release:deploy
```

The script resolves the staged bundle from `RELEASE_DEPLOY_ROOT` or, when unset, the newest bundle under `release/`. It then copies that reviewed artifact to `/srv/aussie-deal-hub/releases`, expects the shared runtime env file at `/srv/aussie-deal-hub/shared/.env.production`, flips `/srv/aussie-deal-hub/current` to the new release, runs `docker compose --env-file ... up -d --build` remotely, and finishes by running `pnpm runtime:verify` against the supplied runtime base URLs.

If activation or post-deploy runtime verification fails after `current` has been switched, the script captures remote compose logs for the failing stack, writes local failure diagnostics to `artifacts/release-deploy/<release-name>/` with `metadata.json`, `compose-logs.txt`, and `deploy-error.txt`, repoints `/srv/aussie-deal-hub/current` back to the previous release when one exists, restarts that restored release, reruns `pnpm runtime:verify`, and still exits non-zero with the original deployment failure. If the rollback itself fails, the script still exits non-zero and surfaces both the original deployment failure and the rollback failure. Override the local diagnostics root with `RELEASE_DEPLOY_DIAGNOSTICS_ROOT` when you want those artifacts somewhere else.

Override the remote shared env filename with `DEPLOY_ENV_FILE` when the host uses something other than `.env.production`, and override the SSH port with `DEPLOY_SSH_PORT` when the deployment host does not listen on `22`.

The `Deploy release bundle` GitHub Actions workflow is available through `workflow_dispatch`. It first validates that the supplied run id belongs to a successful `Release bundle` workflow run, downloads that exact reviewed release bundle artifact, installs dependencies inside that extracted bundle, writes the SSH private key from repository secrets, and then runs `RELEASE_DEPLOY_ROOT=. pnpm release:deploy` from the downloaded bundle root with the supplied runtime verification targets. If deployment fails, the workflow uploads `${RELEASE_BUNDLE_ROOT}/artifacts/release-deploy` as `deploy-diagnostics-<bundle_run_id>` for later review.

## Runtime verify

Verify a deployed or split-port runtime with one command:

```bash
RUNTIME_API_BASE_URL=http://127.0.0.1:13001 RUNTIME_WEB_BASE_URL=http://127.0.0.1:13000 RUNTIME_ADMIN_BASE_URL=http://127.0.0.1:13002 pnpm runtime:verify
```

The script reuses the readiness and route smoke checks, derives the default endpoint URLs from `RUNTIME_API_BASE_URL`, `RUNTIME_WEB_BASE_URL`, and `RUNTIME_ADMIN_BASE_URL`, and defaults the public landing checks to the `en` locale. The route phase checks the web landing pages, the admin dashboard shell, the public deals list API contract at `/v1/public/deals/{locale}`, and the stable missing-detail 404 JSON contract at `/v1/public/deals/{locale}/route-smoke-missing-deal`. Override the landing locale with `RUNTIME_LOCALE`, or pass explicit `API_PUBLIC_DEALS_URL`, `API_PUBLIC_DEAL_URL`, other `API_*`, `WEB_*`, `ADMIN_*`, or `WORKER_RUNTIME_URL` values when a deployed stack exposes different paths.

The `Runtime verify` GitHub Actions workflow is also available through `workflow_dispatch` when you want to rerun the same deployed-stack verification remotely by supplying `runtime_api_base_url`, `runtime_web_base_url`, `runtime_admin_base_url`, and an optional `runtime_locale`.

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
