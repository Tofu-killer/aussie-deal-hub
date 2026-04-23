# Admin Catalog and Publishing Pages Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the next admin operations slice by creating merchant/tag management pages and a publishing/scheduling page.

**Architecture:** Keep the slice local and deterministic. Use lightweight preview fixtures rendered directly by admin pages rather than introducing persistence yet. Split the work into two independent write scopes: catalog pages on one side, publishing page plus dashboard navigation on the other.

**Tech Stack:** TypeScript, Next.js App Router, React, Vitest, React Testing Library

---

## File Structure

### Merchant and Tag Management

- Create: `apps/admin/src/app/merchants/page.tsx`
- Create: `apps/admin/src/app/tags/page.tsx`
- Create: `apps/admin/src/components/catalog-pages.test.tsx`

Responsibilities:

- render deterministic merchant and tag management tables
- expose enough metadata to make the admin module useful in local review

### Publishing and Scheduling

- Modify: `apps/admin/src/app/page.tsx`
- Create: `apps/admin/src/app/publishing/page.tsx`
- Create: `apps/admin/src/components/publishing-page.test.tsx`

Responsibilities:

- render a publishing queue / scheduling page
- show featured-slot and publish-at preview rows
- add dashboard navigation to the new admin modules

## Task 25: Merchant and Tag Management Pages

**Files:**
- Create: `apps/admin/src/app/merchants/page.tsx`
- Create: `apps/admin/src/app/tags/page.tsx`
- Test: `apps/admin/src/components/catalog-pages.test.tsx`

- [ ] Add failing tests for merchant and tag management pages
- [ ] Verify the tests fail before implementation
- [ ] Add a merchants page with deterministic merchant rows and useful columns
- [ ] Add a tags page with deterministic tag rows and useful columns
- [ ] Run `pnpm exec vitest run --config vitest.workspace.ts apps/admin/src/components/catalog-pages.test.tsx`

## Task 26: Publishing Queue and Dashboard Links

**Files:**
- Modify: `apps/admin/src/app/page.tsx`
- Create: `apps/admin/src/app/publishing/page.tsx`
- Test: `apps/admin/src/components/publishing-page.test.tsx`

- [ ] Add failing tests for publishing page content and dashboard navigation links
- [ ] Verify the tests fail before implementation
- [ ] Add a publishing page that shows featured slot, publish-at, locale, and status for deterministic preview rows
- [ ] Update the admin dashboard with links to `/publishing`, `/merchants`, and `/tags`
- [ ] Run `pnpm exec vitest run --config vitest.workspace.ts apps/admin/src/components/publishing-page.test.tsx`

## Verification Gate

Before claiming this batch done:

- run the two targeted test commands above
- run `pnpm test`
- run `pnpm build`

