import { describe, expect, it, vi } from "vitest";

import { createWorkerLeadStore } from "./workerConfig";

describe("createWorkerLeadStore", () => {
  it("preserves lead creation while disabling automatic review", async () => {
    const createLeadIfNew = vi.fn().mockResolvedValue({ created: true });
    const listLeadRecords = vi.fn().mockResolvedValue([
      {
        lead: {
          id: "lead_pending",
        },
        review: null,
      },
      {
        lead: {
          id: "lead_reviewed",
        },
        review: {
          leadId: "lead_reviewed",
        },
      },
    ]);
    const saveLeadReviewDraft = vi.fn().mockResolvedValue(null);

    const leadStore = createWorkerLeadStore(
      {
        createLeadIfNew,
        listLeadRecords,
        saveLeadReviewDraft,
      } as never,
      false,
    );

    expect(await leadStore.createLeadIfNew({ sourceId: "src_amazon" } as never)).toEqual({
      created: true,
    });
    await expect(leadStore.listLeadRecords()).resolves.toEqual([
      {
        lead: {
          id: "lead_reviewed",
        },
        review: {
          leadId: "lead_reviewed",
        },
      },
    ]);
    expect(leadStore.saveLeadReviewDraft).toBe(saveLeadReviewDraft);
  });

  it("returns the original lead store when automatic review is enabled", () => {
    const leadStore = {
      createLeadIfNew: vi.fn(),
      listLeadRecords: vi.fn(),
      saveLeadReviewDraft: vi.fn(),
    };

    expect(createWorkerLeadStore(leadStore as never, true)).toBe(leadStore);
  });
});
