# Advanced Filters and Catalog Create Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the remaining public listing filters from the v1 spec and add create forms to the admin merchants/tags catalog pages.

**Architecture:** Keep the slice deterministic and local-first. On the public side, extend seeded deal metadata with `freeShipping` and `endingSoon` flags, then wire those filters into the existing query-param and form flow. On the admin side, add lightweight create routes and forms for merchants and tags without introducing persistence beyond deterministic in-memory fixtures.

**Tech Stack:** TypeScript, Express, Next.js App Router, React, Vitest, React Testing Library

---

## File Structure

### Advanced Public Filters

- Modify: `apps/web/src/lib/publicDeals.ts`
- Modify: `apps/web/src/lib/discovery.ts`
- Modify: `apps/web/src/app/[locale]/search/page.tsx`
- Modify: `apps/web/src/app/[locale]/categories/[category]/page.tsx`
- Modify: `apps/web/src/components/listing-filters.test.tsx`

Responsibilities:

- add deterministic `freeShipping` and `endingSoon` metadata
- support those filters in search/category logic and visible controls
- preserve existing query-param and session-token behavior

### Admin Merchant and Tag Creation

- Modify: `apps/api/src/routes/adminCatalog.ts`
- Modify: `apps/api/tests/adminCatalog.test.ts`
- Modify: `apps/admin/src/app/merchants/page.tsx`
- Modify: `apps/admin/src/app/tags/page.tsx`
- Modify: `apps/admin/src/components/catalog-pages.test.tsx`

Responsibilities:

- add create routes for merchants and tags
- add create forms on merchants/tags pages
- preserve current catalog table rendering

## Task 41: Free Shipping and Ending-Soon Filters

**Files:**
- Modify: `apps/web/src/lib/publicDeals.ts`
- Modify: `apps/web/src/lib/discovery.ts`
- Modify: `apps/web/src/app/[locale]/search/page.tsx`
- Modify: `apps/web/src/app/[locale]/categories/[category]/page.tsx`
- Test: `apps/web/src/components/listing-filters.test.tsx`

- [ ] Add failing tests for `free-shipping` and `ending-soon` filter controls and result filtering
- [ ] Verify the tests fail before implementation
- [ ] Extend seeded deal metadata with deterministic `freeShipping` and `endingSoon` fields
- [ ] Wire the new filters into search/category logic and form controls
- [ ] Run `pnpm exec vitest run --config vitest.workspace.ts apps/web/src/components/listing-filters.test.tsx`

## Task 42: Merchant and Tag Creation Forms

**Files:**
- Modify: `apps/api/src/routes/adminCatalog.ts`
- Modify: `apps/api/tests/adminCatalog.test.ts`
- Modify: `apps/admin/src/app/merchants/page.tsx`
- Modify: `apps/admin/src/app/tags/page.tsx`
- Modify: `apps/admin/src/components/catalog-pages.test.tsx`

- [ ] Add failing tests for `POST /v1/admin/merchants`, `POST /v1/admin/tags`, and create-form behavior on the admin pages
- [ ] Verify the tests fail before implementation
- [ ] Add deterministic in-memory create routes for merchants and tags
- [ ] Add create forms on the merchants and tags pages with minimal success/error feedback
- [ ] Preserve existing catalog table rendering and ordering semantics
- [ ] Run `pnpm exec vitest run --config vitest.workspace.ts apps/api/tests/adminCatalog.test.ts apps/admin/src/components/catalog-pages.test.tsx`

## Verification Gate

Before claiming this batch done:

- run the two targeted test commands above
- run `pnpm test`
- run `pnpm build`

