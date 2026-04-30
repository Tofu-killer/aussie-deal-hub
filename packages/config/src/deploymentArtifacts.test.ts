import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(import.meta.dirname, "../../..");

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

function readComposeServiceBlock(compose: string, serviceName: string) {
  const lines = compose.split("\n");
  const serviceStart = lines.findIndex((line) => line === `  ${serviceName}:`);

  if (serviceStart === -1) {
    throw new Error(`Service ${serviceName} not found in docker-compose.yml`);
  }

  const serviceLines: string[] = [];

  for (let index = serviceStart; index < lines.length; index += 1) {
    const line = lines[index];

    if (index > serviceStart && line.startsWith("  ") && !line.startsWith("    ")) {
      break;
    }

    serviceLines.push(line);
  }

  return serviceLines.join("\n");
}

function readComposeServiceEnvironmentBlock(compose: string, serviceName: string) {
  const serviceBlock = readComposeServiceBlock(compose, serviceName);
  const lines = serviceBlock.split("\n");
  const environmentStart = lines.findIndex((line) => line === "    environment:");

  if (environmentStart === -1) {
    throw new Error(`Service ${serviceName} does not define an environment block`);
  }

  const environmentLines: string[] = [];

  for (let index = environmentStart + 1; index < lines.length; index += 1) {
    const line = lines[index];

    if (!line.startsWith("      ")) {
      break;
    }

    environmentLines.push(line);
  }

  return environmentLines.join("\n");
}

function findLineIndex(lines: string[], fragment: string) {
  const index = lines.findIndex((line) => line.includes(fragment));

  if (index === -1) {
    throw new Error(`Could not find workflow line containing: ${fragment}`);
  }

  return index;
}

