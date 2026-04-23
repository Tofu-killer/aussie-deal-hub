# Favorites Action and Source Toggle Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the missing public `Add to Favorites` action on the detail page and make the admin sources page able to toggle source enablement.

**Architecture:** Keep the slice local and deterministic. On the public side, submit favorites through the existing favorites API using the current session-token query pattern. On the admin side, submit source toggles through the existing sources API and reflect the updated `enabled` state in the page.

**Tech Stack:** TypeScript, Next.js App Router, React, Vitest, React Testing Library

---

## File Structure

### Public Favorites Action

- Modify: `apps/web/src/app/[locale]/deals/[slug]/page.tsx`
- Modify: `apps/web/src/components/deal-detail.test.tsx`

Responsibilities:

- add a secondary `Add to Favorites` action to the detail page
- call the existing favorites API and show minimal success/error feedback
- preserve current price context, related deals, locale switch, and recent-view behavior

### Admin Source Toggle

- Modify: `apps/admin/src/app/sources/page.tsx`
- Create: `apps/admin/src/components/source-page.test.tsx`

Responsibilities:

- add per-source enabled toggle actions
- call the existing admin sources API `PATCH`
- render success/error feedback and preserve the current source table

## Task 37: Public Add to Favorites Action

**Files:**
- Modify: `apps/web/src/app/[locale]/deals/[slug]/page.tsx`
- Test: `apps/web/src/components/deal-detail.test.tsx`

- [ ] Add failing tests for the detail-page favorites action and feedback states
- [ ] Verify the tests fail before implementation
- [ ] Add a minimal form or action that posts the current slug to `/v1/favorites`
- [ ] Keep the current session-token query flow and preserve existing detail modules
- [ ] Run `pnpm exec vitest run --config vitest.workspace.ts apps/web/src/components/deal-detail.test.tsx`

## Task 38: Admin Source Enabled Toggle

**Files:**
- Modify: `apps/admin/src/app/sources/page.tsx`
- Test: `apps/admin/src/components/source-page.test.tsx`

- [ ] Add failing tests for rendering source toggle controls and patching `enabled`
- [ ] Verify the tests fail before implementation
- [ ] Add a per-row toggle action that calls `PATCH /v1/admin/sources/:sourceId`
- [ ] Show minimal success/error feedback and updated state while preserving the existing source table
- [ ] Run `pnpm exec vitest run --config vitest.workspace.ts apps/admin/src/components/source-page.test.tsx`

## Verification Gate

Before claiming this batch done:

- run the two targeted test commands above
- run `pnpm test`
- run `pnpm build`

