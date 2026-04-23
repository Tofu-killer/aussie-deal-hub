import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app";
import { dispatchRequest } from "./httpHarness";

describe("api error handling", () => {
  it("returns JSON 503 when a route fails with a prisma initialization error", async () => {
    const app = buildApp({
      adminLeadStore: {
        async listLeadRecords() {
          const error = new Error("db down");
          error.name = "PrismaClientInitializationError";
          throw error;
        },
        async getLeadRecord() {
          return null;
        },
        async createLead() {
          throw new Error("not implemented");
        },
        async saveLeadReviewDraft() {
          return null;
        },
      },
    });

    const response = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/admin/leads",
    });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      message: "Dependency unavailable.",
    });
  });

  it("returns JSON 500 for unexpected route errors", async () => {
    const app = buildApp({
      adminLeadStore: {
        async listLeadRecords() {
          throw new Error("boom");
        },
        async getLeadRecord() {
          return null;
        },
        async createLead() {
          throw new Error("not implemented");
        },
        async saveLeadReviewDraft() {
          return null;
        },
      },
    });

    const response = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/admin/leads",
    });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      message: "Internal server error.",
    });
  });
});
