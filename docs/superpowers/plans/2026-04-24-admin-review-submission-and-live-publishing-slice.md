# Admin Review Submission and Live Publishing Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the admin lead detail page submit review drafts and publish intent to the API, and make the publishing queue page read live API data instead of static fixtures.

**Architecture:** Keep the slice local and in-memory. Extend the admin leads API to store submitted review drafts and expose a derived publishing queue endpoint, then wire the admin lead detail and publishing pages to those endpoints with deterministic tests. Avoid persistence for now.

**Tech Stack:** TypeScript, Express, Next.js App Router, React, Vitest, React Testing Library

---

## File Structure

### Admin Review Submission API

- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/routes/adminLeads.ts`
- Create: `apps/api/src/routes/adminPublishing.ts`
- Modify: `apps/api/tests/adminLeads.test.ts`
- Create: `apps/api/tests/adminPublishing.test.ts`

Responsibilities:

- accept submitted review drafts for existing leads
- return stored review data from lead detail reads
- expose a publishing queue read endpoint derived from submitted reviews

### Admin Review and Publishing Pages

- Modify: `apps/admin/src/app/leads/[leadId]/page.tsx`
- Modify: `apps/admin/src/app/publishing/page.tsx`
- Modify: `apps/admin/src/components/lead-review-form.test.tsx`
- Modify: `apps/admin/src/components/publishing-page.test.tsx`

Responsibilities:

- submit review-draft payloads from the lead detail page
- surface success/error feedback for save/publish actions
- render the publishing queue from the new API endpoint

## Task 33: Admin Review Submission and Publishing Queue API

**Files:**
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/routes/adminLeads.ts`
- Create: `apps/api/src/routes/adminPublishing.ts`
- Modify: `apps/api/tests/adminLeads.test.ts`
- Create: `apps/api/tests/adminPublishing.test.ts`

- [ ] Add failing tests for submitting a review draft and reading the derived publishing queue
- [ ] Verify the tests fail before implementation
- [ ] Extend the in-memory admin lead store with submitted review data
- [ ] Return stored review data from `GET /v1/admin/leads/:leadId`
- [ ] Add a write route for submitted review drafts and a read route for the publishing queue
- [ ] Run `pnpm exec vitest run --config vitest.workspace.ts apps/api/tests/adminLeads.test.ts apps/api/tests/adminPublishing.test.ts`

## Task 34: Admin Lead Submission Page and Live Publishing Page

**Files:**
- Modify: `apps/admin/src/app/leads/[leadId]/page.tsx`
- Modify: `apps/admin/src/app/publishing/page.tsx`
- Modify: `apps/admin/src/components/lead-review-form.test.tsx`
- Modify: `apps/admin/src/components/publishing-page.test.tsx`

- [ ] Add failing tests for review submission from the lead detail page and API-backed publishing queue rendering
- [ ] Verify the tests fail before implementation
- [ ] Submit `LeadReviewForm` payloads to the new admin review write route and show success/error feedback
- [ ] Render `/publishing` from the live API queue instead of static fixtures
- [ ] Preserve the existing lead detail metadata render and review form interactions
- [ ] Run `pnpm exec vitest run --config vitest.workspace.ts apps/admin/src/components/lead-review-form.test.tsx apps/admin/src/components/publishing-page.test.tsx`

## Verification Gate

Before claiming this batch done:

- run the two targeted test commands above
- run `pnpm test`
- run `pnpm build`

