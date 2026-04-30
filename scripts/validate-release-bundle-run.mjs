import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const RELEASE_BUNDLE_WORKFLOW_PATH = ".github/workflows/release-bundle.yml";
const GITHUB_API_VERSION = "2022-11-28";

function normalizeEnvValue(rawValue) {
  const trimmedValue = rawValue?.trim();

  return trimmedValue ? trimmedValue : undefined;
}

function validateEnv(env = process.env) {
  const bundleRunId = normalizeEnvValue(env.BUNDLE_RUN_ID);
  const githubRepository = normalizeEnvValue(env.GITHUB_REPOSITORY);
  const githubToken = normalizeEnvValue(env.GITHUB_TOKEN);

  if (!bundleRunId) {
    throw new Error("validate-release-bundle-run requires BUNDLE_RUN_ID");
  }

  if (!/^[1-9]\d*$/u.test(bundleRunId)) {
    throw new Error(`validate-release-bundle-run requires BUNDLE_RUN_ID to be a positive integer, got ${bundleRunId}`);
  }

  if (!githubRepository) {
    throw new Error("validate-release-bundle-run requires GITHUB_REPOSITORY");
  }

  if (!githubToken) {
    throw new Error("validate-release-bundle-run requires GITHUB_TOKEN");
  }

  return {
    bundleRunId,
    githubEnvPath: normalizeEnvValue(env.GITHUB_ENV),
    githubRepository,
    githubToken,
  };
}

function validateWorkflowRun(bundleRunId, workflowRun) {
  const workflowPath = normalizeEnvValue(workflowRun?.path);

  if (!workflowPath?.startsWith(`${RELEASE_BUNDLE_WORKFLOW_PATH}@`)) {
    throw new Error(`bundle_run_id ${bundleRunId} must reference ${RELEASE_BUNDLE_WORKFLOW_PATH}`);
  }

  const status = normalizeEnvValue(workflowRun?.status);
  const conclusion = normalizeEnvValue(workflowRun?.conclusion);

  if (status !== "completed" || conclusion !== "success") {
    throw new Error(
      `bundle_run_id ${bundleRunId} must reference a successful completed Release bundle run; got status=${status ?? "unknown"} conclusion=${conclusion ?? "unknown"}`,
    );
  }

  const headSha = normalizeEnvValue(workflowRun?.head_sha);

  if (!headSha) {
    throw new Error(`bundle_run_id ${bundleRunId} did not expose a head_sha`);
  }

  return {
    artifactName: `aussie-deal-hub-release-bundle-${headSha}`,
    headSha,
  };
}

function writeGithubEnv(githubEnvPath, key, value) {
  if (!githubEnvPath) {
    return;
  }

  appendFileSync(githubEnvPath, `${key}=${value}\n`);
}

export async function runValidateReleaseBundleRunScript(
  env = process.env,
  dependencies = {},
) {
  const { fetchImpl = globalThis.fetch } = dependencies;

  if (typeof fetchImpl !== "function") {
    throw new Error("validate-release-bundle-run requires a fetch implementation");
  }

  const { bundleRunId, githubEnvPath, githubRepository, githubToken } = validateEnv(env);
  const response = await fetchImpl(
    `https://api.github.com/repos/${githubRepository}/actions/runs/${bundleRunId}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${githubToken}`,
        "User-Agent": "aussie-deal-hub-release-bundle-validator",
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Could not fetch GitHub Actions run ${bundleRunId} from ${githubRepository}: ${response.status} ${response.statusText}`,
    );
  }

  const workflowRun = await response.json();
  const resolvedRun = validateWorkflowRun(bundleRunId, workflowRun);

  writeGithubEnv(githubEnvPath, "REVIEWED_BUNDLE_ARTIFACT_NAME", resolvedRun.artifactName);
  writeGithubEnv(githubEnvPath, "REVIEWED_BUNDLE_HEAD_SHA", resolvedRun.headSha);

  console.log(
    `Validated reviewed release bundle run ${bundleRunId} for ${resolvedRun.headSha}`,
  );

  return resolvedRun;
}

const isEntrypoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  runValidateReleaseBundleRunScript().catch((error) => {
    console.error("Release bundle run validation failed:", error);
    process.exitCode = 1;
  });
}
