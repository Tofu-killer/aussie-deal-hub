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
      BUILD_TIME_SITE_URL?: string;
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
      {
        command: "pnpm",
        args: ["build"],
        env: {
          NEXT_PUBLIC_SITE_URL: scriptModule.BUILD_TIME_SITE_URL,
          SITE_URL: scriptModule.BUILD_TIME_SITE_URL,
        },
      },
      {
        command: "pnpm",
        args: ["test"],
        env: {
          NEXT_PUBLIC_SITE_URL: scriptModule.BUILD_TIME_SITE_URL,
          SITE_URL: scriptModule.BUILD_TIME_SITE_URL,
        },
      },
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
      BUILD_TIME_SITE_URL?: string;
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
      {
        command: "pnpm",
        args: ["build"],
        env: {
          VERIFY_DB: "1",
          NEXT_PUBLIC_SITE_URL: scriptModule.BUILD_TIME_SITE_URL,
          SITE_URL: scriptModule.BUILD_TIME_SITE_URL,
        },
      },
      {
        command: "pnpm",
        args: ["test"],
        env: {
          VERIFY_DB: "1",
          NEXT_PUBLIC_SITE_URL: scriptModule.BUILD_TIME_SITE_URL,
          SITE_URL: scriptModule.BUILD_TIME_SITE_URL,
        },
      },
      {
        command: "pnpm",
        args: ["--filter", "@aussie-deal-hub/db", "db:migrate"],
        env,
      },
      { command: "pnpm", args: ["test:db"], env },
    ]);
  });

  it("preserves an explicit public site origin instead of overwriting it with the build-time placeholder", async () => {
    const scriptModule = (await import(`${pathToFileURL(scriptPath).href}?preserve-site-url`)) as {
      runVerifyWorkspaceScript?: (
        env: Record<string, string | undefined>,
        dependencies?: {
          runCommand?: (command: string, args: string[], options?: { env?: NodeJS.ProcessEnv }) => void;
        },
      ) => Promise<void>;
    };
    const calls: Array<{ command: string; args: string[]; env?: NodeJS.ProcessEnv }> = [];

    await scriptModule.runVerifyWorkspaceScript?.(
      {
        NEXT_PUBLIC_SITE_URL: "https://deals.example",
      },
      {
        runCommand: (command, args, options) => {
          calls.push({ command, args, env: options?.env });
        },
      },
    );

    expect(calls).toEqual([
      {
        command: "pnpm",
        args: ["build"],
        env: {
          NEXT_PUBLIC_SITE_URL: "https://deals.example",
          SITE_URL: "https://deals.example",
        },
      },
      {
        command: "pnpm",
        args: ["test"],
        env: {
          NEXT_PUBLIC_SITE_URL: "https://deals.example",
          SITE_URL: "https://deals.example",
        },
      },
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

  it("allows the explicit local DB fallback flag to opt into DB-backed verification", async () => {
    const scriptModule = (await import(`${pathToFileURL(scriptPath).href}?fallback-db`)) as {
      shouldRunDbBackedVerification?: (env: Record<string, string | undefined>) => boolean;
    };

    expect(
      scriptModule.shouldRunDbBackedVerification?.({
        ALLOW_LOCAL_DATABASE_URL_FALLBACK: "1",
      }),
    ).toBe(true);
  });

  it("fails fast when VERIFY_DB is enabled without DATABASE_URL or an explicit local fallback", async () => {
    const scriptModule = (await import(`${pathToFileURL(scriptPath).href}?missing-db-config`)) as {
      runVerifyWorkspaceScript?: (
        env: Record<string, string | undefined>,
        dependencies?: {
          runCommand?: (command: string, args: string[], options?: { env?: NodeJS.ProcessEnv }) => void;
        },
      ) => Promise<void>;
    };
    const runCommand = vi.fn();

    await expect(
      scriptModule.runVerifyWorkspaceScript?.(
        {
          VERIFY_DB: "1",
        },
        { runCommand },
      ),
    ).rejects.toThrow(
      "VERIFY_DB requires DATABASE_URL. Set ALLOW_LOCAL_DATABASE_URL_FALLBACK=1 to opt into the local PostgreSQL fallback for local-only development, or set VERIFY_DB=0 to skip DB-backed verification.",
    );
    expect(runCommand).not.toHaveBeenCalled();
  });
});
