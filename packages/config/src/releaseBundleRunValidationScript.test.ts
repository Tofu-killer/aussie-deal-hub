import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

const repoRoot = path.join(import.meta.dirname, "../../..");
const scriptPath = path.join(repoRoot, "scripts/validate-release-bundle-run.mjs");
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((tempDir) => rm(tempDir, { recursive: true, force: true })));
});

function runValidateReleaseBundleRunScript(env: Record<string, string>) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...env,
    },
    encoding: "utf8",
  });
}

async function createTempDir() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "adh-release-run-"));
  tempDirs.push(tempDir);

  return tempDir;
}

describe("release bundle run validation script", () => {
  it("does not execute validation when imported as a module", async () => {
    const originalExitCode = process.exitCode;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    process.exitCode = undefined;

    try {
      const scriptModule = (await import(`${pathToFileURL(scriptPath).href}?import-only`)) as {
        runValidateReleaseBundleRunScript?: (
          env?: Record<string, string | undefined>,
          dependencies?: {
            fetchImpl?: typeof fetch;
          },
        ) => Promise<{
          artifactName: string;
          headSha: string;
        }>;
      };

      expect(typeof scriptModule.runValidateReleaseBundleRunScript).toBe("function");
      expect(consoleError).not.toHaveBeenCalled();
      expect(process.exitCode).toBeUndefined();
    } finally {
      consoleError.mockRestore();
      process.exitCode = originalExitCode;
    }
  });

  it("writes the exact reviewed artifact name for a successful release-bundle run", async () => {
    const tempDir = await createTempDir();
    const githubEnvPath = path.join(tempDir, "github-env");
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      expect(String(input)).toBe("https://api.github.com/repos/example/aussie-deal-hub/actions/runs/12345");
      expect(init?.headers).toMatchObject({
        Accept: "application/vnd.github+json",
        Authorization: "Bearer test-token",
        "X-GitHub-Api-Version": "2022-11-28",
      });

      return new Response(
        JSON.stringify({
          conclusion: "success",
          head_sha: "abcdef1234567890",
          path: ".github/workflows/release-bundle.yml@refs/heads/main",
          status: "completed",
        }),
        {
          status: 200,
          statusText: "OK",
          headers: {
            "content-type": "application/json",
          },
        },
      );
    });
    const scriptModule = (await import(`${pathToFileURL(scriptPath).href}?success-test`)) as {
      runValidateReleaseBundleRunScript?: (
        env?: Record<string, string | undefined>,
        dependencies?: {
          fetchImpl?: typeof fetch;
        },
      ) => Promise<{
        artifactName: string;
        headSha: string;
      }>;
    };

    await expect(
      scriptModule.runValidateReleaseBundleRunScript?.(
        {
          BUNDLE_RUN_ID: "12345",
          GITHUB_ENV: githubEnvPath,
          GITHUB_REPOSITORY: "example/aussie-deal-hub",
          GITHUB_TOKEN: "test-token",
        },
        { fetchImpl },
      ),
    ).resolves.toEqual({
      artifactName: "aussie-deal-hub-release-bundle-abcdef1234567890",
      headSha: "abcdef1234567890",
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await expect(readFile(githubEnvPath, "utf8")).resolves.toBe(
      "REVIEWED_BUNDLE_ARTIFACT_NAME=aussie-deal-hub-release-bundle-abcdef1234567890\nREVIEWED_BUNDLE_HEAD_SHA=abcdef1234567890\n",
    );
  });

  it("rejects a run that did not finish successfully", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify({
          conclusion: "failure",
          head_sha: "abcdef1234567890",
          path: ".github/workflows/release-bundle.yml@refs/heads/main",
          status: "completed",
        }),
        {
          status: 200,
          statusText: "OK",
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );
    const scriptModule = (await import(`${pathToFileURL(scriptPath).href}?failure-test`)) as {
      runValidateReleaseBundleRunScript?: (
        env?: Record<string, string | undefined>,
        dependencies?: {
          fetchImpl?: typeof fetch;
        },
      ) => Promise<{
        artifactName: string;
        headSha: string;
      }>;
    };

    await expect(
      scriptModule.runValidateReleaseBundleRunScript?.(
        {
          BUNDLE_RUN_ID: "12345",
          GITHUB_REPOSITORY: "example/aussie-deal-hub",
          GITHUB_TOKEN: "test-token",
        },
        { fetchImpl },
      ),
    ).rejects.toThrow(
      "bundle_run_id 12345 must reference a successful completed Release bundle run; got status=completed conclusion=failure",
    );
  });

  it("rejects a run that does not belong to the release-bundle workflow", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify({
          conclusion: "success",
          head_sha: "abcdef1234567890",
          path: ".github/workflows/verify.yml@refs/heads/main",
          status: "completed",
        }),
        {
          status: 200,
          statusText: "OK",
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );
    const scriptModule = (await import(`${pathToFileURL(scriptPath).href}?wrong-workflow-test`)) as {
      runValidateReleaseBundleRunScript?: (
        env?: Record<string, string | undefined>,
        dependencies?: {
          fetchImpl?: typeof fetch;
        },
      ) => Promise<{
        artifactName: string;
        headSha: string;
      }>;
    };

    await expect(
      scriptModule.runValidateReleaseBundleRunScript?.(
        {
          BUNDLE_RUN_ID: "12345",
          GITHUB_REPOSITORY: "example/aussie-deal-hub",
          GITHUB_TOKEN: "test-token",
        },
        { fetchImpl },
      ),
    ).rejects.toThrow(
      "bundle_run_id 12345 must reference .github/workflows/release-bundle.yml",
    );
  });

  it("fails fast when the required workflow env is missing", () => {
    const result = runValidateReleaseBundleRunScript({
      GITHUB_REPOSITORY: "example/aussie-deal-hub",
      GITHUB_TOKEN: "test-token",
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain(
      "Release bundle run validation failed: Error: validate-release-bundle-run requires BUNDLE_RUN_ID",
    );
  });
});
