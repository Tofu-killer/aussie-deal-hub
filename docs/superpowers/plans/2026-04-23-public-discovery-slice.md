# Public Discovery Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the missing public discovery surfaces from the v1 spec: category listing pages, search results, and related deals on the detail page.

**Architecture:** Keep this slice web-only and locally runnable. Build one shared discovery helper layer over the current seeded public deals, then wire that layer into new search/category routes and a related-deals module on the detail page. Keep all behavior deterministic and bilingual.

**Tech Stack:** TypeScript, Next.js App Router, Vitest, React Testing Library

---

## File Structure

### Shared Web Discovery

- Create: `apps/web/src/lib/discovery.ts`
- Modify: `apps/web/src/lib/publicDeals.ts`
- Create: `apps/web/src/components/discovery-helpers.test.ts`

Responsibilities:

- define category slugs and labels
- expose search, category listing, and related-deal helpers
- keep seeded public deals as the single content source

### Search Surfaces

- Modify: `apps/web/src/app/[locale]/page.tsx`
- Create: `apps/web/src/app/[locale]/search/page.tsx`
- Create: `apps/web/src/components/search-page.test.tsx`

Responsibilities:

- add a homepage hero search entry point
- render localized search results for `q`
- preserve current locale routing and session-token passthrough

### Category and Detail Discovery

- Create: `apps/web/src/app/[locale]/categories/[category]/page.tsx`
- Modify: `apps/web/src/app/[locale]/deals/[slug]/page.tsx`
- Create: `apps/web/src/components/category-and-related-deals.test.tsx`

Responsibilities:

- render localized category listing pages
- add a small related-deals section to the detail page
- keep the current price context and locale switch behavior intact

## Task 16: Shared Discovery Helpers

**Files:**
- Create: `apps/web/src/lib/discovery.ts`
- Modify: `apps/web/src/lib/publicDeals.ts`
- Test: `apps/web/src/components/discovery-helpers.test.ts`

- [ ] Add a failing helper test that proves category grouping, search matching, and related-deal selection
- [ ] Verify the helper test fails before implementation
- [ ] Export a stable list of seeded public deals from `publicDeals.ts`
- [ ] Implement category metadata, localized category labels, search helpers, and related-deal selection in `discovery.ts`
- [ ] Run `pnpm exec vitest run --config vitest.workspace.ts apps/web/src/components/discovery-helpers.test.ts`

## Task 17: Hero Search and Search Results

**Files:**
- Modify: `apps/web/src/app/[locale]/page.tsx`
- Create: `apps/web/src/app/[locale]/search/page.tsx`
- Test: `apps/web/src/components/search-page.test.tsx`

- [ ] Add a failing test for the homepage hero search form and the localized search results page
- [ ] Verify the test fails before implementation
- [ ] Add a simple GET search form to the homepage hero area
- [ ] Render `/[locale]/search?q=...` using the shared discovery helpers, including empty-state copy
- [ ] Keep locale switch and session-token passthrough working on the homepage
- [ ] Run `pnpm exec vitest run --config vitest.workspace.ts apps/web/src/components/search-page.test.tsx`

## Task 18: Category Listing and Related Deals

**Files:**
- Create: `apps/web/src/app/[locale]/categories/[category]/page.tsx`
- Modify: `apps/web/src/app/[locale]/deals/[slug]/page.tsx`
- Test: `apps/web/src/components/category-and-related-deals.test.tsx`

- [ ] Add a failing test for category listing pages and the related-deals detail module
- [ ] Verify the test fails before implementation
- [ ] Render localized category pages for the four primary categories from the spec
- [ ] Add a small related-deals section on the detail page using the shared discovery helpers
- [ ] Preserve the existing price-context rendering and notFound behavior
- [ ] Run `pnpm exec vitest run --config vitest.workspace.ts apps/web/src/components/category-and-related-deals.test.tsx`

## Verification Gate

Before claiming this batch done:

- run the three targeted test commands above
- run `pnpm test`
- run `pnpm build`

