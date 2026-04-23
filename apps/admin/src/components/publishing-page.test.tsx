import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AdminHomePage from "../app/page";
import PublishingPage from "../app/publishing/page";

function createJsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: async () => body,
  } as Response;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.ADMIN_API_BASE_URL;
});

describe("publishing page", () => {
  it("adds publishing, merchants, and tags links while keeping the existing admin navigation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(createJsonResponse({ message: "boom" }, false)),
    );

    render(await Promise.resolve(AdminHomePage()));

    expect(screen.getByRole("link", { name: "Review publishing queue" }).getAttribute("href")).toBe(
      "/publishing",
    );
    expect(screen.getByRole("link", { name: "Manage merchants" }).getAttribute("href")).toBe(
      "/merchants",
    );
    expect(screen.getByRole("link", { name: "Manage tags" }).getAttribute("href")).toBe("/tags");
    expect(screen.getByRole("link", { name: "Open lead queue" }).getAttribute("href")).toBe(
      "/leads",
    );
    expect(screen.getByRole("link", { name: "Manage sources" }).getAttribute("href")).toBe(
      "/sources",
    );
    expect(screen.getByRole("link", { name: "Preview intake" }).getAttribute("href")).toBe(
      "/intake",
    );
    expect(screen.getByRole("link", { name: "Preview digest" }).getAttribute("href")).toBe(
      "/digest",
    );
  });

  it("renders publishing queue rows from the live admin publishing API", async () => {
    process.env.ADMIN_API_BASE_URL = "http://preview-api.test";
    const fetchMock = vi.fn().mockResolvedValue(
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
            deal: "Amazon AU gaming accessory roundup",
            featuredSlot: "digest-primary",
            publishAt: "2026-04-24T09:05:00.000Z",
            locale: "zh-CN",
            status: "ready",
          },
          {
            id: "queue_3",
            deal: "Weekend appliance bundle feature",
            featuredSlot: "sidebar",
            publishAt: "2026-04-24T09:15:00.000Z",
            locale: "en-AU",
            status: "blocked",
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(await Promise.resolve(PublishingPage()));

    expect(screen.getByRole("heading", { name: "Publishing queue" })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("http://preview-api.test/v1/admin/publishing", {
      cache: "no-store",
    });
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    expect(within(table).getByText("hero")).toBeTruthy();
    expect(within(table).getByText("2026-04-24T09:00:00.000Z")).toBeTruthy();
    expect(within(table).getAllByText("en-AU")).toHaveLength(2);
    expect(within(table).getByText("scheduled")).toBeTruthy();
    expect(within(table).getByText("digest-primary")).toBeTruthy();
    expect(within(table).getByText("2026-04-24T09:05:00.000Z")).toBeTruthy();
    expect(within(table).getByText("zh-CN")).toBeTruthy();
    expect(within(table).getByText("ready")).toBeTruthy();
    expect(within(table).getByText("sidebar")).toBeTruthy();
    expect(within(table).getByText("2026-04-24T09:15:00.000Z")).toBeTruthy();
    expect(within(table).getByText("blocked")).toBeTruthy();
  });

  it("renders a publishing queue error when the live API request fails", async () => {
    process.env.ADMIN_API_BASE_URL = "http://preview-api.test";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(createJsonResponse({ message: "boom" }, false)),
    );

    render(await Promise.resolve(PublishingPage()));

    expect(screen.getByText("Failed to load publishing queue.")).toBeTruthy();
  });
});
