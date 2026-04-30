# Runtime SEO And Release Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 收紧运行时验证、真实多语言索引面和交付产物合同，消除当前上线链路里的静默回退与漂移风险。

**Architecture:** 这轮只补已经暴露出明确缺口的合同层，不扩展新产品面。先修 Vitest 根配置，让 `pnpm verify` 恢复可信；再用测试先锁住 `runtime:verify`、SEO alternates / sitemap、容器镜像 digest pin；最后把 release bundle 与 DB 测试脚本切到统一配置，确保本地、bundle 和 CI 跑的是同一套命令。

**Tech Stack:** TypeScript, Vitest, Node.js scripts, Next.js metadata, Docker / Compose, GitHub Actions

---

### Task 1: 恢复 Vitest 根配置合同

**Files:**
- Create: `vitest.config.ts`
- Modify: `vitest.workspace.ts`
- Modify: `package.json`
- Modify: `scripts/test-db.mjs`
- Test: `packages/config/src/testDbScript.test.ts`
- Test: `packages/config/src/releaseBundleScript.test.ts`

- [ ] **Step 1: 先写失败断言，锁住显式 `--config` 应该走根配置文件**

在 `packages/config/src/testDbScript.test.ts` 里把期望从 `vitest.workspace.ts` 改成 `vitest.config.ts`；在 `packages/config/src/releaseBundleScript.test.ts` 里要求 release bundle 包含新的根配置文件。

- [ ] **Step 2: 运行针对性测试，确认当前实现失败**

Run: `pnpm exec vitest run packages/config/src/testDbScript.test.ts packages/config/src/releaseBundleScript.test.ts`
Expected: FAIL，报错点要么是脚本仍引用 `vitest.workspace.ts`，要么是 bundle 清单不含 `vitest.config.ts`

- [ ] **Step 3: 写最小实现**

新增 `vitest.config.ts` 导出对象配置承载 `test.projects`；保留 `vitest.workspace.ts` 作为 workspace 数组供自动发现；把 `package.json`、`scripts/test-db.mjs`、release bundle 清单统一切到 `vitest.config.ts`。

- [ ] **Step 4: 重新运行针对性测试，确认转绿**

Run: `pnpm exec vitest run packages/config/src/testDbScript.test.ts packages/config/src/releaseBundleScript.test.ts`
Expected: PASS

### Task 2: 收紧运行时与 SEO 合同

**Files:**
- Modify: `scripts/runtime-verify.mjs`
- Modify: `packages/config/src/runtimeVerifyScript.test.ts`
- Modify: `apps/web/src/lib/publicDeals.ts`
- Modify: `apps/web/src/components/public-seo-metadata.test.ts`

- [ ] **Step 1: 先补失败测试**

保持 `runtime:verify` 缺少任一目标 URL 时必须 fail-fast；详情页 metadata 和 sitemap 只暴露真实 sibling locale。测试文件分别锁住缺失 `ADMIN_*` URL 的报错，以及 fallback locale 只保留真实 alternates / detail URLs。

- [ ] **Step 2: 运行这些测试，确认它们先红**

Run: `pnpm exec vitest run packages/config/src/runtimeVerifyScript.test.ts apps/web/src/components/public-seo-metadata.test.ts`
Expected: FAIL，失败原因与静默回退或伪双语 URL 合同一致

- [ ] **Step 3: 写最小实现**

在 `scripts/runtime-verify.mjs` 里显式校验完整目标矩阵；在 `apps/web/src/lib/publicDeals.ts` 里按真实 `localeSlugs` 推导可索引 locale，仅对这些 locale 输出 canonical / alternates / sitemap detail URLs。

- [ ] **Step 4: 重新跑测试确认转绿**

Run: `pnpm exec vitest run packages/config/src/runtimeVerifyScript.test.ts apps/web/src/components/public-seo-metadata.test.ts`
Expected: PASS

### Task 3: 锁住部署产物供应链

**Files:**
- Modify: `Dockerfile`
- Modify: `docker-compose.yml`
- Modify: `.github/workflows/verify.yml`
- Modify: `packages/config/src/deploymentArtifacts.test.ts`

- [ ] **Step 1: 先写失败断言**

在 `packages/config/src/deploymentArtifacts.test.ts` 里要求 `Dockerfile`、`docker-compose.yml`、CI postgres service 都使用 digest pin。

- [ ] **Step 2: 运行部署合同测试，确认当前实现失败**

Run: `pnpm exec vitest run packages/config/src/deploymentArtifacts.test.ts`
Expected: FAIL，提示存在浮动 tag

- [ ] **Step 3: 写最小实现**

把 `node:22-slim`、`postgres:16`、`redis:7` 替换成带 sha256 digest 的镜像引用。

- [ ] **Step 4: 重新运行部署合同测试**

Run: `pnpm exec vitest run packages/config/src/deploymentArtifacts.test.ts`
Expected: PASS

### Task 4: 做全量验证并交叉审查

**Files:**
- Modify: `docs/superpowers/plans/2026-04-30-runtime-seo-and-release-hardening.md`

- [ ] **Step 1: 跑本地回归**

Run: `pnpm exec vitest run apps/web/src/components/public-seo-metadata.test.ts packages/config/src/runtimeVerifyScript.test.ts packages/config/src/deploymentArtifacts.test.ts packages/config/src/testDbScript.test.ts packages/config/src/releaseBundleScript.test.ts`
Expected: PASS

- [ ] **Step 2: 跑全量验证**

Run: `pnpm verify`
Expected: PASS

- [ ] **Step 3: 发起双路交叉审查**

找两路独立 reviewer，只收 blocking findings；若有问题先修完再回收 review。

- [ ] **Step 4: 提交、push、监控 GitHub Actions**

Run: `git add ... && git commit -m "..." && git push origin main`
Then: 监控 `Verify` 与相关 workflow，直到成功或修到成功为止。
