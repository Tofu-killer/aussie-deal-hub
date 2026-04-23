# Admin Live Catalog Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current static admin merchants and tags pages with API-backed catalog reads.

**Architecture:** Keep the slice deterministic and local-first. Add lightweight admin catalog API routes that return fixed merchant/tag rows, then update the admin pages to consume those routes with simple server-component fetches and resilient fallbacks.

**Tech Stack:** TypeScript, Express, Next.js App Router, React, Vitest, React Testing Library

---

## File Structure

### Admin Catalog API

- Modify: `apps/api/src/app.ts`
- Create: `apps/api/src/routes/adminCatalog.ts`
- Create: `apps/api/tests/adminCatalog.test.ts`

Responsibilities:

- expose `GET /v1/admin/merchants`
- expose `GET /v1/admin/tags`
- return deterministic catalog rows for local admin pages

### Admin Catalog Pages

- Modify: `apps/admin/src/app/merchants/page.tsx`
- Modify: `apps/admin/src/app/tags/page.tsx`
- Modify: `apps/admin/src/components/catalog-pages.test.tsx`

Responsibilities:

- fetch merchants/tags from the new admin catalog API
- keep table structure and useful fallback states

## Task 35: Admin Catalog API

**Files:**
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/src/routes/adminCatalog.ts`
- Test: `apps/api/tests/adminCatalog.test.ts`

- [ ] Add failing tests for `GET /v1/admin/merchants` and `GET /v1/admin/tags`
- [ ] Verify the tests fail before implementation
- [ ] Implement deterministic merchant/tag API routes
- [ ] Wire the routes into `buildApp`
- [ ] Run `pnpm exec vitest run --config vitest.workspace.ts apps/api/tests/adminCatalog.test.ts`

## Task 36: Admin Merchants and Tags Pages

**Files:**
- Modify: `apps/admin/src/app/merchants/page.tsx`
- Modify: `apps/admin/src/app/tags/page.tsx`
- Test: `apps/admin/src/components/catalog-pages.test.tsx`

- [ ] Add failing tests for API-backed merchants and tags rendering
- [ ] Verify the tests fail before implementation
- [ ] Fetch merchant rows from `/v1/admin/merchants`
- [ ] Fetch tag rows from `/v1/admin/tags`
- [ ] Preserve current table semantics and add failure/empty states
- [ ] Run `pnpm exec vitest run --config vitest.workspace.ts apps/admin/src/components/catalog-pages.test.tsx`

## Verification Gate

Before claiming this batch done:

- run the two targeted test commands above
- run `pnpm test`
- run `pnpm build`

