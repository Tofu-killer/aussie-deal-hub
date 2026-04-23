# Homepage and Publishing Metadata Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the missing operational homepage sections from the v1 spec and extend the admin review flow with publishing metadata fields.

**Architecture:** Keep the slice deterministic and local-first. Extend the seeded public deal model so the homepage can render `latest deals` and `trending merchants`, while separately enriching the admin review form with structured `tags`, `featured slot`, and `publishAt` metadata without introducing persistence yet.

**Tech Stack:** TypeScript, Next.js App Router, React, Vitest, React Testing Library

---

## File Structure

### Homepage Completion

- Modify: `apps/web/src/app/[locale]/page.tsx`
- Modify: `apps/web/src/lib/publicDeals.ts`
- Modify: `apps/web/src/components/home-page.test.tsx`

Responsibilities:

- add seeded merchant metadata to public deals
- render latest-deals and trending-merchants homepage sections
- preserve current hero search, curated sections, locale switch, and session-token passthrough

### Admin Publishing Metadata

- Modify: `apps/admin/src/components/LeadReviewForm.tsx`
- Modify: `apps/admin/src/components/lead-review-form.test.tsx`
- Modify: `apps/admin/src/app/leads/[leadId]/page.tsx`

Responsibilities:

- add `tags`, `featuredSlot`, and `publishAt` inputs to the admin review form
- include those fields in the submitted payload
- keep current bilingual copy editing and publish/save actions intact

## Task 21: Homepage Latest Deals and Trending Merchants

**Files:**
- Modify: `apps/web/src/app/[locale]/page.tsx`
- Modify: `apps/web/src/lib/publicDeals.ts`
- Test: `apps/web/src/components/home-page.test.tsx`

- [ ] Add a failing test that expects homepage sections for latest deals and trending merchants
- [ ] Verify the test fails before implementation
- [ ] Extend seeded public deal data with explicit merchant metadata
- [ ] Add helper data for latest deals ordering and merchant counts
- [ ] Render localized latest-deals and trending-merchants sections on the homepage without regressing existing hero search and curated sections
- [ ] Run `pnpm exec vitest run --config vitest.workspace.ts apps/web/src/components/home-page.test.tsx`

## Task 22: Admin Review Publishing Metadata

**Files:**
- Modify: `apps/admin/src/components/LeadReviewForm.tsx`
- Modify: `apps/admin/src/components/lead-review-form.test.tsx`
- Modify: `apps/admin/src/app/leads/[leadId]/page.tsx`

- [ ] Add a failing form test that expects `tags`, `featuredSlot`, and `publishAt` to be rendered and submitted
- [ ] Verify the test fails before implementation
- [ ] Extend the draft/submission types to include those publishing metadata fields
- [ ] Add minimal admin form controls for tags, featured slot, and publish-at timestamp
- [ ] Preserve the existing bilingual content editing flow and publish/save submitter behavior
- [ ] Run `pnpm exec vitest run --config vitest.workspace.ts apps/admin/src/components/lead-review-form.test.tsx`

## Verification Gate

Before claiming this batch done:

- run the two targeted test commands above
- run `pnpm test`
- run `pnpm build`

