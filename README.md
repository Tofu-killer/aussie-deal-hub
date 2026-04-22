# Aussie Deal Hub

Local verification for the foundation and core publishing slice:

```bash
pnpm install
docker compose up -d
pnpm --filter @aussie-deal-hub/db exec prisma validate
pnpm exec vitest run --config vitest.workspace.ts apps/worker/src/jobs/reviewPendingLeads.test.ts
pnpm exec vitest run --config vitest.workspace.ts apps/worker/src/jobs/buildDigest.test.ts
pnpm exec vitest run --config vitest.workspace.ts apps/api/tests/adminLeads.test.ts apps/api/tests/publicDeals.test.ts apps/worker/src/jobs/reviewPendingLeads.test.ts apps/worker/src/jobs/buildDigest.test.ts
pnpm test
```

The targeted commands verify the local lead-review-to-digest flow, Prisma schema validity, and the current workspace test suite.
