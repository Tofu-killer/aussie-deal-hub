# Deploy Workflow Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reproducible release-bundle deployment path that can ship a reviewed artifact to a remote host and immediately verify the deployed runtime.

**Architecture:** Keep the existing `release:bundle` artifact as the deployment unit. Add a repo-local `release:deploy` script plus a `workflow_dispatch` deploy workflow that downloads a reviewed bundle artifact, ships it to a remote host over SSH/SCP, boots the stack with a remote env file, and reuses `runtime:verify` for post-deploy checks. Update `docker-compose.yml` to consume runtime variables through `${VAR:-default}` fallbacks so the remote env file can actually override production settings.

**Tech Stack:** GitHub Actions, Node.js scripts, Docker Compose, SSH/SCP, Vitest contract tests.

---

### Task 1: Lock the deploy contract with failing tests

**Files:**
- Modify: `packages/config/src/deploymentArtifacts.test.ts`
- Create: `packages/config/src/releaseDeployScript.test.ts`

- [ ] Add deployment artifact assertions for a new `Deploy release bundle` workflow, a `release:deploy` package script, runtime-overrideable compose values, and README deployment guidance.
- [ ] Add script-level tests for a new `scripts/release-deploy.mjs` entrypoint covering successful remote deploy flow, missing env-file guardrails, and failure-time remote log collection.

### Task 2: Implement the deploy script and workflow

**Files:**
- Modify: `docker-compose.yml`
- Modify: `package.json`
- Modify: `scripts/release-rehearse.mjs`
- Create: `scripts/lib/release-bundle-root.mjs`
- Create: `scripts/release-deploy.mjs`
- Create: `.github/workflows/deploy-release-bundle.yml`

- [ ] Extract reusable release-bundle-root resolution so deploy and rehearse can point at either an explicit bundle directory or the newest bundle under `release/`.
- [ ] Add `release:deploy` to `package.json`.
- [ ] Update compose service configuration and host-port mappings to use `${VAR:-default}` fallbacks instead of hardcoded runtime placeholders.
- [ ] Implement remote deploy orchestration: validate required inputs, stage the reviewed bundle under a remote `releases/` directory, require a pre-existing shared env file, boot the stack with `docker compose --env-file`, dump remote compose logs on failure, and run runtime verification against the supplied public URLs.
- [ ] Add a manual `Deploy release bundle` workflow that downloads a bundle artifact from a reviewed run, writes the SSH private key, invokes `pnpm release:deploy`, and runs post-deploy runtime verification.

### Task 3: Document and verify the deploy path

**Files:**
- Modify: `README.md`

- [ ] Document the manual `pnpm release:deploy` flow, required env vars, remote host layout, and the new GitHub Actions workflow inputs/secrets.
- [ ] Run focused Vitest coverage for the new deploy contracts, then run fresh `pnpm verify`.
- [ ] Request independent code review before commit/push, then monitor GitHub Actions after pushing.
