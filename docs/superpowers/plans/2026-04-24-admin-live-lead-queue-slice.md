# Admin Live Lead Queue Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current static admin lead shells with API-backed lead queue and lead detail reads.

**Architecture:** Keep the slice local and in-memory. Extend the existing admin leads API with `GET` routes for list/detail, then wire the admin pages to those routes using simple fetch-based server components. Reuse the deterministic AI review helper for the lead detail preview path.

**Tech Stack:** TypeScript, Express, Next.js App Router, React, Vitest, React Testing Library

---

## File Structure

### Admin Lead Read API

- Modify: `apps/api/src/routes/adminLeads.ts`
- Modify: `apps/api/tests/adminLeads.test.ts`

Responsibilities:

- add `GET /v1/admin/leads`
- add `GET /v1/admin/leads/:leadId`
- keep existing create/review routes intact

### Admin Lead Pages

- Modify: `apps/admin/src/app/leads/page.tsx`
- Modify: `apps/admin/src/app/leads/[leadId]/page.tsx`
- Modify: `apps/admin/src/components/lead-review-form.test.tsx`

Responsibilities:

- render the lead queue from the API instead of a static placeholder
- render lead detail metadata from the API instead of a static lead shell
- preserve the existing review form behavior

## Task 31: Admin Lead Read API

**Files:**
- Modify: `apps/api/src/routes/adminLeads.ts`
- Test: `apps/api/tests/adminLeads.test.ts`

- [ ] Add failing tests for `GET /v1/admin/leads` and `GET /v1/admin/leads/:leadId`
- [ ] Verify the tests fail before implementation
- [ ] Implement list/detail read routes while preserving existing create/review behavior
- [ ] Run `pnpm exec vitest run --config vitest.workspace.ts apps/api/tests/adminLeads.test.ts`

## Task 32: Admin Lead Queue and Detail Pages

**Files:**
- Modify: `apps/admin/src/app/leads/page.tsx`
- Modify: `apps/admin/src/app/leads/[leadId]/page.tsx`
- Test: `apps/admin/src/components/lead-review-form.test.tsx`

- [ ] Add failing admin-page tests for API-backed lead queue and lead detail rendering
- [ ] Verify the tests fail before implementation
- [ ] Fetch and render lead queue rows from `/v1/admin/leads`
- [ ] Fetch and render lead detail metadata from `/v1/admin/leads/:leadId`
- [ ] Keep the existing review form and publish/save behavior intact
- [ ] Run `pnpm exec vitest run --config vitest.workspace.ts apps/admin/src/components/lead-review-form.test.tsx`

## Verification Gate

Before claiming this batch done:

- run the two targeted test commands above
- run `pnpm test`
- run `pnpm build`

