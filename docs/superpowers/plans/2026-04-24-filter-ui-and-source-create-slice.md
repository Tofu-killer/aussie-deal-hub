# Filter UI and Source Create Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add usable filter controls to public listing pages and add source creation to the admin sources page.

**Architecture:** Keep the slice deterministic and local-first. On the public side, use plain GET forms that drive the existing query-param filters for search/category pages. On the admin side, extend the current in-memory sources API with a create route and wire the sources page to submit to it alongside the existing toggle behavior.

**Tech Stack:** TypeScript, Express, Next.js App Router, React, Vitest, React Testing Library

---

## File Structure

### Public Filter UI

- Modify: `apps/web/src/app/[locale]/search/page.tsx`
- Modify: `apps/web/src/app/[locale]/categories/[category]/page.tsx`
- Modify: `apps/web/src/components/listing-filters.test.tsx`

Responsibilities:

- render filter controls for merchant, discount band, and historical-low
- preserve current query-param behavior and session-token passthrough

### Admin Source Creation

- Modify: `apps/api/src/routes/adminSources.ts`
- Modify: `apps/api/tests/adminSources.persistence.test.ts`
- Modify: `apps/admin/src/app/sources/page.tsx`
- Modify: `apps/admin/src/components/source-page.test.tsx`

Responsibilities:

- add `POST /v1/admin/sources`
- add a create-source form to the sources page
- preserve existing source toggle behavior

## Task 39: Public Filter Controls

**Files:**
- Modify: `apps/web/src/app/[locale]/search/page.tsx`
- Modify: `apps/web/src/app/[locale]/categories/[category]/page.tsx`
- Test: `apps/web/src/components/listing-filters.test.tsx`

- [ ] Add failing tests for visible filter controls and query persistence on search/category pages
- [ ] Verify the tests fail before implementation
- [ ] Add minimal GET filter forms or controls for merchant, discount band, and historical-low
- [ ] Preserve current results rendering and session-token passthrough
- [ ] Run `pnpm exec vitest run --config vitest.workspace.ts apps/web/src/components/listing-filters.test.tsx`

## Task 40: Admin Source Creation

**Files:**
- Modify: `apps/api/src/routes/adminSources.ts`
- Modify: `apps/api/tests/adminSources.persistence.test.ts`
- Modify: `apps/admin/src/app/sources/page.tsx`
- Test: `apps/admin/src/components/source-page.test.tsx`

- [ ] Add failing tests for creating a source through the API and through the sources page
- [ ] Verify the tests fail before implementation
- [ ] Add `POST /v1/admin/sources` with minimal payload validation
- [ ] Add a create-source form on the sources page and keep existing toggle behavior
- [ ] Run `pnpm exec vitest run --config vitest.workspace.ts apps/api/tests/adminSources.persistence.test.ts apps/admin/src/components/source-page.test.tsx`

## Verification Gate

Before claiming this batch done:

- run the two targeted test commands above
- run `pnpm test`
- run `pnpm build`

