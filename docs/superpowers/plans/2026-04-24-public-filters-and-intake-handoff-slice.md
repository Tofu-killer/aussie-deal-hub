# Public Filters and Intake Handoff Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add practical public listing filters and improve the admin intake page so a reviewed lead can be created and handed off into the lead queue.

**Architecture:** Keep the slice deterministic and local-first. On the public side, extend seeded deal metadata with filterable flags and apply query-param filters to search/category pages. On the admin side, reuse the existing `POST /v1/admin/leads` route from the intake page rather than introducing new persistence.

**Tech Stack:** TypeScript, Next.js App Router, React, Vitest, React Testing Library

---

## File Structure

### Public Listing Filters

- Modify: `apps/web/src/lib/publicDeals.ts`
- Modify: `apps/web/src/lib/discovery.ts`
- Modify: `apps/web/src/app/[locale]/search/page.tsx`
- Modify: `apps/web/src/app/[locale]/categories/[category]/page.tsx`
- Create: `apps/web/src/components/listing-filters.test.tsx`

Responsibilities:

- add seeded filter metadata
- support query-param filters on search and category pages
- keep locale routing and session-token passthrough intact

### Admin Intake Handoff

- Modify: `apps/admin/src/app/intake/page.tsx`
- Modify: `apps/admin/src/components/admin-preview-pages.test.tsx`

Responsibilities:

- allow the intake page to submit a reviewed raw lead into `/v1/admin/leads`
- show success/error feedback for the handoff
- preserve the existing AI preview behavior

## Task 29: Public Listing Filters

**Files:**
- Modify: `apps/web/src/lib/publicDeals.ts`
- Modify: `apps/web/src/lib/discovery.ts`
- Modify: `apps/web/src/app/[locale]/search/page.tsx`
- Modify: `apps/web/src/app/[locale]/categories/[category]/page.tsx`
- Test: `apps/web/src/components/listing-filters.test.tsx`

- [ ] Add failing tests for merchant, historical-low, and discount-band filters on search/category pages
- [ ] Verify the tests fail before implementation
- [ ] Extend seeded deal metadata with deterministic filter fields
- [ ] Implement filter helpers and wire them into search/category pages
- [ ] Run `pnpm exec vitest run --config vitest.workspace.ts apps/web/src/components/listing-filters.test.tsx`

## Task 30: Admin Intake Handoff

**Files:**
- Modify: `apps/admin/src/app/intake/page.tsx`
- Test: `apps/admin/src/components/admin-preview-pages.test.tsx`

- [ ] Add failing tests for creating a lead from the intake page after previewing it
- [ ] Verify the tests fail before implementation
- [ ] Add a create-lead action on the intake page that calls `POST /v1/admin/leads`
- [ ] Render success/error feedback or redirect behavior without regressing the current preview flow
- [ ] Run `pnpm exec vitest run --config vitest.workspace.ts apps/admin/src/components/admin-preview-pages.test.tsx`

## Verification Gate

Before claiming this batch done:

- run the two targeted test commands above
- run `pnpm test`
- run `pnpm build`

