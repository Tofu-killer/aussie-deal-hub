# Release Deploy Rollback Hardening Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `pnpm release:deploy` fail safely by restoring the previous remote release when activation or post-deploy runtime verification fails.

**Architecture:** Keep the reviewed release bundle as the deployment unit and preserve the current remote layout under `/releases`, `/shared`, and `/current`. Extend the deploy script so it snapshots the pre-deploy `current` target, captures failing compose logs, repoints `current` back to the previous release when available, restarts that restored stack, and reruns runtime verification before surfacing the original deployment failure.

**Tech Stack:** Node.js deployment scripts, SSH/SCP, Docker Compose, Vitest contract tests, GitHub Actions.

---

### Task 1: Lock rollback behavior with failing tests

**Files:**
- Modify: `packages/config/src/releaseDeployScript.test.ts`
- Modify: `packages/config/src/deploymentArtifacts.test.ts`

- [ ] Add a script-level test that proves runtime verification failure triggers remote compose log capture, rollback to the previous `current` release, and a second runtime verification pass against the restored stack.
- [ ] Tighten the deployment artifact contract so the README explicitly documents automatic rollback semantics.

### Task 2: Implement rollback-safe deploy behavior

**Files:**
- Modify: `scripts/release-deploy.mjs`

- [ ] Resolve the remote `current` symlink before activation so the script knows which release can be restored.
- [ ] On activation or runtime verification failure, capture remote compose logs for the failing `current` stack.
- [ ] If a previous release exists, repoint `current` back to it, restart that stack, rerun runtime verification, and still exit non-zero with the original deployment failure surfaced.

### Task 3: Document and verify the hardened deploy path

**Files:**
- Modify: `README.md`

- [ ] Document automatic rollback behavior in the deploy section so operators know what the script does on failed activation.
- [ ] Run focused Vitest coverage for deploy contracts, then run fresh `pnpm verify`.
- [ ] Request independent code review before commit/push, then monitor GitHub Actions after pushing.
