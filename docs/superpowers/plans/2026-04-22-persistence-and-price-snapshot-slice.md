# Persistence and Price Snapshot Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the current in-memory bargain flow into the database, expose selected price snapshots, and connect the public favorites surface to real API data.

**Architecture:** Extend the Prisma schema with persistence for favorites, digest preferences, and price snapshots, then add thin repository-backed API routes and wire the web experience to those routes. Keep the slice narrow: one seeded published deal, one working favorites loop, and one selected price-snapshot view path.

**Tech Stack:** TypeScript, Prisma, Next.js, Express, Vitest, React Testing Library, node-mocks-http

---

## Scope

This batch covers:

- persisted favorites instead of process memory
- persisted email digest preferences
- persisted selected price snapshots
- read paths for public deal detail and favorites
- one public UI slice that shows price context from persisted snapshots

This batch does not cover:

- real email delivery
- crawler ingestion from external sites
- admin source management
- scheduled publishing
- full auth hardening beyond current session approach

## File Structure

### Database

- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/src/repositories/favorites.ts`
- Create: `packages/db/src/repositories/priceSnapshots.ts`
- Create: `packages/db/src/repositories/digestSubscriptions.ts`

### API

- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/routes/favorites.ts`
- Modify: `apps/api/src/routes/publicDeals.ts`
- Create: `apps/api/src/routes/digestPreferences.ts`
- Test: `apps/api/tests/favorites.persistence.test.ts`
- Test: `apps/api/tests/publicDealPriceContext.test.ts`

### Web

- Modify: `apps/web/src/app/[locale]/favorites/page.tsx`
- Modify: `apps/web/src/app/[locale]/deals/[slug]/page.tsx`
- Create: `apps/web/src/lib/serverApi.ts`
- Test: `apps/web/src/components/favorites-and-price-context.test.tsx`

### Worker

- Modify: `apps/worker/src/jobs/buildDigest.ts`
- Test: `apps/worker/src/jobs/buildDigest.persistence.test.ts`

## Task 8: Persist Favorites and Digest Preferences in Prisma

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/src/repositories/favorites.ts`
- Create: `packages/db/src/repositories/digestSubscriptions.ts`
- Test: `apps/api/tests/favorites.persistence.test.ts`

- [ ] Add Prisma models for `Favorite` and `EmailDigestSubscription`
- [ ] Add repository functions that upsert favorites by normalized email and list favorites by normalized email
- [ ] Add repository functions that upsert digest preferences by normalized email
- [ ] Add or update tests that prove re-login keeps favorites because they are keyed by email identity, not session token
- [ ] Verify with `pnpm exec vitest run --config vitest.workspace.ts apps/api/tests/favorites.persistence.test.ts`

## Task 9: Persist Selected Price Snapshots

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/src/repositories/priceSnapshots.ts`
- Test: `apps/api/tests/publicDealPriceContext.test.ts`

- [ ] Add a `PriceSnapshot` model keyed to the seeded published deal slug
- [ ] Add repository functions to write and read snapshots for one selected deal
- [ ] Seed at least two snapshots for the existing Nintendo Switch deal
- [ ] Verify the public API can return price-context data for that deal
- [ ] Verify with `pnpm exec vitest run --config vitest.workspace.ts apps/api/tests/publicDealPriceContext.test.ts`

## Task 10: Wire API Routes to Persistence

**Files:**
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/routes/favorites.ts`
- Modify: `apps/api/src/routes/publicDeals.ts`
- Create: `apps/api/src/routes/digestPreferences.ts`
- Test: `apps/api/tests/favorites.persistence.test.ts`
- Test: `apps/api/tests/publicDealPriceContext.test.ts`

- [ ] Replace in-memory favorite reads/writes with repository-backed reads/writes
- [ ] Add digest-preference route with minimal `GET` and `PUT`
- [ ] Extend public deal route so detail payload includes selected price snapshots
- [ ] Keep current auth/session shape, but read identity from verified session email
- [ ] Verify targeted API tests and then `pnpm test`

## Task 11: Wire Public Favorites and Price Context UI

**Files:**
- Modify: `apps/web/src/app/[locale]/favorites/page.tsx`
- Modify: `apps/web/src/app/[locale]/deals/[slug]/page.tsx`
- Create: `apps/web/src/lib/serverApi.ts`
- Test: `apps/web/src/components/favorites-and-price-context.test.tsx`

- [ ] Add a tiny server-side API client that can fetch favorites and public deal price context
- [ ] Replace placeholder favorites copy with rendered favorite deal rows
- [ ] Add a small price-context section on the public detail page showing selected snapshots
- [ ] Keep locale copy bilingual for new labels
- [ ] Verify with targeted web tests and `pnpm --filter @aussie-deal-hub/web build`

## Task 12: Use Persisted Inputs in Digest Worker

**Files:**
- Modify: `apps/worker/src/jobs/buildDigest.ts`
- Test: `apps/worker/src/jobs/buildDigest.persistence.test.ts`
- Modify: `README.md`

- [ ] Make `buildDigestJob` accept repository-style persisted favorites / deals input instead of only ad hoc arrays
- [ ] Verify the job only includes published deals that correspond to saved favorites
- [ ] Update README verification steps for the new persistence slice
- [ ] Verify with targeted worker tests and full `pnpm test`

## Verification Gate

Before claiming this batch done:

- run targeted tests for each touched slice
- run full `pnpm test`
- run `pnpm build`
- run `pnpm --filter @aussie-deal-hub/web build`
- run `pnpm --filter @aussie-deal-hub/admin build`
- run `pnpm --filter @aussie-deal-hub/db exec prisma validate`

## Handoff

This plan is the next execution batch after the foundation slice. Execute it with the same pattern already established in this repository: subagent-driven implementation, spec review, code-quality review, clean worktree, then push.
