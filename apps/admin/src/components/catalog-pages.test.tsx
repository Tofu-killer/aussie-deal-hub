import React from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import MerchantsPage from "../app/merchants/page";
import TagsPage from "../app/tags/page";

function createJsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: async () => body,
  } as Response;
}

async function renderCatalogPage(Page: typeof MerchantsPage | typeof TagsPage) {
  if (Page.constructor.name === "AsyncFunction") {
    render(await Promise.resolve(Page()));
    return;
  }

  render(<Page />);
}

function getRowForText(text: string) {
  const row = screen.getByText(text).closest("tr");

  if (!row) {
    throw new Error(`Row not found for ${text}.`);
  }

  return row;
}

function getRenderedRowNames(table: HTMLElement) {
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

describe("catalog management pages", () => {
  it("renders merchant management rows from the live admin merchants API", async () => {
    process.env.ADMIN_API_BASE_URL = "http://preview-api.test";
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        items: [
          {
            id: "amazon-au",
            name: "Amazon AU",
            activeDeals: 42,
            primaryCategory: "Electronics",
            status: "Active",
            owner: "Marketplace desk",
          },
          {
            id: "chemist-warehouse",
            name: "Chemist Warehouse",
            activeDeals: 17,
            primaryCategory: "Health",
            status: "Needs review",
            owner: "Retail desk",
          },
          {
            id: "the-iconic",
            name: "The Iconic",
            activeDeals: 9,
            primaryCategory: "Fashion",
            status: "Active",
            owner: "Lifestyle desk",
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await renderCatalogPage(MerchantsPage);

    expect(screen.getByRole("heading", { name: "Merchants" })).toBeTruthy();
    expect(screen.getByText("Review merchant health before publishing deals.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/v1/admin/merchants", {
      cache: "no-store",
    });
    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    expect(within(table).getByText("Amazon AU")).toBeTruthy();
    expect(within(table).getByText("Chemist Warehouse")).toBeTruthy();
    expect(within(table).getByText("The Iconic")).toBeTruthy();
  });

  it("renders a merchant fallback when the live admin merchants API fails", async () => {
    process.env.ADMIN_API_BASE_URL = "http://preview-api.test";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(createJsonResponse({ message: "boom" }, false)),
    );

    await renderCatalogPage(MerchantsPage);

    expect(await screen.findByText("Failed to load merchants.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("submits the create-merchant form and renders the created merchant", async () => {
    process.env.ADMIN_API_BASE_URL = "http://preview-api.test";
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({
          items: [
            {
              id: "amazon-au",
              name: "Amazon AU",
              activeDeals: 42,
              primaryCategory: "Electronics",
              status: "Active",
              owner: "Marketplace desk",
            },
            {
              id: "the-iconic",
              name: "The Iconic",
              activeDeals: 9,
              primaryCategory: "Fashion",
              status: "Active",
              owner: "Lifestyle desk",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          id: "jb-hi-fi",
          name: "JB Hi-Fi",
          activeDeals: 0,
          primaryCategory: "Unassigned",
          status: "Draft",
          owner: "Admin catalog",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await renderCatalogPage(MerchantsPage);

    await user.type(screen.getByLabelText("Merchant name"), "JB Hi-Fi");
    await user.click(screen.getByRole("button", { name: "Create merchant" }));

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/v1/admin/merchants", {
      cache: "no-store",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/v1/admin/merchants", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "JB Hi-Fi",
      }),
    });

    expect(await screen.findByText("Merchant created.")).toBeTruthy();
    const row = await waitFor(() => getRowForText("JB Hi-Fi"));
    expect(within(row).getByText("0")).toBeTruthy();
    expect(within(row).getByText("Unassigned")).toBeTruthy();
    expect(within(row).getByText("Draft")).toBeTruthy();
    expect(within(row).getByText("Admin catalog")).toBeTruthy();
    expect(getRenderedRowNames(screen.getByRole("table"))).toEqual([
      "Amazon AU",
      "JB Hi-Fi",
      "The Iconic",
    ]);
    expect((screen.getByLabelText("Merchant name") as HTMLInputElement).value).toBe("");
  });

  it("edits a merchant row and saves the updated catalog fields", async () => {
    process.env.ADMIN_API_BASE_URL = "http://preview-api.test";
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({
          items: [
            {
              id: "amazon-au",
              name: "Amazon AU",
              activeDeals: 42,
              primaryCategory: "Electronics",
              status: "Active",
              owner: "Marketplace desk",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          id: "amazon-au",
          name: "Amazon Australia",
          activeDeals: 42,
          primaryCategory: "Marketplace",
          status: "Paused",
          owner: "Commerce desk",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await renderCatalogPage(MerchantsPage);

    const row = await waitFor(() => getRowForText("Amazon AU"));
    await user.click(within(row).getByRole("button", { name: "Edit merchant" }));
    await user.clear(within(row).getByLabelText("Merchant name"));
    await user.type(within(row).getByLabelText("Merchant name"), "Amazon Australia");
    await user.clear(within(row).getByLabelText("Primary category"));
    await user.type(within(row).getByLabelText("Primary category"), "Marketplace");
    await user.clear(within(row).getByLabelText("Status"));
    await user.type(within(row).getByLabelText("Status"), "Paused");
    await user.clear(within(row).getByLabelText("Owner"));
    await user.type(within(row).getByLabelText("Owner"), "Commerce desk");
    await user.click(within(row).getByRole("button", { name: "Save merchant" }));

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/v1/admin/merchants", {
      cache: "no-store",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/v1/admin/merchants/amazon-au", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Amazon Australia",
        primaryCategory: "Marketplace",
        status: "Paused",
        owner: "Commerce desk",
      }),
    });

    expect(await screen.findByText("Merchant updated.")).toBeTruthy();
    expect(within(row).getByText("Amazon Australia")).toBeTruthy();
    expect(within(row).getByText("Marketplace")).toBeTruthy();
    expect(within(row).getByText("Paused")).toBeTruthy();
    expect(within(row).getByText("Commerce desk")).toBeTruthy();
  });

  it("deletes a merchant row and removes it from the rendered table", async () => {
    process.env.ADMIN_API_BASE_URL = "http://preview-api.test";
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({
          items: [
            {
              id: "amazon-au",
              name: "Amazon AU",
              activeDeals: 42,
              primaryCategory: "Electronics",
              status: "Active",
              owner: "Marketplace desk",
            },
            {
              id: "chemist-warehouse",
              name: "Chemist Warehouse",
              activeDeals: 17,
              primaryCategory: "Health",
              status: "Needs review",
              owner: "Retail desk",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(createJsonResponse(undefined));
    vi.stubGlobal("fetch", fetchMock);

    await renderCatalogPage(MerchantsPage);

    const row = await waitFor(() => getRowForText("Amazon AU"));
    await user.click(within(row).getByRole("button", { name: "Delete merchant" }));

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/v1/admin/merchants", {
      cache: "no-store",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/v1/admin/merchants/amazon-au", {
      method: "DELETE",
    });

    expect(await screen.findByText("Merchant deleted.")).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByText("Amazon AU")).toBeNull();
    });
    expect(screen.getByText("Chemist Warehouse")).toBeTruthy();
  });

  it("renders tag management rows from the live admin tags API", async () => {
    process.env.ADMIN_API_BASE_URL = "http://preview-api.test";
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        items: [
          {
            id: "gaming",
            name: "Gaming",
            slug: "gaming",
            visibleDeals: 18,
            localization: "EN + ZH ready",
            owner: "Discovery desk",
          },
          {
            id: "grocery",
            name: "Grocery",
            slug: "grocery",
            visibleDeals: 25,
            localization: "EN + ZH ready",
            owner: "Everyday desk",
          },
          {
            id: "travel",
            name: "Travel",
            slug: "travel",
            visibleDeals: 7,
            localization: "Needs ZH review",
            owner: "Lifestyle desk",
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await renderCatalogPage(TagsPage);

    expect(screen.getByRole("heading", { name: "Tags" })).toBeTruthy();
    expect(screen.getByText("Audit public tagging before merchandising changes.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/v1/admin/tags", {
      cache: "no-store",
    });
    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    expect(within(table).getByText("Gaming")).toBeTruthy();
    expect(within(table).getByText("Grocery")).toBeTruthy();
    expect(within(table).getByText("Travel")).toBeTruthy();
  });

  it("renders a tag fallback when the live admin tags API fails", async () => {
    process.env.ADMIN_API_BASE_URL = "http://preview-api.test";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(createJsonResponse({ message: "boom" }, false)),
    );

    await renderCatalogPage(TagsPage);

    expect(await screen.findByText("Failed to load tags.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("submits the create-tag form and renders the created tag", async () => {
    process.env.ADMIN_API_BASE_URL = "http://preview-api.test";
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({
          items: [
            {
              id: "gaming",
              name: "Gaming",
              slug: "gaming",
              visibleDeals: 18,
              localization: "EN + ZH ready",
              owner: "Discovery desk",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          id: "home-office",
          name: "Home Office",
          slug: "home-office",
          visibleDeals: 0,
          localization: "Needs localization",
          owner: "Admin catalog",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await renderCatalogPage(TagsPage);

    await user.type(screen.getByLabelText("Tag name"), "Home Office");
    await user.click(screen.getByRole("button", { name: "Create tag" }));

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/v1/admin/tags", {
      cache: "no-store",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/v1/admin/tags", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Home Office",
      }),
    });

    expect(await screen.findByText("Tag created.")).toBeTruthy();
    const row = await waitFor(() => getRowForText("Home Office"));
    expect(within(row).getByText("home-office")).toBeTruthy();
    expect(within(row).getByText("0")).toBeTruthy();
    expect(within(row).getByText("Needs localization")).toBeTruthy();
    expect(within(row).getByText("Admin catalog")).toBeTruthy();
    expect((screen.getByLabelText("Tag name") as HTMLInputElement).value).toBe("");
  });

  it("edits a tag row and saves the updated catalog fields", async () => {
    process.env.ADMIN_API_BASE_URL = "http://preview-api.test";
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({
          items: [
            {
              id: "gaming",
              name: "Gaming",
              slug: "gaming",
              visibleDeals: 18,
              localization: "EN + ZH ready",
              owner: "Discovery desk",
            },
            {
              id: "travel",
              name: "Travel",
              slug: "travel",
              visibleDeals: 7,
              localization: "Needs ZH review",
              owner: "Lifestyle desk",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          id: "travel",
          name: "Audio",
          slug: "audio",
          visibleDeals: 7,
          localization: "EN only",
          owner: "Merch desk",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await renderCatalogPage(TagsPage);

    const row = await waitFor(() => getRowForText("Travel"));
    await user.click(within(row).getByRole("button", { name: "Edit tag" }));
    await user.clear(within(row).getByLabelText("Tag name"));
    await user.type(within(row).getByLabelText("Tag name"), "Audio");
    await user.clear(within(row).getByLabelText("Slug"));
    await user.type(within(row).getByLabelText("Slug"), "audio");
    await user.clear(within(row).getByLabelText("Localization"));
    await user.type(within(row).getByLabelText("Localization"), "EN only");
    await user.clear(within(row).getByLabelText("Owner"));
    await user.type(within(row).getByLabelText("Owner"), "Merch desk");
    await user.click(within(row).getByRole("button", { name: "Save tag" }));

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/v1/admin/tags", {
      cache: "no-store",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/v1/admin/tags/travel", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Audio",
        slug: "audio",
        localization: "EN only",
        owner: "Merch desk",
      }),
    });

    expect(await screen.findByText("Tag updated.")).toBeTruthy();
    const updatedRow = await waitFor(() => getRowForText("Audio"));
    expect(within(updatedRow).getByText("audio")).toBeTruthy();
    expect(within(updatedRow).getByText("EN only")).toBeTruthy();
    expect(within(updatedRow).getByText("Merch desk")).toBeTruthy();
    expect(getRenderedRowNames(screen.getByRole("table"))).toEqual(["Audio", "Gaming"]);
  });

  it("deletes a tag row and removes it from the rendered table", async () => {
    process.env.ADMIN_API_BASE_URL = "http://preview-api.test";
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({
          items: [
            {
              id: "gaming",
              name: "Gaming",
              slug: "gaming",
              visibleDeals: 18,
              localization: "EN + ZH ready",
              owner: "Discovery desk",
            },
            {
              id: "travel",
              name: "Travel",
              slug: "travel",
              visibleDeals: 7,
              localization: "Needs ZH review",
              owner: "Lifestyle desk",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(createJsonResponse(undefined));
    vi.stubGlobal("fetch", fetchMock);

    await renderCatalogPage(TagsPage);

    const row = await waitFor(() => getRowForText("Travel"));
    await user.click(within(row).getByRole("button", { name: "Delete tag" }));

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/v1/admin/tags", {
      cache: "no-store",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/v1/admin/tags/travel", {
      method: "DELETE",
    });

    expect(await screen.findByText("Tag deleted.")).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByText("Travel")).toBeNull();
    });
    expect(screen.getByText("Gaming")).toBeTruthy();
  });
});