describe("deployment artifacts", () => {
  it("defines a db-init service that applies checked-in migrations before api startup", () => {
    const compose = readRepoFile("docker-compose.yml");
    const migrationsDir = join(repoRoot, "packages/db/prisma/migrations");
    const migrationEntries = existsSync(migrationsDir) ? readdirSync(migrationsDir) : [];
    const packageJson = JSON.parse(readRepoFile("packages/db/package.json")) as {
      scripts?: Record<string, string>;
    };
    const dbInitBlock = readComposeServiceBlock(compose, "db-init");
    const dbInitEnvironment = readComposeServiceEnvironmentBlock(compose, "db-init");
    const migrateScript = packageJson.scripts?.["db:migrate"] ?? "";
    const migrateWrapper = readRepoFile("packages/db/src/migrate.ts");
    const seedMigrationPath = join(
      migrationsDir,
      "20260426000000_admin_catalog_topic_baselines",
      "migration.sql",
    );
    const seedMigration = existsSync(seedMigrationPath) ? readFileSync(seedMigrationPath, "utf8") : "";
    const sourceAndSnapshotMigrationPath = join(
      migrationsDir,
      "20260426010000_source_and_price_snapshot_baselines",
      "migration.sql",
    );
    const sourceAndSnapshotMigration = existsSync(sourceAndSnapshotMigrationPath)
      ? readFileSync(sourceAndSnapshotMigrationPath, "utf8")
      : "";

    expect(compose).toContain("db-init:");
    expect(dbInitBlock).toContain("target: workspace");
    expect(compose).toContain("pnpm --filter @aussie-deal-hub/db db:migrate");
    expect(compose).not.toContain("pnpm --filter @aussie-deal-hub/db db:push");
    expect(compose).not.toContain("pnpm --filter @aussie-deal-hub/db seed");
    expect(compose).toContain("service_completed_successfully");
    expect(compose).toContain(
      "pg_isready -h 127.0.0.1 -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-aussie_deals_hub}",
    );
    expect(dbInitEnvironment).toContain(
      "DATABASE_URL: ${DATABASE_URL:-postgresql://postgres:postgres@postgres:5432/aussie_deals_hub}",
    );
    expect(migrateScript).toBe("node --import tsx ./src/migrate.ts");
    expect(migrateScript).toContain("migrate.ts");
    expect(migrateWrapper).toContain("baselineMigrationName");
    expect(migrateWrapper).toContain('baselineMigrationName = "20260425000000_baseline"');
    expect(migrateWrapper).toContain('"migrate"');
    expect(migrateWrapper).toContain('"diff"');
    expect(migrateWrapper).toContain('"resolve"');
    expect(migrateWrapper).toContain('"--applied"');
    expect(migrateWrapper).toContain('"deploy"');
    expect(migrateWrapper).toContain('"--from-schema-datasource"');
    expect(migrateWrapper).toContain('"--to-schema-datamodel"');
    expect(existsSync(join(migrationsDir, "migration_lock.toml"))).toBe(true);
    expect(migrationEntries.some((entry) => entry.endsWith("_baseline"))).toBe(true);
    expect(migrationEntries).toContain("20260426000000_admin_catalog_topic_baselines");
    expect(migrationEntries).toContain("20260426010000_source_and_price_snapshot_baselines");
    expect(seedMigration).toContain('INSERT INTO "MerchantCatalog"');
    expect(seedMigration).toContain('INSERT INTO "TagCatalog"');
    expect(seedMigration).toContain('INSERT INTO "TopicCatalog"');
    expect(seedMigration).toContain("ON CONFLICT DO NOTHING");
    expect(sourceAndSnapshotMigration).toContain('INSERT INTO "Source"');
    expect(sourceAndSnapshotMigration).toContain('ON CONFLICT ("baseUrl") DO NOTHING');
    expect(sourceAndSnapshotMigration).toContain('INSERT INTO "PriceSnapshot"');
    expect(sourceAndSnapshotMigration).toContain('WHERE NOT EXISTS');
  });

  it("provides smtp delivery placeholders for production api and worker containers", () => {
    const compose = readRepoFile("docker-compose.yml");
    const apiEnvironment = readComposeServiceEnvironmentBlock(compose, "api");
    const workerEnvironment = readComposeServiceEnvironmentBlock(compose, "worker");

    expect(apiEnvironment).toContain("EMAIL_FROM: ${EMAIL_FROM:-deals@example.com}");
    expect(apiEnvironment).toContain("SMTP_HOST: ${SMTP_HOST:-smtp-placeholder}");
    expect(apiEnvironment).toContain("SMTP_PORT: ${SMTP_PORT:-1025}");
    expect(apiEnvironment).toContain("SMTP_SECURE: ${SMTP_SECURE:-0}");
    expect(workerEnvironment).toContain("SMTP_HOST: ${SMTP_HOST:-smtp-placeholder}");
    expect(workerEnvironment).toContain("SMTP_PORT: ${SMTP_PORT:-1025}");
    expect(workerEnvironment).toContain("SMTP_SECURE: ${SMTP_SECURE:-0}");
    expect(workerEnvironment).toContain("EMAIL_FROM: ${EMAIL_FROM:-deals@example.com}");
  });

  it("documents smtp runtime variables in the production example env file", () => {
    const exampleEnv = readRepoFile(".env.example");

    expect(exampleEnv).toContain("EMAIL_FROM=deals@example.com");
    expect(exampleEnv).toContain("SMTP_HOST=smtp.example.com");
    expect(exampleEnv).toContain("SMTP_PORT=587");
    expect(exampleEnv).toContain("SMTP_SECURE=0");
    expect(exampleEnv).toContain("SMTP_USER=");
    expect(exampleEnv).toContain("SMTP_PASS=");
  });

  it("documents smtp runtime variables in the production env reference", () => {
    const readme = readRepoFile("README.md");

    expect(readme).toContain("| `EMAIL_FROM` | api, worker | yes | Sender address for outbound mail flows. |");
    expect(readme).toContain("| `SMTP_HOST` | api, worker | yes in production | SMTP server hostname. |");
    expect(readme).toContain("| `SMTP_PORT` | api, worker | yes in production | SMTP server port. |");
    expect(readme).toContain(
      "| `SMTP_SECURE` | api, worker | optional | Set to `1`/`true` for implicit TLS; defaults to `0`. |",
    );
    expect(readme).toContain(
      "| `SMTP_USER` | api, worker | optional | SMTP auth username; must be paired with `SMTP_PASS`. |",
    );
    expect(readme).toContain(
      "| `SMTP_PASS` | api, worker | optional | SMTP auth password; must be paired with `SMTP_USER`. |",
    );
    expect(readme).toContain("The compose stack keeps `SMTP_*` on local placeholders for smoke verification only.");
  });

  it("keeps the postgres container bootstrap compatible with POSTGRES_DB initialization", () => {
    const compose = readRepoFile("docker-compose.yml");
    const postgresBlock = readComposeServiceBlock(compose, "postgres");

    expect(postgresBlock).toContain("POSTGRES_DB: ${POSTGRES_DB:-aussie_deals_hub}");
    expect(postgresBlock).not.toContain("unix_socket_directories=");
  });

  it("keeps dedicated runtime targets in the Dockerfile for api, web, admin, and worker", () => {
    const dockerfile = readRepoFile("Dockerfile");

    expect(dockerfile).toContain("FROM node:22-slim@sha256:");
    expect(dockerfile).toContain("FROM workspace AS api");
    expect(dockerfile).toContain("FROM workspace AS web");
    expect(dockerfile).toContain("FROM workspace AS admin");
    expect(dockerfile).toContain("FROM workspace AS worker");
    expect(dockerfile).toContain("apt-get install -y --no-install-recommends openssl");
    expect(dockerfile).toContain("pnpm --filter @aussie-deal-hub/db prisma:generate");
    expect(dockerfile).toContain("apps/api/src/index.ts");
    expect(dockerfile).toContain("apps/worker/src/index.ts");
    expect(dockerfile).toContain("pnpm --filter @aussie-deal-hub/admin build");
    expect(dockerfile).toContain("pnpm --filter @aussie-deal-hub/web build");
    expect(dockerfile).toContain("require.resolve('prisma/build/index.js'");
    expect(dockerfile).toContain("validate --schema packages/db/prisma/schema.prisma");
  });

  it("pins mutable docker images to digests across compose and CI service definitions", () => {
    const compose = readRepoFile("docker-compose.yml");
    const workflow = readRepoFile(".github/workflows/verify.yml");

    expect(compose).toContain("image: postgres:16@sha256:");
    expect(compose).toContain("image: redis:7@sha256:");
    expect(workflow).toContain("image: postgres:16@sha256:");
  });

  it("verifies container artifacts in CI before merge", () => {
    const workflow = readRepoFile(".github/workflows/verify.yml");

    expect(workflow).toContain("docker build . --target api");
    expect(workflow).toContain("docker build . --target web");
    expect(workflow).toContain("docker build . --target admin");
    expect(workflow).toContain("docker build . --target worker");
    expect(workflow).toContain("docker compose config");
    expect(workflow).toContain("docker compose up -d --build");
    expect(workflow).toContain("pnpm smoke:container-health");
    expect(workflow).toContain("Dump container logs on failure");
    expect(workflow).toContain("docker compose logs postgres redis db-init api web admin worker");
    expect(workflow).toContain("pnpm smoke:readiness");
    expect(workflow).toContain("docker compose down -v");
  });

  it("exposes a readiness smoke script at the repo root", () => {
    const packageJson = readRepoFile("package.json");
    const smokeScript = readRepoFile("scripts/smoke-readiness.mjs");
    const workerHealthScript = readRepoFile("scripts/check-worker-health.mjs");
    const workerBlock = readComposeServiceBlock(readRepoFile("docker-compose.yml"), "worker");

    expect(packageJson).toContain("\"smoke:readiness\": \"node scripts/smoke-readiness.mjs\"");
    expect(smokeScript).toContain("/v1/ready");
    expect(smokeScript).toContain("/health");
    expect(smokeScript).toContain("/ready");
    expect(smokeScript).toContain("/v1/admin/runtime/worker");
    expect(workerHealthScript).toContain("WORKER_STATE_PATH");
    expect(workerHealthScript).toContain("workerRuntimeHealth");
    expect(workerBlock).toContain("node scripts/check-worker-health.mjs");
  });

  it("exposes a route smoke script at the repo root", () => {
    const packageJson = readRepoFile("package.json");
    const smokeScript = readRepoFile("scripts/smoke-routes.mjs");
    const workflow = readRepoFile(".github/workflows/verify.yml");

    expect(packageJson).toContain("\"smoke:routes\": \"node scripts/smoke-routes.mjs\"");
    expect(smokeScript).toContain("/en");
    expect(smokeScript).toContain("/en/search?q=switch");
    expect(smokeScript).toContain("http://127.0.0.1:3002/");
    expect(smokeScript).toContain("requiredText");
    expect(smokeScript).toContain("Latest deals");
    expect(smokeScript).toContain("Trending merchants");
    expect(smokeScript).toContain("Open Favorites");
    expect(smokeScript).toContain("Search results");
    expect(smokeScript).toContain("Search deals");
    expect(smokeScript).toContain("Admin review dashboard");
    expect(smokeScript).toContain("Workflow shortcuts");
    expect(workflow).toContain("pnpm smoke:routes");
  });

  it("exposes a container health smoke script at the repo root", () => {
    const packageJson = readRepoFile("package.json");
    const workflow = readRepoFile(".github/workflows/verify.yml");
    const script = readRepoFile("scripts/check-compose-health.mjs");
    const apiBlock = readComposeServiceBlock(readRepoFile("docker-compose.yml"), "api");
    const webBlock = readComposeServiceBlock(readRepoFile("docker-compose.yml"), "web");
    const adminBlock = readComposeServiceBlock(readRepoFile("docker-compose.yml"), "admin");
    const workerBlock = readComposeServiceBlock(readRepoFile("docker-compose.yml"), "worker");

    expect(packageJson).toContain("\"smoke:container-health\": \"node scripts/check-compose-health.mjs\"");
    expect(workflow).toContain("pnpm smoke:container-health");
    expect(script).toContain('return ["api", "web", "admin", "worker"]');
    expect(script).toContain('"docker", ["compose", "ps", "--format", "json"]');
    expect(apiBlock).toContain("healthcheck:");
    expect(webBlock).toContain("healthcheck:");
    expect(adminBlock).toContain("healthcheck:");
    expect(workerBlock).toContain("healthcheck:");
  });

  it("exposes db-backed test entrypoints for local and CI verification", () => {
    const packageJson = readRepoFile("package.json");
    const workflow = readRepoFile(".github/workflows/verify.yml");
    const readme = readRepoFile("README.md");
    const testDbScript = readRepoFile("scripts/test-db.mjs");
    const dbBootstrapMigrationBlock = [
      "Apply the checked-in Prisma migrations:",
      "",
      "```bash",
      "export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub",
      "pnpm --filter @aussie-deal-hub/db db:migrate",
      "```",
    ].join("\n");
    const dbBootstrapTestBlock = [
      "Then run the DB-backed persistence suite:",
      "",
      "```bash",
      "export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub",
      "pnpm test:db",
      "```",
    ].join("\n");

    expect(packageJson).toContain("\"test:db\": \"node scripts/test-db.mjs\"");
    expect(workflow).toContain("Create shadow database for migration drift check");
    expect(workflow).toContain("Check migration drift against schema");
    expect(workflow).toContain("CREATE DATABASE aussie_deals_hub_shadow");
    expect(workflow).toContain("Create legacy verification database");
    expect(workflow).toContain("Verify legacy db:push upgrade path");
    expect(workflow).toContain("CREATE DATABASE aussie_deals_hub_legacy_verify");
    expect(workflow).toContain("pnpm --filter @aussie-deal-hub/db db:push");
    expect(workflow).toContain("--from-migrations prisma/migrations");
    expect(workflow).toContain("--to-schema-datamodel prisma/schema.prisma");
    expect(workflow).toContain("--shadow-database-url \"$SHADOW_DATABASE_URL\"");
    expect(workflow).toContain('SELECT COUNT(*) FROM "MerchantCatalog"');
    expect(workflow).toContain('SELECT COUNT(*) FROM "TagCatalog"');
    expect(workflow).toContain('SELECT COUNT(*) FROM "TopicCatalog"');
    expect(workflow).toContain("Prepare database for DB-backed tests");
    expect(workflow).toContain("pnpm test:db");
    expect(workflow).toContain("pnpm --filter @aussie-deal-hub/db db:migrate");
    expect(workflow).not.toContain("pnpm --filter @aussie-deal-hub/db seed");
    expect(workflow).toContain("5433:5432");
    expect(workflow).toContain("127.0.0.1:5433");
    expect(workflow).toContain("services:");
    expect(workflow).toContain("postgres:");
    expect(readme).toContain("pnpm test:db");
    expect(readme).toContain("docker compose up -d postgres redis");
    expect(readme).toContain("export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub");
    expect(readme).toContain("SHADOW_DATABASE_URL");
    expect(readme).toContain("CREATE DATABASE aussie_deals_hub_shadow");
    expect(readme).toContain("docker compose up -d postgres redis");
    expect(readme).toContain("pnpm --filter @aussie-deal-hub/db db:migrate");
    expect(readme).toContain(dbBootstrapMigrationBlock);
    expect(readme).toContain(dbBootstrapTestBlock);
    expect(readme).toContain("still matches the checked-in Prisma schema");
    expect(readme).toContain("alongside those existing rows");
    expect(readme).toContain("Workspace verification contract");
    expect(readme).toContain("Container boot contract");
    expect(readme).not.toContain("GitHub Actions runs that workspace verification contract");
    expect(readme).not.toContain("prisma migrate resolve --applied 20260425000000_baseline");
    expect(readme).not.toContain("pnpm --filter @aussie-deal-hub/db db:push");
    expect(readme).not.toContain("pnpm --filter @aussie-deal-hub/db seed");
    expect(testDbScript).toContain("RUN_DB_TESTS: \"1\"");
    expect(testDbScript).toContain("\"vitest\"");
  });

  it("documents a runtime backup entrypoint and ignores generated dump artifacts", () => {
    const packageJson = readRepoFile("package.json");
    const readme = readRepoFile("README.md");
    const gitignore = readRepoFile(".gitignore");
    const runtimeBackupBlock = [
      "export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub",
      "pnpm runtime:backup",
    ].join("\n");

    expect(packageJson).toContain("\"runtime:backup\": \"node scripts/runtime-backup.mjs\"");
    expect(readme).toContain("## Runtime backup");
    expect(readme).toContain(runtimeBackupBlock);
    expect(readme).toContain("pg_dump");
    expect(readme).toContain("backups/");
    expect(readme).toContain("BACKUP_DIR");
    expect(readme).toContain("BACKUP_PREFIX");
    expect(readme).toContain("without placing credentials on the `pg_dump` command line");
    expect(readme).toContain("custom-format dump");
    expect(gitignore).toContain("backups");
  });

  it("documents a guarded runtime restore entrypoint", () => {
    const packageJson = readRepoFile("package.json");
    const readme = readRepoFile("README.md");
    const runtimeRestoreBlock = [
      "export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub",
      "BACKUP_FILE=backups/aussie-deal-hub-20260429T101112Z.dump RESTORE_CONFIRM=restore pnpm runtime:restore",
    ].join("\n");

    expect(packageJson).toContain("\"runtime:restore\": \"node scripts/runtime-restore.mjs\"");
    expect(readme).toContain("## Runtime restore");
    expect(readme).toContain(runtimeRestoreBlock);
    expect(readme).toContain("pg_restore");
    expect(readme).toContain("RESTORE_CONFIRM=restore");
    expect(readme).toContain("destructive");
    expect(readme).toContain("custom-format dump");
    expect(readme).toContain("Create a fresh runtime backup with `pnpm runtime:backup` before restoring.");
    expect(readme).toContain("Stop the api, web, admin, and worker processes before running restore.");
    expect(readme).toContain("without placing credentials on the `pg_restore` command line");
  });

  it("provides a release bundle workflow and local bundle entrypoint", () => {
    const packageJson = readRepoFile("package.json");
    const readme = readRepoFile("README.md");
    const gitignore = readRepoFile(".gitignore");
    const workflow = readRepoFile(".github/workflows/release-bundle.yml");
    const releaseBundleBlock = ["pnpm release:bundle", "pnpm release:rehearse"].join("\n");

    expect(packageJson).toContain("\"release:bundle\": \"node scripts/release-bundle.mjs\"");
    expect(packageJson).toContain("\"release:rehearse\": \"node scripts/release-rehearse.mjs\"");
    expect(readme).toContain("## Release bundle");
    expect(readme).toContain(releaseBundleBlock);
    expect(readme).toContain("workflow_dispatch");
    expect(readme).toContain("release-manifest.json");
    expect(readme).toContain("curated deployment bundle");
    expect(readme).toContain("actions/upload-artifact");
    expect(readme).toContain("downloads the uploaded artifact into a clean directory");
    expect(readme).toContain("reinstalls workspace dependencies there");
    expect(readme).toContain("docker compose up -d --build");
    expect(readme).toContain("smoke:container-health");
    expect(readme).toContain("smoke:readiness");
    expect(readme).toContain("smoke:routes");
    expect(gitignore).toContain("release");
    expect(workflow).toContain("name: Release bundle");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("pnpm verify");
    expect(workflow).toContain("pnpm release:bundle");
    expect(workflow).toContain(
      "uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2",
    );
    expect(workflow).toContain("include-hidden-files: true");
    expect(workflow).toContain(
      "uses: actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8.0.1",
    );
    expect(workflow).toContain("if-no-files-found: error");
    expect(workflow).toContain("path: release/");
    expect(workflow).toContain("permissions:\n  contents: read\n  actions: read");
    expect(workflow).toContain("pnpm release:rehearse");
  });

  it("provides a deploy workflow and local deploy entrypoint for reviewed release bundles", () => {
    const packageJson = readRepoFile("package.json");
    const readme = readRepoFile("README.md");
    const workflow = readRepoFile(".github/workflows/deploy-release-bundle.yml");
    const deployBlock = [
      "RELEASE_DEPLOY_ROOT=release/aussie-deal-hub-release-20260430T120000Z-abcdef123456 \\",
      "DEPLOY_HOST=deploy.example.com \\",
      "DEPLOY_USER=deploy \\",
      "DEPLOY_PATH=/srv/aussie-deal-hub \\",
      "DEPLOY_SSH_KEY_PATH=$HOME/.ssh/aussie-deal-hub \\",
      "DEPLOY_RUNTIME_API_BASE_URL=https://api.example.com \\",
      "DEPLOY_RUNTIME_WEB_BASE_URL=https://www.example.com \\",
      "DEPLOY_RUNTIME_ADMIN_BASE_URL=https://admin.example.com \\",
      "pnpm release:deploy",
    ].join("\n");

    expect(packageJson).toContain("\"release:deploy\": \"node scripts/release-deploy.mjs\"");
    expect(readme).toContain("## Deploy release bundle");
    expect(readme).toContain(deployBlock);
    expect(readme).toContain("/srv/aussie-deal-hub/releases");
    expect(readme).toContain("/srv/aussie-deal-hub/shared/.env.production");
    expect(readme).toContain("/srv/aussie-deal-hub/current");
    expect(readme).toContain("captures remote compose logs for the failing stack");
    expect(readme).toContain("repoints `/srv/aussie-deal-hub/current` back to the previous release");
    expect(readme).toContain("reruns `pnpm runtime:verify`");
    expect(readme).toContain("surfaces both the original deployment failure and the rollback failure");
    expect(readme).toContain("The `Deploy release bundle` GitHub Actions workflow");
    expect(readme).toContain(
      "first validates that the supplied run id belongs to a successful `Release bundle` workflow run",
    );
    expect(readme).toContain("downloads that exact reviewed release bundle artifact");
    expect(readme).toContain("installs dependencies inside that extracted bundle");
    expect(readme).toContain(
      "runs `RELEASE_DEPLOY_ROOT=. pnpm release:deploy` from the downloaded bundle root",
    );
    expect(readme).toContain("DEPLOY_ENV_FILE");
    expect(readme).toContain("DEPLOY_SSH_PORT");
    expect(workflow).toContain("name: Deploy release bundle");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("bundle_run_id:");
    expect(workflow).toContain("runtime_api_base_url:");
    expect(workflow).toContain("runtime_web_base_url:");
    expect(workflow).toContain("runtime_admin_base_url:");
    expect(workflow).toContain("runtime_locale:");
    expect(workflow).toContain("deploy_ssh_port:");
    expect(workflow).toContain("deploy_env_file:");
    expect(workflow).toContain("permissions:\n  contents: read");
    expect(workflow).toContain("name: Validate reviewed release bundle run");
    expect(workflow).toContain("GITHUB_TOKEN: ${{ github.token }}");
    expect(workflow).toContain("BUNDLE_RUN_ID: ${{ inputs.bundle_run_id }}");
    expect(workflow).toContain("node scripts/validate-release-bundle-run.mjs");
    expect(workflow).toContain(
      "uses: actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8.0.1",
    );
    expect(workflow).toContain("run-id: ${{ inputs.bundle_run_id }}");
    expect(workflow).toContain("name: ${{ env.REVIEWED_BUNDLE_ARTIFACT_NAME }}");
    expect(workflow).toContain("path: release-artifact");
    expect(workflow).toContain("name: Resolve release bundle root");
    expect(workflow).toContain('bundle_root="release-artifact"');
    expect(workflow).toContain('if [ ! -f "${bundle_root}/release-manifest.json" ]; then');
    expect(workflow).toContain(
      "find release-artifact -mindepth 1 -maxdepth 1 -type d -exec test -f '{}/release-manifest.json' ';' -print",
    );
    expect(workflow).toContain('echo "RELEASE_BUNDLE_ROOT=${bundle_root}" >> "${GITHUB_ENV}"');
    expect(workflow).toContain("name: Install reviewed bundle dependencies");
    expect(workflow).toContain("working-directory: ${{ env.RELEASE_BUNDLE_ROOT }}");
    expect(workflow).toContain("pnpm install --frozen-lockfile");
    expect(workflow).toContain("name: Write deploy SSH key");
    expect(workflow).toContain("DEPLOY_HOST: ${{ secrets.DEPLOY_HOST }}");
    expect(workflow).toContain("DEPLOY_USER: ${{ secrets.DEPLOY_USER }}");
    expect(workflow).toContain("DEPLOY_PATH: ${{ secrets.DEPLOY_PATH }}");
    expect(workflow).toContain("DEPLOY_SSH_PRIVATE_KEY: ${{ secrets.DEPLOY_SSH_PRIVATE_KEY }}");
    expect(workflow).toContain("DEPLOY_RUNTIME_API_BASE_URL: ${{ inputs.runtime_api_base_url }}");
    expect(workflow).toContain("DEPLOY_RUNTIME_WEB_BASE_URL: ${{ inputs.runtime_web_base_url }}");
    expect(workflow).toContain("DEPLOY_RUNTIME_ADMIN_BASE_URL: ${{ inputs.runtime_admin_base_url }}");
    expect(workflow).toContain("DEPLOY_RUNTIME_LOCALE: ${{ inputs.runtime_locale }}");
    expect(workflow).toContain("RELEASE_DEPLOY_ROOT: .");
    expect(workflow).toContain("run: pnpm release:deploy");
  });

  it("rehearses the uploaded release bundle from a clean artifact directory", () => {
    const workflow = readRepoFile(".github/workflows/release-bundle.yml");
    const workflowLines = workflow.split("\n");
    const orderedFragments = [
      "bundle:",
      "name: Upload release bundle artifact",
      "rehearse:",
      "needs: bundle",
      "name: Download release bundle artifact",
      "name: Resolve release bundle root",
      "name: Rehearse release bundle",
    ];

    expect(workflow).toContain('bundle_root="release-artifact"');
    expect(workflow).toContain('if [ ! -f "${bundle_root}/release-manifest.json" ]; then');
    expect(workflow).toContain(
      "find release-artifact -mindepth 1 -maxdepth 1 -type d -exec test -f '{}/release-manifest.json' ';' -print",
    );
    expect(workflow).toContain("RELEASE_BUNDLE_ROOT");
    expect(workflow).toContain("working-directory: ${{ env.RELEASE_BUNDLE_ROOT }}");
    expect(workflow).toContain("RELEASE_REHEARSE_ROOT=.");
    expect(workflow).toContain("pnpm release:rehearse");
    expect(workflow).not.toContain("name: Install bundle dependencies");
    expect(workflow).not.toContain("name: Start bundle container stack");
    expect(workflow).not.toContain("name: Run bundle container health smoke");
    expect(workflow).not.toContain("name: Run bundle readiness smoke");
    expect(workflow).not.toContain("name: Run bundle route smoke");
    expect(workflow).not.toContain("name: Stop bundle container stack");

    let previousIndex = -1;

    for (const fragment of orderedFragments) {
      const currentIndex = findLineIndex(workflowLines, fragment);

      expect(currentIndex).toBeGreaterThan(previousIndex);
      previousIndex = currentIndex;
    }
  });

  it("documents a unified runtime verification entrypoint for deployed stacks", () => {
    const packageJson = readRepoFile("package.json");
    const readme = readRepoFile("README.md");
    const script = readRepoFile("scripts/runtime-verify.mjs");
    const workflow = readRepoFile(".github/workflows/runtime-verify.yml");

    expect(packageJson).toContain("\"runtime:verify\": \"node scripts/runtime-verify.mjs\"");
    expect(readme).toContain("## Runtime verify");
    expect(readme).toContain(
      "RUNTIME_API_BASE_URL=http://127.0.0.1:13001 RUNTIME_WEB_BASE_URL=http://127.0.0.1:13000 RUNTIME_ADMIN_BASE_URL=http://127.0.0.1:13002 pnpm runtime:verify",
    );
    expect(readme).toContain("reuses the readiness and route smoke checks");
    expect(readme).toContain("RUNTIME_API_BASE_URL");
    expect(readme).toContain("RUNTIME_WEB_BASE_URL");
    expect(readme).toContain("RUNTIME_ADMIN_BASE_URL");
    expect(readme).toContain("RUNTIME_LOCALE");
    expect(readme).toContain("The `Runtime verify` GitHub Actions workflow");
    expect(script).toContain("resolveRuntimeVerifyEnv");
    expect(script).toContain("runRuntimeVerifyScript");
    expect(script).toContain("validateRuntimeVerifyEnv");
    expect(script).toContain("runtime:verify requires complete target URLs");
    expect(workflow).toContain("name: Runtime verify");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("runtime_api_base_url:");
    expect(workflow).toContain("required: true");
    expect(workflow).toContain("runtime_web_base_url:");
    expect(workflow).toContain("runtime_admin_base_url:");
    expect(workflow).toContain("runtime_locale:");
    expect(workflow).toContain("default: en");
    expect(workflow).toContain("pnpm runtime:verify");
    expect(workflow).toContain("RUNTIME_API_BASE_URL: ${{ inputs.runtime_api_base_url }}");
    expect(workflow).toContain("RUNTIME_WEB_BASE_URL: ${{ inputs.runtime_web_base_url }}");
    expect(workflow).toContain("RUNTIME_ADMIN_BASE_URL: ${{ inputs.runtime_admin_base_url }}");
    expect(workflow).toContain("RUNTIME_LOCALE: ${{ inputs.runtime_locale }}");
  });

  it("keeps compose runtime settings overridable for deployed bundles", () => {
    const compose = readRepoFile("docker-compose.yml");
    const postgresBlock = readComposeServiceBlock(compose, "postgres");
    const dbInitEnvironment = readComposeServiceEnvironmentBlock(compose, "db-init");
    const apiEnvironment = readComposeServiceEnvironmentBlock(compose, "api");
    const webEnvironment = readComposeServiceEnvironmentBlock(compose, "web");
    const adminEnvironment = readComposeServiceEnvironmentBlock(compose, "admin");
    const workerEnvironment = readComposeServiceEnvironmentBlock(compose, "worker");

    expect(postgresBlock).toContain('      - "${POSTGRES_HOST_PORT:-5432}:5432"');
    expect(postgresBlock).toContain("POSTGRES_USER: ${POSTGRES_USER:-postgres}");
    expect(postgresBlock).toContain("POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}");
    expect(postgresBlock).toContain(
      'pg_isready -h 127.0.0.1 -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-aussie_deals_hub}',
    );
    expect(dbInitEnvironment).toContain(
      "DATABASE_URL: ${DATABASE_URL:-postgresql://postgres:postgres@postgres:5432/aussie_deals_hub}",
    );
    expect(apiEnvironment).toContain(
      "DATABASE_URL: ${DATABASE_URL:-postgresql://postgres:postgres@postgres:5432/aussie_deals_hub}",
    );
    expect(apiEnvironment).toContain("REDIS_URL: ${REDIS_URL:-redis://redis:6379}");
    expect(apiEnvironment).toContain(
      "SESSION_SECRET: ${SESSION_SECRET:-change-me-to-at-least-16-characters}",
    );
    expect(webEnvironment).toContain("API_BASE_URL: ${API_BASE_URL:-http://api:3001}");
    expect(webEnvironment).toContain("NEXT_PUBLIC_SITE_URL: ${NEXT_PUBLIC_SITE_URL:-http://localhost:3000}");
    expect(webEnvironment).toContain("SITE_URL: ${SITE_URL:-http://localhost:3000}");
    expect(adminEnvironment).toContain("ADMIN_API_BASE_URL: ${ADMIN_API_BASE_URL:-http://api:3001}");
    expect(workerEnvironment).toContain(
      "DATABASE_URL: ${DATABASE_URL:-postgresql://postgres:postgres@postgres:5432/aussie_deals_hub}",
    );
    expect(workerEnvironment).toContain("WORKER_POLL_INTERVAL_MS: ${WORKER_POLL_INTERVAL_MS:-30000}");
    expect(workerEnvironment).toContain("WORKER_REVIEW_ENABLED: ${WORKER_REVIEW_ENABLED:-1}");
    expect(workerEnvironment).toContain("WORKER_PUBLISH_ENABLED: ${WORKER_PUBLISH_ENABLED:-1}");
  });

  it("pins CI setup actions to reviewed SHAs and keeps the workspace toolchain aligned", () => {
    const workflow = readRepoFile(".github/workflows/verify.yml");
    const packageJson = JSON.parse(readRepoFile("package.json")) as {
      packageManager: string;
    };
    const pnpmVersion = packageJson.packageManager.replace("pnpm@", "");

    expect(workflow).toContain(
      "uses: actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd # v5",
    );
    expect(workflow).toContain(
      "uses: pnpm/action-setup@fc06bc1257f339d1d5d8b3a19a8cae5388b55320 # v5",
    );
    expect(workflow).toContain(
      "uses: actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444 # v5",
    );
    expect(workflow).toContain(`version: ${pnpmVersion}`);
    expect(workflow).toContain("node-version: 22");
    expect(workflow).toContain("cache: pnpm");
    expect(workflow).toContain("pnpm install --frozen-lockfile");
  });

  it("keeps verify workflow permissions and cleanup safeguards in place", () => {
    const workflow = readRepoFile(".github/workflows/verify.yml");

    expect(workflow).toContain("permissions:\n  contents: read");
    expect(workflow).toContain("- name: Stop container stack\n        if: always()");
  });

  it("runs key CI verification steps in the required order", () => {
    const workflowLines = readRepoFile(".github/workflows/verify.yml").split("\n");
    const orderedFragments = [
      "name: Install dependencies",
      "name: Verify workspace",
      "name: Create shadow database for migration drift check",
      "name: Check migration drift against schema",
      "name: Create legacy verification database",
      "name: Verify legacy db:push upgrade path",
      "name: Prepare database for DB-backed tests",
      "name: Run DB-backed tests",
      "name: Validate compose file",
      "name: Build API image target",
      "name: Build Web image target",
      "name: Build Admin image target",
      "name: Build Worker image target",
      "name: Start container stack",
      "name: Run container health smoke",
      "name: Run readiness smoke",
      "name: Run route smoke",
      "name: Stop container stack",
    ];

    let previousIndex = -1;

    for (const fragment of orderedFragments) {
      const currentIndex = findLineIndex(workflowLines, fragment);

      expect(currentIndex).toBeGreaterThan(previousIndex);
      previousIndex = currentIndex;
    }
  });
});
