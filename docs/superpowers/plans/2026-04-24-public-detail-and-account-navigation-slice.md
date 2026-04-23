# Public Detail and Account Navigation Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the public detail page closer to the v1 spec and add clearer user-area navigation across login, favorites, email preferences, and recent views.

**Architecture:** Keep the slice web-only and deterministic. Extend seeded public deal records with richer detail metadata for the detail page, while separately wiring user-area quick links across existing pages without touching API contracts.

**Tech Stack:** TypeScript, Next.js App Router, React, Vitest, React Testing Library

---

## File Structure

### Detail Conversion Modules

- Modify: `apps/web/src/lib/publicDeals.ts`
- Modify: `apps/web/src/app/[locale]/deals/[slug]/page.tsx`
- Modify: `apps/web/src/components/deal-detail.test.tsx`

Responsibilities:

- add richer seeded detail metadata
- render above-the-fold support fields and mid-page modules
- preserve price context, locale switch, related deals, and recent-view tracking

### User Area Navigation

- Modify: `apps/web/src/app/[locale]/page.tsx`
- Modify: `apps/web/src/app/[locale]/favorites/page.tsx`
- Modify: `apps/web/src/app/[locale]/email-preferences/page.tsx`
- Modify: `apps/web/src/app/[locale]/recent-views/page.tsx`
- Modify: `apps/web/src/app/[locale]/login/page.tsx`
- Create: `apps/web/src/components/account-navigation.test.tsx`

Responsibilities:

- add clear entry points between login, favorites, recent views, and email preferences
- preserve locale routing and session-token passthrough

## Task 27: Detail Conversion Modules

**Files:**
- Modify: `apps/web/src/lib/publicDeals.ts`
- Modify: `apps/web/src/app/[locale]/deals/[slug]/page.tsx`
- Test: `apps/web/src/components/deal-detail.test.tsx`

- [ ] Add failing detail-page tests for coupon, merchant, validity, why-this-is-worth-it, highlights, how-to-get-it, and terms/warnings
- [ ] Verify the test fails before implementation
- [ ] Extend seeded public deal data with deterministic detail metadata
- [ ] Render the new detail modules without regressing price context, related deals, locale switch, or recent-view tracking
- [ ] Run `pnpm exec vitest run --config vitest.workspace.ts apps/web/src/components/deal-detail.test.tsx`

## Task 28: User Area Navigation

**Files:**
- Modify: `apps/web/src/app/[locale]/page.tsx`
- Modify: `apps/web/src/app/[locale]/favorites/page.tsx`
- Modify: `apps/web/src/app/[locale]/email-preferences/page.tsx`
- Modify: `apps/web/src/app/[locale]/recent-views/page.tsx`
- Modify: `apps/web/src/app/[locale]/login/page.tsx`
- Test: `apps/web/src/components/account-navigation.test.tsx`

- [ ] Add failing tests for account-area quick links and session-token passthrough across those pages
- [ ] Verify the tests fail before implementation
- [ ] Add lightweight account navigation links or sections to the existing user-area pages
- [ ] Keep labels bilingual and preserve current page-specific behavior
- [ ] Run `pnpm exec vitest run --config vitest.workspace.ts apps/web/src/components/account-navigation.test.tsx`

## Verification Gate

Before claiming this batch done:

- run the two targeted test commands above
- run `pnpm test`
- run `pnpm build`

