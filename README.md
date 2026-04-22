# Aussie Deal Hub

Local verification for the foundation, core publishing, and persistence slice:

```bash
pnpm install
docker compose up -d
pnpm --filter @aussie-deal-hub/db exec prisma validate
pnpm --filter @aussie-deal-hub/db db:push
pnpm --filter @aussie-deal-hub/db seed
pnpm exec vitest run --config vitest.workspace.ts apps/worker/src/jobs/reviewPendingLeads.test.ts
pnpm exec vitest run --config vitest.workspace.ts apps/worker/src/jobs/buildDigest.test.ts
pnpm exec vitest run --config vitest.workspace.ts apps/worker/src/jobs/buildDigest.persistence.test.ts
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub RUN_DB_TESTS=1 pnpm exec vitest run --config vitest.workspace.ts apps/api/tests/favorites.persistence.test.ts apps/api/tests/publicDealPriceContext.test.ts apps/worker/src/jobs/buildDigest.persistence.test.ts
pnpm exec vitest run --config vitest.workspace.ts apps/api/tests/adminLeads.test.ts apps/api/tests/publicDeals.test.ts apps/worker/src/jobs/reviewPendingLeads.test.ts apps/worker/src/jobs/buildDigest.test.ts apps/worker/src/jobs/buildDigest.persistence.test.ts
pnpm test
```

The targeted commands verify the local lead-review-to-digest flow, DB-backed favorites and price snapshot coverage, Prisma schema validity, and the current workspace test suite.
