# Admin Preview APIs and Pages Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the next admin operations slice by exposing AI review preview and digest preview APIs, then wiring lightweight admin intake and digest pages to those previews.

**Architecture:** Keep the slice deterministic and local-first. The API layer will expose one review-preview route powered by the existing AI helper and one digest-preview route powered by existing digest assembly logic; the admin app will consume those routes with simple preview forms/pages without introducing persistence yet.

**Tech Stack:** TypeScript, Express, Next.js App Router, React, Vitest, React Testing Library

---

## File Structure

### API Preview Routes

- Modify: `apps/api/package.json`
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/src/routes/adminPreview.ts`
- Create: `apps/api/tests/adminPreview.test.ts`

Responsibilities:

- expose `POST /v1/admin/review-preview` for raw lead preview
- expose `GET /v1/admin/digest-preview` for deterministic digest preview
- keep current API app wiring intact

### Admin Preview Pages

- Modify: `apps/admin/src/app/page.tsx`
- Create: `apps/admin/src/app/intake/page.tsx`
- Create: `apps/admin/src/app/digest/page.tsx`
- Create: `apps/admin/src/components/admin-preview-pages.test.tsx`

Responsibilities:

- add intake preview and digest preview pages to admin
- fetch preview data from the new admin API routes
- keep the implementation lightweight and locally testable

## Task 23: Admin Preview API Routes

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/src/routes/adminPreview.ts`
- Test: `apps/api/tests/adminPreview.test.ts`

- [ ] Add a failing API test for `POST /v1/admin/review-preview` and `GET /v1/admin/digest-preview`
- [ ] Verify the test fails before implementation
- [ ] Add any needed workspace dependency for digest preview assembly
- [ ] Implement the preview route with deterministic review and digest payloads
- [ ] Wire the route into `buildApp`
- [ ] Run `pnpm exec vitest run --config vitest.workspace.ts apps/api/tests/adminPreview.test.ts`

## Task 24: Admin Intake and Digest Preview Pages

**Files:**
- Modify: `apps/admin/src/app/page.tsx`
- Create: `apps/admin/src/app/intake/page.tsx`
- Create: `apps/admin/src/app/digest/page.tsx`
- Test: `apps/admin/src/components/admin-preview-pages.test.tsx`

- [ ] Add a failing admin page test for the intake preview page, digest preview page, and admin-home navigation links
- [ ] Verify the test fails before implementation
- [ ] Add `/intake` page with a minimal form that previews localized AI review output from the admin API
- [ ] Add `/digest` page that renders localized digest subjects and preview deal rows from the admin API
- [ ] Update the admin home page with links to the new preview pages
- [ ] Run `pnpm exec vitest run --config vitest.workspace.ts apps/admin/src/components/admin-preview-pages.test.tsx`

## Verification Gate

Before claiming this batch done:

- run the two targeted test commands above
- run `pnpm test`
- run `pnpm build`

