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
              baseUrl: "https://www.amazon.com.au",
              trustScore: 91,
              language: "en-AU",
              enabled: true,
            },
            {
              id: "source_2",
              name: "OzBargain",
              baseUrl: "https://www.ozbargain.com.au",
              trustScore: 88,
              language: "en-AU",
              enabled: false,
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

    const disabledRow = getRowForSource("OzBargain");
    expect(within(disabledRow).getByText("Disabled")).toBeTruthy();
    expect(within(disabledRow).getByRole("button", { name: "Enable" })).toBeTruthy();
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
              baseUrl: "https://www.amazon.com.au",
              trustScore: 91,
              language: "en-AU",
              enabled: true,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          id: "source_1",
          name: "Amazon AU",
          baseUrl: "https://www.amazon.com.au",
          trustScore: 91,
          language: "en-AU",
          enabled: false,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await renderSourcesPage();

    const row = await waitFor(() => getRowForSource("Amazon AU"));
    await user.click(within(row).getByRole("button", { name: "Disable" }));

    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://preview-api.test/v1/admin/sources", {
      cache: "no-store",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://preview-api.test/v1/admin/sources/source_1",
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
                baseUrl: "https://www.amazon.com.au",
                trustScore: 91,
                language: "en-AU",
                enabled: true,
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
          items: [],
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          id: "source_3",
          name: "PriceHipster AU",
          baseUrl: "https://www.pricehipster.com",
          trustScore: 77,
          language: "en-AU",
          enabled: true,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await renderSourcesPage();

    await user.type(screen.getByLabelText("Name"), "PriceHipster AU");
    await user.type(screen.getByLabelText("Base URL"), "https://www.pricehipster.com");
    await user.type(screen.getByLabelText("Language"), "en-AU");
    await user.type(screen.getByLabelText("Trust score"), "77");
    await user.click(screen.getByRole("button", { name: "Create source" }));

    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://preview-api.test/v1/admin/sources", {
      cache: "no-store",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://preview-api.test/v1/admin/sources", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "PriceHipster AU",
        baseUrl: "https://www.pricehipster.com",
        language: "en-AU",
        trustScore: 77,
      }),
    });

    expect(await screen.findByText("Source created.")).toBeTruthy();
    const row = await waitFor(() => getRowForSource("PriceHipster AU"));
    expect(within(row).getByText("https://www.pricehipster.com")).toBeTruthy();
    expect(within(row).getByText("77")).toBeTruthy();
    expect(within(row).getByText("en-AU")).toBeTruthy();
    expect(within(row).getByText("Enabled")).toBeTruthy();
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Base URL") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Language") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Trust score") as HTMLInputElement).value).toBe("");
  });
});
