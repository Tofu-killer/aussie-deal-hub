import { describe, expect, it, vi } from "vitest";

import { ingestEnabledSources } from "./ingestEnabledSources";

describe("ingestEnabledSources", () => {
  it("fetches enabled sources, creates new leads, and records poll status", async () => {
    const createLeadIfNew = vi
      .fn()
      .mockResolvedValueOnce({ created: true })
      .mockResolvedValueOnce({ created: false });
    const recordSourcePoll = vi.fn().mockResolvedValue(undefined);
    const fetcher = {
      fetch: vi.fn().mockResolvedValue({
        body: `
          <a href="/deal/switch">Nintendo Switch OLED for A$399 at Amazon AU</a>
          <a href="/deal/airpods">AirPods Pro (2nd Gen) for A$299 at Amazon AU</a>
        `,
        contentType: "text/html",
      }),
    };

    const summary = await ingestEnabledSources(
      [
        {
          id: "source_1",
          name: "Amazon AU",
          sourceType: "community",
          baseUrl: "https://source.example/home",
          fetchMethod: "html",
          pollIntervalMinutes: 60,
          trustScore: 80,
          language: "en",
          lastPolledAt: null,
        },
      ],
      {
        createLeadIfNew,
      },
      {
        recordSourcePoll,
      },
      fetcher,
    );

    expect(fetcher.fetch).toHaveBeenCalledWith({
      url: "https://source.example/home",
      fetchMethod: "html",
    });
    expect(createLeadIfNew).toHaveBeenCalledTimes(2);
    expect(recordSourcePoll).toHaveBeenCalledWith({
      sourceId: "source_1",
      createdLeadCount: 1,
      message: "Fetched 2 candidates; created 1 leads.",
      status: "ok",
    });
    expect(summary).toMatchObject({
      createdLeadCount: 1,
      polledSourceCount: 1,
      sourceResults: [
        {
          sourceId: "source_1",
          createdLeadCount: 1,
          status: "ok",
        },
      ],
    });
  });

  it("records poll errors when fetching a source fails", async () => {
    const recordSourcePoll = vi.fn().mockResolvedValue(undefined);

    const summary = await ingestEnabledSources(
      [
        {
          id: "source_1",
          name: "Amazon AU",
          sourceType: "community",
          baseUrl: "https://source.example/home",
          fetchMethod: "json",
          pollIntervalMinutes: 30,
          trustScore: 80,
          language: "en",
          lastPolledAt: null,
        },
      ],
      {
        createLeadIfNew: vi.fn(),
      },
      {
        recordSourcePoll,
      },
      {
        fetch: vi.fn().mockRejectedValue(new Error("ECONNRESET")),
      },
    );

    expect(recordSourcePoll).toHaveBeenCalledWith({
      sourceId: "source_1",
      createdLeadCount: 0,
      message: "ECONNRESET",
      status: "error",
    });
    expect(summary).toMatchObject({
      createdLeadCount: 0,
      sourceResults: [
        {
          sourceId: "source_1",
          createdLeadCount: 0,
          status: "error",
        },
      ],
    });
  });

  it("skips sources that are not due yet", async () => {
    const createLeadIfNew = vi.fn();
    const recordSourcePoll = vi.fn().mockResolvedValue(undefined);
    const fetch = vi.fn();

    const summary = await ingestEnabledSources(
      [
        {
          id: "source_1",
          name: "Amazon AU",
          sourceType: "community",
          baseUrl: "https://source.example/home",
          fetchMethod: "html",
          pollIntervalMinutes: 60,
          trustScore: 80,
          language: "en",
          lastPolledAt: "2026-04-25T00:30:00.000Z",
        },
      ],
      {
        createLeadIfNew,
      },
      {
        recordSourcePoll,
      },
      {
        fetch,
      },
      {
        now: new Date("2026-04-25T01:00:00.000Z"),
      },
    );

    expect(fetch).not.toHaveBeenCalled();
    expect(createLeadIfNew).not.toHaveBeenCalled();
    expect(recordSourcePoll).not.toHaveBeenCalled();
    expect(summary).toEqual({
      createdLeadCount: 0,
      createdLeadIds: [],
      polledSourceCount: 0,
      sourceResults: [],
    });
  });
});
