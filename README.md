# Aussie Deal Hub

Repo-level verification contract for the current slice:

```bash
pnpm install
docker compose up -d
pnpm --filter @aussie-deal-hub/db db:push
pnpm --filter @aussie-deal-hub/db seed
pnpm verify
```

`pnpm verify` runs the repeatable repo contract:

```bash
pnpm build
pnpm test
```

`pnpm build` now includes:

- Prisma schema validation through `@aussie-deal-hub/db`
- API entry type-checking through `@aussie-deal-hub/api`

If you also want the DB-backed persistence tests gated by `RUN_DB_TESTS`, run:

```bash
RUN_DB_TESTS=1 pnpm test
```

To verify the API slice in isolation, run:

```bash
pnpm --filter @aussie-deal-hub/api build
```
