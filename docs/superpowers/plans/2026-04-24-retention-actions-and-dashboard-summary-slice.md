# Retention Actions and Dashboard Summary Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add missing user retention actions and make the admin dashboard show live summary data.

**Architecture:** Keep the slice local and deterministic. On the public side, add lightweight user actions for removing favorites and clearing recent views without introducing new persistence. On the admin side, reuse existing admin API routes to render simple live summary cards on the dashboard.

**Tech Stack:** TypeScript, Next.js App Router, React, Vitest, React Testing Library

---

## File Structure

### Public Retention Actions

- Modify: `apps/web/src/app/[locale]/favorites/page.tsx`
- Modify: `apps/web/src/app/[locale]/recent-views/page.tsx`
- Modify: `apps/web/src/components/favorites-and-price-context.test.tsx`
- Modify: `apps/web/src/components/recent-views-page.test.tsx`

Responsibilities:

- add remove-from-favorites UI
- add clear-recent-views UI
- keep current list rendering and session-token flow intact

### Admin Dashboard Summary

- Modify: `apps/admin/src/app/page.tsx`
- Create: `apps/admin/src/components/admin-dashboard-summary.test.tsx`

Responsibilities:

- fetch summary data from existing admin APIs
- render a small live dashboard summary section
- preserve current navigation links

## Task 43: Remove Favorite and Clear Recent Views

**Files:**
- Modify: `apps/web/src/app/[locale]/favorites/page.tsx`
- Modify: `apps/web/src/app/[locale]/recent-views/page.tsx`
- Test: `apps/web/src/components/favorites-and-price-context.test.tsx`
- Test: `apps/web/src/components/recent-views-page.test.tsx`

- [ ] Add failing tests for removing favorites and clearing recent views
- [ ] Verify the tests fail before implementation
- [ ] Add a minimal remove-favorite action in the favorites UI
- [ ] Add a clear-recent-views action in the recent-views UI
- [ ] Preserve current rendering and session-token passthrough
- [ ] Run `pnpm exec vitest run --config vitest.workspace.ts apps/web/src/components/favorites-and-price-context.test.tsx apps/web/src/components/recent-views-page.test.tsx`

## Task 44: Live Admin Dashboard Summary

**Files:**
- Modify: `apps/admin/src/app/page.tsx`
- Test: `apps/admin/src/components/admin-dashboard-summary.test.tsx`

- [ ] Add failing tests for dashboard summary cards driven by live API data
- [ ] Verify the tests fail before implementation
- [ ] Fetch leads, sources, and publishing queue summary data from existing admin APIs
- [ ] Render a compact live summary section while preserving existing navigation links
- [ ] Run `pnpm exec vitest run --config vitest.workspace.ts apps/admin/src/components/admin-dashboard-summary.test.tsx`

## Verification Gate

Before claiming this batch done:

- run the two targeted test commands above
- run `pnpm test`
- run `pnpm build`

