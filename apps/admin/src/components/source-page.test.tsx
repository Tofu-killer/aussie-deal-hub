import React from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import SourcesPage from "../app/sources/page";

function createJsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: async () => body,
  } as Response;
}

async function renderSourcesPage() {
  if (SourcesPage.constructor.name === "AsyncFunction") {
    render(await Promise.resolve(SourcesPage()));
    return;
  }

  render(<SourcesPage />);
}

function getRowForSource(name: string) {
  const row = screen.getByText(name).closest("tr");

  if (!row) {
    throw new Error(`Row not found for source ${name}.`);
  }

  return row;
}

function getRenderedSourceNames(table: HTMLElement) {
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[0]?.textContent?.trim() ?? "");
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete process.env.ADMIN_API_BASE_URL;
});

describe("sources page", () => {
  it("renders source rows with per-row enabled toggle controls", async () => {
    process.env.ADMIN_API_BASE_URL = "http://preview-api.test";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        createJsonResponse({
          items: [
            {
              id: "source_1",
              name: "Amazon AU",
              sourceType: "community",
              baseUrl: "https://www.amazon.com.au",
              fetchMethod: "html",
              pollIntervalMinutes: 60,
              trustScore: 91,
              language: "en-AU",
              enabled: true,
              pollCount: 3,
              lastPolledAt: "2026-04-24T00:00:00.000Z",
              lastPollStatus: "ok",
              lastPollMessage: "Fetched 2 candidates; created 1 leads.",
              lastLeadCreatedAt: "2026-04-24T00:00:00.000Z",
            },
            {
              id: "source_2",
              name: "OzBargain",
              sourceType: "publisher",
              baseUrl: "https://www.ozbargain.com.au",
              fetchMethod: "json",
              pollIntervalMinutes: 180,
              trustScore: 88,
              language: "en-AU",
              enabled: false,
              pollCount: 1,
              lastPolledAt: "2026-04-24T01:00:00.000Z",
              lastPollStatus: "error",
              lastPollMessage: "Source fetch failed: 500",
              lastLeadCreatedAt: null,
            },
          ],
        }),
      ),
    );

    await renderSourcesPage();

    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(3);

    const enabledRow = getRowForSource("Amazon AU");
    expect(within(enabledRow).getByText("Enabled")).toBeTruthy();
    expect(within(enabledRow).getByRole("button", { name: "Disable" })).toBeTruthy();
    expect(within(enabledRow).getByText("community")).toBeTruthy();
    expect(within(enabledRow).getByDisplayValue("html")).toBeTruthy();
    expect(within(enabledRow).getByDisplayValue("60")).toBeTruthy();
    expect(within(enabledRow).getByText("ok: Fetched 2 candidates; created 1 leads.")).toBeTruthy();

    const disabledRow = getRowForSource("OzBargain");
    expect(within(disabledRow).getByText("Disabled")).toBeTruthy();
    expect(within(disabledRow).getByRole("button", { name: "Enable" })).toBeTruthy();
    expect(within(disabledRow).getByText("publisher")).toBeTruthy();
    expect(within(disabledRow).getByDisplayValue("json")).toBeTruthy();
    expect(within(disabledRow).getByDisplayValue("180")).toBeTruthy();
    expect(within(disabledRow).getByText("error: Source fetch failed: 500")).toBeTruthy();
  });

  it("patches enabled state and shows success feedback", async () => {
    process.env.ADMIN_API_BASE_URL = "http://preview-api.test";
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({
          items: [
            {
              id: "source_1",
              name: "Amazon AU",
              sourceType: "community",
              baseUrl: "https://www.amazon.com.au",
              fetchMethod: "html",
              pollIntervalMinutes: 60,
              trustScore: 91,
              language: "en-AU",
              enabled: true,
              pollCount: 0,
              lastPolledAt: null,
              lastPollStatus: null,
              lastPollMessage: null,
              lastLeadCreatedAt: null,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          id: "source_1",
          name: "Amazon AU",
          sourceType: "community",
          baseUrl: "https://www.amazon.com.au",
          fetchMethod: "html",
          pollIntervalMinutes: 60,
          trustScore: 91,
          language: "en-AU",
          enabled: false,
          pollCount: 0,
          lastPolledAt: null,
          lastPollStatus: null,
          lastPollMessage: null,
          lastLeadCreatedAt: null,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await renderSourcesPage();

    const row = await waitFor(() => getRowForSource("Amazon AU"));
    await user.click(within(row).getByRole("button", { name: "Disable" }));

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/v1/admin/sources", {
      cache: "no-store",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/v1/admin/sources/source_1",
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enabled: false,
        }),
      },
    );

    expect(await screen.findByText("Source updated.")).toBeTruthy();
    await waitFor(() => {
      const updatedRow = getRowForSource("Amazon AU");
      expect(within(updatedRow).getByText("Disabled")).toBeTruthy();
      expect(within(updatedRow).getByRole("button", { name: "Enable" })).toBeTruthy();
    });
  });

  it("shows an error and keeps the previous state when the patch fails", async () => {
    process.env.ADMIN_API_BASE_URL = "http://preview-api.test";
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(
          createJsonResponse({
            items: [
            {
              id: "source_1",
              name: "Amazon AU",
              sourceType: "community",
              baseUrl: "https://www.amazon.com.au",
              fetchMethod: "html",
              pollIntervalMinutes: 60,
              trustScore: 91,
              language: "en-AU",
              enabled: true,
              pollCount: 0,
              lastPolledAt: null,
              lastPollStatus: null,
              lastPollMessage: null,
              lastLeadCreatedAt: null,
            },
          ],
        }),
        )
        .mockResolvedValueOnce(createJsonResponse({ message: "boom" }, false)),
    );

    await renderSourcesPage();

    const row = await waitFor(() => getRowForSource("Amazon AU"));
    await user.click(within(row).getByRole("button", { name: "Disable" }));

    expect(await screen.findByText("Failed to update source.")).toBeTruthy();
    const unchangedRow = getRowForSource("Amazon AU");
    expect(within(unchangedRow).getByText("Enabled")).toBeTruthy();
    expect(within(unchangedRow).getByRole("button", { name: "Disable" })).toBeTruthy();
  });

  it("submits the create-source form and renders the created source", async () => {
    process.env.ADMIN_API_BASE_URL = "http://preview-api.test";
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({
          items: [
            {
              id: "source_1",
              name: "Amazon AU",
              sourceType: "community",
              baseUrl: "https://www.amazon.com.au",
              fetchMethod: "html",
              pollIntervalMinutes: 60,
              trustScore: 91,
              language: "en-AU",
              enabled: true,
              pollCount: 0,
              lastPolledAt: null,
              lastPollStatus: null,
              lastPollMessage: null,
              lastLeadCreatedAt: null,
            },
            {
              id: "source_2",
              name: "OzBargain",
              sourceType: "publisher",
              baseUrl: "https://www.ozbargain.com.au",
              fetchMethod: "json",
              pollIntervalMinutes: 180,
              trustScore: 88,
              language: "en-AU",
              enabled: false,
              pollCount: 1,
              lastPolledAt: null,
              lastPollStatus: null,
              lastPollMessage: null,
              lastLeadCreatedAt: null,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          id: "source_3",
          name: "PriceHipster AU",
          sourceType: "community",
          baseUrl: "https://www.pricehipster.com",
          fetchMethod: "json",
          pollIntervalMinutes: 240,
          trustScore: 77,
          language: "en-AU",
          enabled: true,
          pollCount: 0,
          lastPolledAt: null,
          lastPollStatus: null,
          lastPollMessage: null,
          lastLeadCreatedAt: null,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await renderSourcesPage();

    await user.type(screen.getByLabelText("Name"), "PriceHipster AU");
    await user.type(screen.getByLabelText("Base URL"), "https://www.pricehipster.com");
    await user.type(screen.getByLabelText("Language"), "en-AU");
    await user.selectOptions(screen.getByLabelText("Fetch method"), "json");
    await user.type(screen.getByLabelText("Trust score"), "77");
    await user.type(screen.getByLabelText("Poll interval (minutes)"), "240");
    await user.click(screen.getByRole("button", { name: "Create source" }));

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/v1/admin/sources", {
      cache: "no-store",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/v1/admin/sources", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "PriceHipster AU",
        baseUrl: "https://www.pricehipster.com",
        language: "en-AU",
        fetchMethod: "json",
        trustScore: 77,
        pollIntervalMinutes: 240,
      }),
    });

    expect(await screen.findByText("Source created.")).toBeTruthy();
    const row = await waitFor(() => getRowForSource("PriceHipster AU"));
    expect(within(row).getByText("https://www.pricehipster.com")).toBeTruthy();
    expect(within(row).getByText("77")).toBeTruthy();
    expect(within(row).getByText("en-AU")).toBeTruthy();
    expect(within(row).getByText("Enabled")).toBeTruthy();
    expect(within(row).getByDisplayValue("json")).toBeTruthy();
    expect(within(row).getByDisplayValue("240")).toBeTruthy();
    expect(getRenderedSourceNames(screen.getByRole("table"))).toEqual([
      "Amazon AU",
      "OzBargain",
      "PriceHipster AU",
    ]);
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Base URL") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Language") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Trust score") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Poll interval (minutes)") as HTMLInputElement).value).toBe("");
  });

  it("saves source fetch settings and shows updated metadata", async () => {
    process.env.ADMIN_API_BASE_URL = "http://preview-api.test";
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({
          items: [
            {
              id: "source_1",
              name: "Amazon AU",
              sourceType: "community",
              baseUrl: "https://www.amazon.com.au",
              fetchMethod: "html",
              pollIntervalMinutes: 60,
              trustScore: 91,
              language: "en-AU",
              enabled: true,
              pollCount: 0,
              lastPolledAt: null,
              lastPollStatus: null,
              lastPollMessage: null,
              lastLeadCreatedAt: null,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          id: "source_1",
          name: "Amazon AU",
          sourceType: "community",
          baseUrl: "https://www.amazon.com.au",
          fetchMethod: "json",
          pollIntervalMinutes: 15,
          trustScore: 91,
          language: "en-AU",
          enabled: true,
          pollCount: 0,
          lastPolledAt: null,
          lastPollStatus: null,
          lastPollMessage: null,
          lastLeadCreatedAt: null,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await renderSourcesPage();

    const row = await waitFor(() => getRowForSource("Amazon AU"));
    await user.selectOptions(within(row).getByLabelText("Fetch method for Amazon AU"), "json");
    const intervalInput = within(row).getByLabelText(
      "Poll interval (minutes) for Amazon AU",
    ) as HTMLInputElement;
    await user.clear(intervalInput);
    await user.type(intervalInput, "15");
    await user.click(within(row).getByRole("button", { name: "Save settings" }));

    expect(fetchMock).toHaveBeenNthCalledWith(2, "/v1/admin/sources/source_1", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fetchMethod: "json",
        pollIntervalMinutes: 15,
      }),
    });

    expect(await screen.findByText("Source updated.")).toBeTruthy();
    await waitFor(() => {
      const updatedRow = getRowForSource("Amazon AU");
      expect(within(updatedRow).getByDisplayValue("json")).toBeTruthy();
      expect(within(updatedRow).getByDisplayValue("15")).toBeTruthy();
    });
  });

  it("deletes a source row and removes it from the rendered table", async () => {
    process.env.ADMIN_API_BASE_URL = "http://preview-api.test";
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({
          items: [
            {
              id: "source_1",
              name: "Amazon AU",
              sourceType: "community",
              baseUrl: "https://www.amazon.com.au",
              fetchMethod: "html",
              pollIntervalMinutes: 60,
              trustScore: 91,
              language: "en-AU",
              enabled: true,
              pollCount: 0,
              lastPolledAt: null,
              lastPollStatus: null,
              lastPollMessage: null,
              lastLeadCreatedAt: null,
            },
          ],
        }),
      )
      .mockResolvedValueOnce({
        ok: true,
        json: async () => undefined,
      } as Response);
    vi.stubGlobal("fetch", fetchMock);

    await renderSourcesPage();

    const row = await waitFor(() => getRowForSource("Amazon AU"));
    await user.click(within(row).getByRole("button", { name: "Delete source" }));

    expect(fetchMock).toHaveBeenNthCalledWith(2, "/v1/admin/sources/source_1", {
      method: "DELETE",
    });

    expect(await screen.findByText("Source deleted.")).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByText("Amazon AU")).toBeNull();
      expect(screen.getByText("No sources available.")).toBeTruthy();
    });
  });
});
