import path from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it, vi } from "vitest";

const repoRoot = path.join(import.meta.dirname, "../../..");
const scriptPath = path.join(repoRoot, "scripts/verify-workspace.mjs");

describe("verify workspace script", () => {
  it("does not execute the verify flow when imported as a module", async () => {
    const originalExitCode = process.exitCode;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    process.exitCode = undefined;

    try {
      const scriptModule = (await import(`${pathToFileURL(scriptPath).href}?import-only`)) as {
        runVerifyWorkspaceScript?: (
          env: Record<string, string | undefined>,
          dependencies?: {
            runCommand?: (command: string, args: string[], options?: { env?: NodeJS.ProcessEnv }) => void;
          },
        ) => Promise<void>;
        shouldRunDbBackedVerification?: (env: Record<string, string | undefined>) => boolean;
      };

      expect(typeof scriptModule.runVerifyWorkspaceScript).toBe("function");
      expect(typeof scriptModule.shouldRunDbBackedVerification).toBe("function");
      expect(consoleError).not.toHaveBeenCalled();
      expect(process.exitCode).toBeUndefined();
    } finally {
      consoleError.mockRestore();
      process.exitCode = originalExitCode;
    }
  });

  it("runs build and unit tests without the DB suite when DATABASE_URL is absent", async () => {
    const scriptModule = (await import(`${pathToFileURL(scriptPath).href}?no-db`)) as {
      runVerifyWorkspaceScript?: (
        env: Record<string, string | undefined>,
        dependencies?: {
          runCommand?: (command: string, args: string[], options?: { env?: NodeJS.ProcessEnv }) => void;
        },
      ) => Promise<void>;
    };
    const calls: Array<{ command: string; args: string[]; env?: NodeJS.ProcessEnv }> = [];

    await scriptModule.runVerifyWorkspaceScript?.(
      {},
      {
        runCommand: (command, args, options) => {
          calls.push({ command, args, env: options?.env });
        },
      },
    );

    expect(calls).toEqual([
      { command: "pnpm", args: ["build"], env: {} },
      { command: "pnpm", args: ["test"], env: {} },
    ]);
  });

  it("runs migrate and the DB-backed suite when DATABASE_URL is configured without leaking it into standard tests", async () => {
    const scriptModule = (await import(`${pathToFileURL(scriptPath).href}?with-db`)) as {
      runVerifyWorkspaceScript?: (
        env: Record<string, string | undefined>,
        dependencies?: {
          runCommand?: (command: string, args: string[], options?: { env?: NodeJS.ProcessEnv }) => void;
        },
      ) => Promise<void>;
    };
    const calls: Array<{ command: string; args: string[]; env?: NodeJS.ProcessEnv }> = [];
    const env = {
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub",
      VERIFY_DB: "1",
    };

    await scriptModule.runVerifyWorkspaceScript?.(
      env,
      {
        runCommand: (command, args, options) => {
          calls.push({ command, args, env: options?.env });
        },
      },
    );

    expect(calls).toEqual([
      { command: "pnpm", args: ["build"], env: { VERIFY_DB: "1" } },
      { command: "pnpm", args: ["test"], env: { VERIFY_DB: "1" } },
      {
        command: "pnpm",
        args: ["--filter", "@aussie-deal-hub/db", "db:migrate"],
        env,
      },
      { command: "pnpm", args: ["test:db"], env },
    ]);
  });

  it("allows VERIFY_DB=0 to skip the DB-backed suite even when DATABASE_URL is configured", async () => {
    const scriptModule = (await import(`${pathToFileURL(scriptPath).href}?skip-db`)) as {
      shouldRunDbBackedVerification?: (env: Record<string, string | undefined>) => boolean;
    };

    expect(
      scriptModule.shouldRunDbBackedVerification?.({
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub",
        VERIFY_DB: "0",
      }),
    ).toBe(false);
  });

  it("allows VERIFY_DB=1 to force the DB-backed suite without an explicit DATABASE_URL", async () => {
    const scriptModule = (await import(`${pathToFileURL(scriptPath).href}?force-db`)) as {
      shouldRunDbBackedVerification?: (env: Record<string, string | undefined>) => boolean;
    };

    expect(
      scriptModule.shouldRunDbBackedVerification?.({
        VERIFY_DB: "1",
      }),
    ).toBe(true);
  });
});
