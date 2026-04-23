# Operational Curation and Source Controls Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the next v1 product slice by turning the homepage into an operationally curated surface, exposing digest preferences in the public web app, and adding basic source-management controls for editors.

**Architecture:** Keep the slice narrow and locally runnable. Reuse the existing seeded deal and digest-preference APIs for the public web experience, and add one small repository-backed admin sources route plus one admin page for source visibility and enable/disable control.

**Tech Stack:** TypeScript, Next.js App Router, Express, Prisma, Vitest, React Testing Library

---

## File Structure

### Web

- Modify: `apps/web/src/app/[locale]/page.tsx`
- Create: `apps/web/src/app/[locale]/email-preferences/page.tsx`
- Modify: `apps/web/src/lib/publicDeals.ts`
- Modify: `apps/web/src/lib/serverApi.ts`
- Create: `apps/web/src/components/home-page.test.tsx`
- Create: `apps/web/src/components/email-preferences-page.test.tsx`

Responsibilities:

- render a curated homepage with multiple editorial sections
- fetch and render persisted digest preferences
- submit updated digest preferences through the existing API

### API / DB / Admin

- Create: `packages/db/src/repositories/sources.ts`
- Modify: `packages/db/src/seed.ts`
- Modify: `packages/db/package.json`
- Create: `apps/api/src/routes/adminSources.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/index.ts`
- Create: `apps/api/tests/adminSources.persistence.test.ts`
- Create: `apps/admin/src/app/sources/page.tsx`
- Modify: `apps/admin/src/app/page.tsx`

Responsibilities:

- expose seeded source records through one admin API
- allow toggling `enabled` status on sources
- surface source health basics in the admin UI

## Task 13: Curated Homepage Sections

**Files:**
- Modify: `apps/web/src/app/[locale]/page.tsx`
- Modify: `apps/web/src/lib/publicDeals.ts`
- Test: `apps/web/src/components/home-page.test.tsx`

- [ ] Add a failing test that expects homepage sections for featured, historical lows, freebies, and gift card offers
- [ ] Verify the test fails before implementation
- [ ] Add shared curated section data in `publicDeals.ts`
- [ ] Render the homepage as editorial sections instead of a single raw link
- [ ] Run `pnpm exec vitest run --config vitest.workspace.ts apps/web/src/components/home-page.test.tsx`

## Task 14: Public Digest Preferences Page

**Files:**
- Create: `apps/web/src/app/[locale]/email-preferences/page.tsx`
- Modify: `apps/web/src/lib/serverApi.ts`
- Test: `apps/web/src/components/email-preferences-page.test.tsx`

- [ ] Add a failing test for loading and updating digest preferences in English and Chinese
- [ ] Verify the test fails before implementation
- [ ] Extend the server API helper with `getDigestPreferences` and `updateDigestPreferences`
- [ ] Add the bilingual email-preferences page with a minimal HTML form and success/error states
- [ ] Run `pnpm exec vitest run --config vitest.workspace.ts apps/web/src/components/email-preferences-page.test.tsx`

## Task 15: Admin Source Controls

**Files:**
- Create: `packages/db/src/repositories/sources.ts`
- Modify: `packages/db/src/seed.ts`
- Modify: `packages/db/package.json`
- Create: `apps/api/src/routes/adminSources.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/index.ts`
- Create: `apps/api/tests/adminSources.persistence.test.ts`
- Create: `apps/admin/src/app/sources/page.tsx`
- Modify: `apps/admin/src/app/page.tsx`

- [ ] Add a failing persistence test for listing seeded sources and toggling their enabled flag
- [ ] Verify the test fails before implementation
- [ ] Add Prisma repository helpers for listing sources and updating `enabled`
- [ ] Seed at least three editorial sources so the admin page has meaningful data
- [ ] Add an admin API route for `GET /v1/admin/sources` and `PATCH /v1/admin/sources/:sourceId`
- [ ] Add an admin sources page that lists source name, base URL, trust score, language, and enabled status
- [ ] Run `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub RUN_DB_TESTS=1 pnpm exec vitest run --config vitest.workspace.ts apps/api/tests/adminSources.persistence.test.ts`

## Verification Gate

Before claiming this batch done:

- run the three targeted test commands above
- run `pnpm test`
- run `pnpm build`
- run `pnpm --filter @aussie-deal-hub/db exec prisma validate`

