import { describe, expect, it, vi } from "vitest";

import {
  baselineMigrationName,
  checkedInSchemaDiffArgs,
  checkedInSchemaMatchesDatabase,
  deployMigrations,
  PrismaCommandExitError,
  readMigrationState,
  shouldAttemptLegacyBaselineResolve,
} from "./migrate";

describe("db migrate deployment", () => {
  it("only attempts legacy baseline resolution for non-empty databases without migration history", () => {
    expect(
      shouldAttemptLegacyBaselineResolve({
        migrationsTableExists: false,
        publicTableNames: ["Source"],
      }),
    ).toBe(true);

    expect(
      shouldAttemptLegacyBaselineResolve({
        migrationsTableExists: false,
        publicTableNames: [],
      }),
    ).toBe(false);

    expect(
      shouldAttemptLegacyBaselineResolve({
        migrationsTableExists: true,
        publicTableNames: ["Source"],
      }),
    ).toBe(false);
  });

  it("matches only databases that still align with the checked-in Prisma schema", async () => {
    const runPrismaCommand = vi.fn();

    await expect(
      checkedInSchemaMatchesDatabase({
        runPrismaCommand,
      }),
    ).resolves.toBe(true);

    expect(
      runPrismaCommand.mock.calls,
    ).toEqual([[checkedInSchemaDiffArgs, { stdio: "pipe" }]]);
  });

  it("treats a schema diff as a drift signal instead of a baseline resolve candidate", async () => {
    const runPrismaCommand = vi.fn(() => {
      throw new PrismaCommandExitError(2);
    });

    await expect(
      checkedInSchemaMatchesDatabase({
        runPrismaCommand,
      }),
    ).resolves.toBe(false);
  });

  it("rethrows unexpected Prisma command failures while checking schema drift", async () => {
    const runPrismaCommand = vi.fn(() => {
      throw new PrismaCommandExitError(1);
    });

    await expect(
      checkedInSchemaMatchesDatabase({
        runPrismaCommand,
      }),
    ).rejects.toBeInstanceOf(PrismaCommandExitError);
  });

  it("resolves the checked-in baseline before deploy for legacy db:push databases that still match the schema", async () => {
    const queryRawUnsafe = vi
      .fn()
      .mockResolvedValueOnce([{ regclass: null }])
      .mockResolvedValueOnce(
        [{ tableName: "Source" }],
      );
    const runPrismaCommand = vi.fn();

    await deployMigrations({
      prismaClient: {
        $queryRawUnsafe: queryRawUnsafe,
      } as never,
      runPrismaCommand,
    });

    expect(runPrismaCommand.mock.calls).toEqual([
      [checkedInSchemaDiffArgs, { stdio: "pipe" }],
      [["migrate", "resolve", "--applied", baselineMigrationName]],
      [["migrate", "deploy"]],
    ]);
  });

  it("deploys migrations directly for fresh databases", async () => {
    const queryRawUnsafe = vi
      .fn()
      .mockResolvedValueOnce([{ regclass: null }])
      .mockResolvedValueOnce([]);
    const runPrismaCommand = vi.fn();

    await deployMigrations({
      prismaClient: {
        $queryRawUnsafe: queryRawUnsafe,
      } as never,
      runPrismaCommand,
    });

    expect(runPrismaCommand.mock.calls).toEqual([[["migrate", "deploy"]]]);
  });

  it("skips legacy baseline resolve when the live schema drifts from the checked-in Prisma schema", async () => {
    const queryRawUnsafe = vi
      .fn()
      .mockResolvedValueOnce([{ regclass: null }])
      .mockResolvedValueOnce([{ tableName: "Source" }]);
    const runPrismaCommand = vi.fn((args) => {
      if (JSON.stringify(args) === JSON.stringify(checkedInSchemaDiffArgs)) {
        throw new PrismaCommandExitError(2);
      }
    });

    await deployMigrations({
      prismaClient: {
        $queryRawUnsafe: queryRawUnsafe,
      } as never,
      runPrismaCommand,
    });

    expect(runPrismaCommand.mock.calls).toEqual([
      [checkedInSchemaDiffArgs, { stdio: "pipe" }],
      [["migrate", "deploy"]],
    ]);
  });

  it("casts the migration table lookup to a Prisma-safe type", async () => {
    const queryRawUnsafe = vi
      .fn()
      .mockResolvedValueOnce([{ regclass: "public._prisma_migrations" }])
      .mockResolvedValueOnce([
        { tableName: "Source" },
        { tableName: "Lead" },
      ]);

    await expect(
      readMigrationState({
        $queryRawUnsafe: queryRawUnsafe,
      } as never),
    ).resolves.toEqual({
      migrationsTableExists: true,
      publicTableNames: ["Lead", "Source"],
    });

    expect(queryRawUnsafe).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("::text AS regclass"),
    );
    expect(queryRawUnsafe).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('SELECT tablename AS "tableName"'),
    );
  });
});
