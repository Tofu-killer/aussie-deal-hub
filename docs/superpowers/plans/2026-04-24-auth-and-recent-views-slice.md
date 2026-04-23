# Auth and Recent Views Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the missing public account-entry pages from the v1 spec: login / verification flow and a recent views page.

**Architecture:** Keep the slice web-focused and locally runnable. Reuse the existing auth API for request-code and verify-code actions, and implement recent views as a lightweight browser cookie tracked from the deal detail page and read back on a server-rendered recent-views route.

**Tech Stack:** TypeScript, Next.js App Router, React, Vitest, React Testing Library

---

## File Structure

### Auth Flow

- Create: `apps/web/src/app/[locale]/login/page.tsx`
- Create: `apps/web/src/lib/auth.ts`
- Modify: `apps/web/src/lib/serverApi.ts`
- Create: `apps/web/src/components/login-page.test.tsx`

Responsibilities:

- render bilingual login and verification forms
- call the existing `/v1/auth/request-code` and `/v1/auth/verify-code` endpoints
- redirect successful verification into the existing session-token-based web flow

### Recent Views

- Create: `apps/web/src/app/[locale]/recent-views/page.tsx`
- Create: `apps/web/src/lib/recentViews.ts`
- Create: `apps/web/src/components/RecentViewTracker.tsx`
- Modify: `apps/web/src/app/[locale]/deals/[slug]/page.tsx`
- Create: `apps/web/src/components/recent-views-page.test.tsx`

Responsibilities:

- track viewed deal slugs in a lightweight cookie
- render a localized recent-views page from that cookie
- keep the existing deal detail page behavior intact while adding tracking

## Task 19: Login and Verification Flow

**Files:**
- Create: `apps/web/src/app/[locale]/login/page.tsx`
- Create: `apps/web/src/lib/auth.ts`
- Modify: `apps/web/src/lib/serverApi.ts`
- Test: `apps/web/src/components/login-page.test.tsx`

- [ ] Add a failing test for requesting a code, verifying a code, and rendering bilingual login copy
- [ ] Verify the test fails before implementation
- [ ] Add `requestAuthCode` and `verifyAuthCode` helpers to `serverApi.ts`
- [ ] Implement auth form helpers in `auth.ts`
- [ ] Add a localized `/[locale]/login` page with request-code and verify-code forms, success/error feedback, and redirect-to-home or favorites behavior after verification
- [ ] Run `pnpm exec vitest run --config vitest.workspace.ts apps/web/src/components/login-page.test.tsx`

## Task 20: Recent Views Tracking and Page

**Files:**
- Create: `apps/web/src/app/[locale]/recent-views/page.tsx`
- Create: `apps/web/src/lib/recentViews.ts`
- Create: `apps/web/src/components/RecentViewTracker.tsx`
- Modify: `apps/web/src/app/[locale]/deals/[slug]/page.tsx`
- Test: `apps/web/src/components/recent-views-page.test.tsx`

- [ ] Add a failing test for recent-views cookie parsing, tracker updates, and the localized recent-views page
- [ ] Verify the test fails before implementation
- [ ] Implement recent-view parsing, serialization, deduplication, and mapping helpers in `recentViews.ts`
- [ ] Add a client-side tracker component that records the current deal slug in a cookie
- [ ] Mount the tracker in the deal detail page without regressing price context, related deals, or locale-switch behavior
- [ ] Add `/[locale]/recent-views` that reads the cookie with `await cookies()` and renders localized recent deals or an empty state
- [ ] Run `pnpm exec vitest run --config vitest.workspace.ts apps/web/src/components/recent-views-page.test.tsx`

## Verification Gate

Before claiming this batch done:

- run the two targeted test commands above
- run `pnpm test`
- run `pnpm build`

