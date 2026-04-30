# Release Bundle Provenance Hardening Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the manual deploy path consume only reviewed release artifacts by validating the referenced `Release bundle` run and running the deploy logic from the downloaded bundle itself.

**Architecture:** Keep the uploaded release bundle as the unit of review and deployment. Harden `Deploy release bundle` so it first verifies that `bundle_run_id` points to a successful `.github/workflows/release-bundle.yml` run, derives the exact artifact name from that run's `head_sha`, installs dependencies inside the downloaded bundle root, and executes `release:deploy` from that extracted artifact instead of the checked-out repository.

**Tech Stack:** GitHub Actions, Node.js helper scripts, Vitest contract tests, README deployment docs.

---

### Task 1: Lock provenance behavior with failing tests

**Files:**
- Modify: `packages/config/src/deploymentArtifacts.test.ts`
- Create: `packages/config/src/releaseBundleRunValidationScript.test.ts`

- [ ] Add deployment artifact assertions that the deploy workflow validates `bundle_run_id`, downloads an exact reviewed artifact name, installs dependencies inside the extracted bundle, and runs deploy from that bundle root.
- [ ] Add script-level tests for a new release-bundle-run validation helper covering successful reviewed runs, rejected non-success runs, rejected non-release-bundle workflows, and import-only behavior.

### Task 2: Implement reviewed-artifact deploy hardening

**Files:**
- Modify: `.github/workflows/deploy-release-bundle.yml`
- Create: `scripts/validate-release-bundle-run.mjs`

- [ ] Implement a Node helper that fetches GitHub Actions run metadata, validates the run provenance, and writes the exact reviewed artifact name into `GITHUB_ENV`.
- [ ] Update the deploy workflow to use that helper before artifact download, fetch the exact reviewed artifact, install dependencies inside the downloaded bundle, and run `RELEASE_DEPLOY_ROOT=. pnpm release:deploy` from the bundle root.

### Task 3: Document and verify the hardened deploy path

**Files:**
- Modify: `README.md`

- [ ] Document that the manual deploy workflow only accepts successful `Release bundle` runs and deploys using the downloaded artifact's own scripts/contracts.
- [ ] Run focused Vitest coverage for the new helper and deploy workflow contracts, then run fresh `pnpm verify`.
- [ ] Request independent code review before commit/push, then monitor GitHub Actions after pushing.
