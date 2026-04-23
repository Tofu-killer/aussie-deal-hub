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
| `ADMIN_API_BASE_URL` | admin | yes | Base URL that admin uses to call the API. |
| `RUN_DB_TESTS` | test only | optional | Set to `1` to include DB-backed persistence tests. |

## Database bootstrap

For a local Postgres and Redis pair that matches the example values:

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

If you also want the DB-backed persistence tests gated by `RUN_DB_TESTS`, run:

```bash
RUN_DB_TESTS=1 pnpm test
```

To verify the API slice in isolation, run:

```bash
pnpm --filter @aussie-deal-hub/api build
```
