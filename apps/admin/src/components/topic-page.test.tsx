import React from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import TopicsPage from "../app/topics/page";

function createJsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: async () => body,
  } as Response;
}

function getRowForText(text: string) {
  const row = screen.getByText(text).closest("tr");

  if (!row) {
    throw new Error(`Row not found for ${text}.`);
  }

  return row;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("topics page", () => {
  it("renders topic management rows from the live admin topics API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        items: [
          {
            id: "work-from-home",
            name: "Work From Home",
            slug: "work-from-home",
            spotlightDeals: 6,
            status: "Active",
            owner: "Discovery desk",
          },
          {
            id: "gaming-setup",
            name: "Gaming Setup",
            slug: "gaming-setup",
            spotlightDeals: 9,
            status: "Active",
            owner: "Discovery desk",
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<TopicsPage />);

    expect(screen.getByRole("heading", { name: "Topics" })).toBeTruthy();
    expect(screen.getByText("Review editorial topics that group themed deal coverage.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/v1/admin/topics", {
      cache: "no-store",
    });
    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(within(table).getByText("Work From Home")).toBeTruthy();
    expect(within(table).getByText("Gaming Setup")).toBeTruthy();
  });

  it("submits the create-topic form and renders the created topic", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse({ items: [] }))
      .mockResolvedValueOnce(
        createJsonResponse({
          id: "eofy-tech",
          name: "EOFY Tech",
          slug: "eofy-tech",
          spotlightDeals: 0,
          status: "Draft",
          owner: "Admin topics",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<TopicsPage />);

    await user.type(screen.getByLabelText("Topic name"), "EOFY Tech");
    await user.click(screen.getByRole("button", { name: "Create topic" }));

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/v1/admin/topics", {
      cache: "no-store",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/v1/admin/topics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "EOFY Tech",
      }),
    });
    expect(await screen.findByText("Topic created.")).toBeTruthy();
    const row = await waitFor(() => getRowForText("EOFY Tech"));
    expect(within(row).getByText("eofy-tech")).toBeTruthy();
    expect(within(row).getByText("0")).toBeTruthy();
    expect(within(row).getByText("Draft")).toBeTruthy();
    expect(within(row).getByText("Admin topics")).toBeTruthy();
  });
});
