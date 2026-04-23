import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import AdminHomePage from "../app/page";

function createJsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: async () => body,
  } as Response;
}

async function renderAdminHomePage() {
  if (AdminHomePage.constructor.name === "AsyncFunction") {
    render(await Promise.resolve(AdminHomePage()));
    return;
  }

  render(<AdminHomePage />);
}

async function renderAdminHomePageToStaticMarkup() {
  if (AdminHomePage.constructor.name === "AsyncFunction") {
    return renderToStaticMarkup(await Promise.resolve(AdminHomePage()));
  }

  return renderToStaticMarkup(<AdminHomePage />);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.ADMIN_API_BASE_URL;
});

describe("admin dashboard summary", () => {
  it("renders failure summary in server markup without client loading placeholders", async () => {
    process.env.ADMIN_API_BASE_URL = "http://preview-api.test";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse({ message: "lead queue unavailable" }, false))
      .mockResolvedValueOnce(createJsonResponse({ items: [] }))
      .mockResolvedValueOnce(createJsonResponse({ items: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const markup = await renderAdminHomePageToStaticMarkup();

    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://preview-api.test/v1/admin/leads", {
      cache: "no-store",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://preview-api.test/v1/admin/sources", {
      cache: "no-store",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "http://preview-api.test/v1/admin/publishing", {
      cache: "no-store",
    });
    expect(markup).toContain("Failed to load lead queue.");
    expect(markup).toContain("0 sources tracked");
    expect(markup).toContain("0 enabled");
    expect(markup).toContain("0 disabled");
    expect(markup).toContain("0 publishing jobs");
    expect(markup).not.toContain("Loading leads.");
    expect(markup).not.toContain("Loading sources.");
    expect(markup).not.toContain("Loading publishing jobs.");
  });

  it("renders live summary cards from existing admin APIs while preserving navigation links", async () => {
    process.env.ADMIN_API_BASE_URL = "http://preview-api.test";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({
          items: [
            {
              id: "lead_1",
              sourceId: "src_amazon",
              originalTitle: "Nintendo Switch OLED",
              originalUrl: "https://www.amazon.com.au/deal",
              snippet: "Coupon ends tonight.",
              createdAt: "2026-04-23T08:00:00.000Z",
              queue: {
                status: "pending_review",
                label: "Pending review",
              },
            },
            {
              id: "lead_2",
              sourceId: "src_ebay",
              originalTitle: "AirPods Pro 2",
              originalUrl: "https://www.ebay.com.au/deal",
              snippet: "Members save extra.",
              createdAt: "2026-04-23T09:30:00.000Z",
              queue: {
                status: "draft_saved",
                label: "Draft saved",
              },
              review: {
                leadId: "lead_2",
                publish: false,
                updatedAt: "2026-04-23T09:35:00.000Z",
              },
            },
            {
              id: "lead_3",
              sourceId: "src_bigw",
              originalTitle: "Dyson V8",
              originalUrl: "https://www.bigw.com.au/deal",
              snippet: "Weekend deal.",
              createdAt: "2026-04-23T10:00:00.000Z",
              queue: {
                status: "queued_to_publish",
                label: "Queued to publish",
              },
              review: {
                leadId: "lead_3",
                publish: true,
                updatedAt: "2026-04-23T10:05:00.000Z",
              },
            },
          ],
        }),
      )
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
            {
              id: "source_2",
              name: "OzBargain",
              baseUrl: "https://www.ozbargain.com.au",
              trustScore: 88,
              language: "en-AU",
              enabled: true,
            },
            {
              id: "source_3",
              name: "PriceHipster AU",
              baseUrl: "https://www.pricehipster.com",
              trustScore: 77,
              language: "en-AU",
              enabled: false,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          items: [
            {
              id: "queue_1",
              deal: "Nintendo Switch OLED drop",
              featuredSlot: "hero",
              publishAt: "2026-04-24T09:00:00.000Z",
              locale: "en-AU",
              status: "scheduled",
            },
            {
              id: "queue_2",
              deal: "Nintendo Switch OLED 到手 A$399",
              featuredSlot: "hero",
              publishAt: "2026-04-24T09:00:00.000Z",
              locale: "zh-CN",
              status: "scheduled",
            },
            {
              id: "queue_3",
              deal: "Amazon AU gaming accessory roundup",
              featuredSlot: "digest-primary",
              publishAt: "2026-04-24T09:05:00.000Z",
              locale: "en-AU",
              status: "ready",
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await renderAdminHomePage();

    expect(await screen.findByText("3 leads in queue")).toBeTruthy();
    expect(screen.getByText("1 pending review")).toBeTruthy();
    expect(screen.getByText("1 draft saved")).toBeTruthy();
    expect(screen.getByText("1 queued to publish")).toBeTruthy();
    expect(screen.getByText("3 sources tracked")).toBeTruthy();
    expect(screen.getByText("2 enabled")).toBeTruthy();
    expect(screen.getByText("1 disabled")).toBeTruthy();
    expect(screen.getByText("3 publishing jobs")).toBeTruthy();
    expect(screen.getByText("2 scheduled")).toBeTruthy();
    expect(screen.getByText("1 ready")).toBeTruthy();

    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://preview-api.test/v1/admin/leads", {
      cache: "no-store",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://preview-api.test/v1/admin/sources", {
      cache: "no-store",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "http://preview-api.test/v1/admin/publishing", {
      cache: "no-store",
    });
    expect(screen.getByRole("heading", { name: "Live summary" })).toBeTruthy();

    expect(screen.getByRole("link", { name: "Open lead queue" }).getAttribute("href")).toBe(
      "/leads",
    );
    expect(screen.getByRole("link", { name: "Review publishing queue" }).getAttribute("href")).toBe(
      "/publishing",
    );
    expect(screen.getByRole("link", { name: "Preview intake" }).getAttribute("href")).toBe(
      "/intake",
    );
    expect(screen.getByRole("link", { name: "Preview digest" }).getAttribute("href")).toBe(
      "/digest",
    );
    expect(screen.getByRole("link", { name: "Manage sources" }).getAttribute("href")).toBe(
      "/sources",
    );
    expect(screen.getByRole("link", { name: "Manage merchants" }).getAttribute("href")).toBe(
      "/merchants",
    );
    expect(screen.getByRole("link", { name: "Manage tags" }).getAttribute("href")).toBe("/tags");
  });

  it("counts published leads in the live summary", async () => {
    process.env.ADMIN_API_BASE_URL = "http://preview-api.test";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({
          items: [
            {
              id: "lead_published",
              sourceId: "src_amazon",
              originalTitle: "Nintendo Switch OLED",
              originalUrl: "https://www.amazon.com.au/deal",
              snippet: "Published deal.",
              createdAt: "2026-04-23T08:00:00.000Z",
              queue: {
                status: "published",
                label: "Published",
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(createJsonResponse({ items: [] }))
      .mockResolvedValueOnce(createJsonResponse({ items: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await renderAdminHomePage();

    expect(await screen.findByText("1 lead in queue")).toBeTruthy();
    expect(screen.getByText("1 published")).toBeTruthy();
  });
});
